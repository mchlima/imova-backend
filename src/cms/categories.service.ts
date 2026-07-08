import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { slugify } from './slug'
import { retryOnSlugCollision } from './prisma-errors'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueSlug(source: string, ignoreId?: string): Promise<string> {
    const base = slugify(source) || 'categoria'
    let slug = base
    let n = 2
    while (true) {
      const found = await this.prisma.category.findUnique({ where: { slug } })
      if (!found || found.id === ignoreId) break
      slug = `${base}-${n++}`
    }
    return slug
  }

  async create(dto: CreateCategoryDto) {
    let level = 1
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } })
      if (!parent) throw new NotFoundException('Categoria pai não encontrada.')
      level = parent.level + 1
      if (level > 3) throw new BadRequestException('A taxonomia tem no máximo 3 níveis.')
    }
    return retryOnSlugCollision(async () =>
      this.prisma.category.create({
        data: {
          name: dto.name,
          slug: await this.uniqueSlug(dto.slug || dto.name),
          description: dto.description ?? '',
          order: dto.order ?? 0,
          level,
          parentId: dto.parentId ?? null,
          intro: dto.intro ?? '',
          faq: (dto.faq ?? []) as unknown as object[],
          metaTitle: dto.metaTitle ?? '',
          metaDescription: dto.metaDescription ?? '',
          canonicalUrl: dto.canonicalUrl ?? '',
          ogImage: dto.ogImage ?? '',
        },
      }),
    )
  }

  /** Lista plana ordenada (para o admin montar a árvore). */
  list() {
    return this.prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })
  }

  /** Árvore aninhada (para o site público / menus). */
  async tree() {
    const all = await this.list()
    const byId = new Map(all.map((c) => [c.id, { ...c, children: [] as unknown[] }]))
    const roots: unknown[] = []
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        ;(byId.get(c.parentId)!.children as unknown[]).push(c)
      } else {
        roots.push(c)
      }
    }
    return roots
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensure(id)
    const data: Record<string, unknown> = {}
    const fields: (keyof UpdateCategoryDto)[] = [
      'name', 'description', 'order', 'intro',
      'metaTitle', 'metaDescription', 'canonicalUrl', 'ogImage',
    ]
    for (const k of fields) if (dto[k] !== undefined) data[k] = dto[k]
    if (dto.faq !== undefined) data.faq = dto.faq
    return retryOnSlugCollision(async () => {
      // slug só muda se enviado explicitamente (mantém URLs estáveis)
      if (dto.slug !== undefined && dto.slug.trim()) {
        data.slug = await this.uniqueSlug(dto.slug, id)
      }
      return this.prisma.category.update({ where: { id }, data })
    })
  }

  async remove(id: string) {
    await this.ensure(id)
    // desvincula posts da categoria e de todas as descendentes, depois apaga (cascade nos filhos)
    const ids = await this.descendantIds(id)
    await this.prisma.post.updateMany({
      where: { categoryId: { in: ids } },
      data: { categoryId: null },
    })
    await this.prisma.category.delete({ where: { id } })
    return { ok: true }
  }

  private async ensure(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Categoria não encontrada.')
  }

  private async descendantIds(id: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } })
    const ids = [id]
    let added = true
    while (added) {
      added = false
      for (const c of all) {
        if (c.parentId && ids.includes(c.parentId) && !ids.includes(c.id)) {
          ids.push(c.id)
          added = true
        }
      }
    }
    return ids
  }
}
