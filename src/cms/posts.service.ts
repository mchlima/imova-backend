import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { UpdatePostDto } from './dto/post.dto'
import { slugify } from './slug'
import { renderMarkdown, readingTime } from './markdown'
import { retryOnSlugCollision } from './prisma-errors'
import { R2Service } from './r2.service'

type PostStatus = 'draft' | 'published' | 'changed' | 'archived'

export interface UploadedImage {
  buffer: Buffer
  mimetype: string
  size: number
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private draftSignature(p: any): string {
    const payload = {
      title: p.title,
      slug: p.slug,
      deck: p.deck,
      body: p.body,
      bullets: p.bullets,
      faq: p.faq,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      canonicalUrl: p.canonicalUrl,
      ogImage: p.ogImage,
      coverImageUrl: p.coverImageUrl,
      categoryId: p.categoryId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tagIds: [...(p.tags ?? []).map((t: any) => t.id)].sort(),
    }
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  }

  // status real: compara o conteúdo do rascunho com o que está publicado (hash),
  // então salvar sem mudar nada NÃO marca como "alterado".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private status(p: any): PostStatus {
    if (p.archived) return 'archived'
    if (!p.published) return 'draft'
    if (p.publishedHash && p.publishedHash !== this.draftSignature(p)) return 'changed'
    return 'published'
  }

  private async uniqueSlug(name: string, ignoreId?: string): Promise<string> {
    const base = slugify(name) || 'post'
    let slug = base
    let n = 2
    while (true) {
      const found = await this.prisma.post.findUnique({ where: { slug } })
      if (!found || found.id === ignoreId) break
      slug = `${base}-${n++}`
    }
    return slug
  }

  // ── Admin ──
  async listAdmin() {
    const posts = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        author: { select: { name: true } },
      },
    })
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: this.status(p),
      coverImageUrl: p.coverImageUrl,
      categoryId: p.categoryId,
      category: p.category?.name ?? null,
      tags: p.tags,
      tagIds: p.tags.map((t) => t.id),
      author: p.author.name,
      updatedAt: p.updatedAt,
      publishedAt: p.publishedAt,
    }))
  }

  async getAdmin(id: string) {
    const p = await this.prisma.post.findUnique({
      where: { id },
      include: { tags: true, category: true },
    })
    if (!p) throw new NotFoundException('Post não encontrado.')
    return { ...p, tagIds: p.tags.map((t) => t.id), status: this.status(p) }
  }

  async create(authorId: string, title: string) {
    return retryOnSlugCollision(async () =>
      this.prisma.post.create({
        data: { title, slug: await this.uniqueSlug(title), authorId },
      }),
    )
  }

  async update(id: string, dto: UpdatePostDto) {
    await this.ensure(id)
    const data: Record<string, unknown> = {}
    const scalars: (keyof UpdatePostDto)[] = [
      'title', 'deck', 'body', 'metaTitle', 'metaDescription', 'canonicalUrl', 'ogImage',
    ]
    for (const k of scalars) if (dto[k] !== undefined) data[k] = dto[k]
    if (dto.bullets !== undefined) data.bullets = dto.bullets
    if (dto.faq !== undefined) data.faq = dto.faq
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true }
    }
    if (dto.tagIds !== undefined) {
      data.tags = { set: dto.tagIds.map((tid) => ({ id: tid })) }
    }
    return retryOnSlugCollision(async () => {
      // recalcula o slug a cada tentativa (pega o próximo sufixo se houver corrida)
      if (dto.slug !== undefined) data.slug = await this.uniqueSlug(dto.slug, id)
      await this.prisma.post.update({ where: { id }, data })
      return this.getAdmin(id)
    })
  }

  /** Promove o rascunho atual a publicado (gera o snapshot que o site lê). */
  async publish(id: string) {
    const p = await this.prisma.post.findUnique({
      where: { id },
      include: {
        tags: true,
        author: { select: { name: true } },
        category: { include: { parent: { include: { parent: true } } } },
      },
    })
    if (!p) throw new NotFoundException('Post não encontrado.')

    // caminho da categoria (root → leaf) para breadcrumb e filtro por nível
    const chain: { name: string; slug: string }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = p.category
    while (node) {
      chain.push({ name: node.name, slug: node.slug })
      node = node.parent
    }
    chain.reverse()

    const now = new Date()
    // primeira publicação é fixa; republicações não a alteram
    const firstPublishedAt = p.firstPublishedAt ?? now

    const snapshot = {
      slug: p.slug,
      title: p.title,
      deck: p.deck,
      coverImageUrl: p.coverImageUrl,
      bodyHtml: renderMarkdown(p.body),
      bullets: p.bullets,
      faq: p.faq,
      seo: {
        metaTitle: p.metaTitle || p.title,
        metaDescription: p.metaDescription || p.deck,
        canonicalUrl: p.canonicalUrl,
        ogImage: p.ogImage,
      },
      category: { path: chain },
      tags: p.tags.map((t) => ({ name: t.name, slug: t.slug })),
      author: { name: p.author.name },
      readingTime: readingTime(p.body),
      publishedAt: firstPublishedAt.toISOString(), // data exibida = primeira publicação
      updatedAt: now.toISOString(), // última republicação (JSON-LD dateModified)
    }

    await this.prisma.post.update({
      where: { id },
      data: {
        published: true,
        publishedAt: now,
        firstPublishedAt,
        publishedSnapshot: snapshot,
        publishedHash: this.draftSignature(p),
        publishedSlug: p.slug,
        publishedCategorySlugs: chain.map((c) => c.slug),
        publishedTagSlugs: p.tags.map((t) => t.slug),
      },
    })
    return this.getAdmin(id)
  }

  async unpublish(id: string) {
    await this.ensure(id)
    await this.prisma.post.update({ where: { id }, data: { published: false } })
    return this.getAdmin(id)
  }

  /** Arquiva: remove do site sem apagar. */
  async archive(id: string) {
    await this.ensure(id)
    await this.prisma.post.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    })
    return this.getAdmin(id)
  }

  async unarchive(id: string) {
    const p = await this.prisma.post.findUnique({ where: { id } })
    if (!p) throw new NotFoundException('Post não encontrado.')
    // Reativar não conta como "alteração não publicada": se já era publicado,
    // mantém o status 'published' realinhando publishedAt com o updatedAt.
    await this.prisma.post.update({
      where: { id },
      data: {
        archived: false,
        archivedAt: null,
        ...(p.published ? { publishedAt: new Date() } : {}),
      },
    })
    return this.getAdmin(id)
  }

  async remove(id: string) {
    const p = await this.prisma.post.findUnique({
      where: { id },
      select: { coverImageKey: true },
    })
    if (!p) throw new NotFoundException('Post não encontrado.')
    await this.prisma.post.delete({ where: { id } })
    await this.r2.remove(p.coverImageKey) // apaga a capa do bucket
    return { ok: true }
  }

  // ── capa (R2) ──
  async setCover(id: string, file?: UploadedImage) {
    const p = await this.prisma.post.findUnique({
      where: { id },
      select: { coverImageKey: true },
    })
    if (!p) throw new NotFoundException('Post não encontrado.')
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo de imagem ausente.')
    if (!file.mimetype.startsWith('image/'))
      throw new BadRequestException('O arquivo precisa ser uma imagem.')

    const ext = file.mimetype === 'image/webp' ? 'webp' : (file.mimetype.split('/')[1] || 'webp')
    const key = `posts/covers/${id}/${randomUUID()}.${ext}`
    const url = await this.r2.upload(key, file.buffer, file.mimetype)

    await this.prisma.post.update({
      where: { id },
      data: { coverImageUrl: url, coverImageKey: key },
    })
    // remove a capa anterior só depois de gravar a nova
    if (p.coverImageKey && p.coverImageKey !== key) await this.r2.remove(p.coverImageKey)
    return this.getAdmin(id)
  }

  async removeCover(id: string) {
    const p = await this.prisma.post.findUnique({
      where: { id },
      select: { coverImageKey: true },
    })
    if (!p) throw new NotFoundException('Post não encontrado.')
    await this.prisma.post.update({
      where: { id },
      data: { coverImageUrl: '', coverImageKey: '' },
    })
    await this.r2.remove(p.coverImageKey)
    return this.getAdmin(id)
  }

  private async ensure(id: string) {
    const p = await this.prisma.post.findUnique({ where: { id } })
    if (!p) throw new NotFoundException('Post não encontrado.')
  }

  // ── Público (lê o snapshot publicado) ──
  async listPublished(opts: { category?: string; tag?: string; q?: string }) {
    const where: Record<string, unknown> = { published: true, archived: false }
    if (opts.category) where.publishedCategorySlugs = { has: opts.category }
    if (opts.tag) where.publishedTagSlugs = { has: opts.tag }
    const posts = await this.prisma.post.findMany({
      where,
      orderBy: { firstPublishedAt: 'desc' }, // ordem pela primeira publicação
      select: { publishedSnapshot: true },
    })
    let items = posts.map((p) => p.publishedSnapshot as Record<string, unknown>)
    if (opts.q) {
      const s = opts.q.toLowerCase()
      items = items.filter((it) => {
        const tags = ((it.tags as { name: string }[]) || []).map((t) => t.name).join(' ')
        return `${it.title} ${it.deck} ${tags}`.toLowerCase().includes(s)
      })
    }
    return items
  }

  async getPublishedBySlug(slug: string) {
    const p = await this.prisma.post.findFirst({
      where: { published: true, archived: false, publishedSlug: slug },
      select: { publishedSnapshot: true },
    })
    if (!p) throw new NotFoundException('Conteúdo não encontrado.')
    return p.publishedSnapshot
  }
}
