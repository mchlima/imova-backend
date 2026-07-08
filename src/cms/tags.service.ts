import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpsertTagDto } from './dto/tag.dto'
import { slugify } from './slug'
import { retryOnSlugCollision } from './prisma-errors'

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private seoGeoData(dto: UpsertTagDto): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    const fields: (keyof UpsertTagDto)[] = [
      'description', 'intro', 'metaTitle', 'metaDescription', 'canonicalUrl', 'ogImage',
    ]
    for (const k of fields) if (dto[k] !== undefined) data[k] = dto[k]
    if (dto.faq !== undefined) data.faq = dto.faq
    return data
  }

  private async uniqueSlug(name: string, ignoreId?: string): Promise<string> {
    const base = slugify(name) || 'tag'
    let slug = base
    let n = 2
    while (true) {
      const found = await this.prisma.tag.findUnique({ where: { slug } })
      if (!found || found.id === ignoreId) break
      slug = `${base}-${n++}`
    }
    return slug
  }

  list() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } })
  }

  async create(dto: UpsertTagDto) {
    return retryOnSlugCollision(async () =>
      this.prisma.tag.create({
        data: {
          name: dto.name,
          slug: await this.uniqueSlug(dto.slug || dto.name),
          ...this.seoGeoData(dto),
        },
      }),
    )
  }

  async update(id: string, dto: UpsertTagDto) {
    await this.ensure(id)
    return retryOnSlugCollision(async () => {
      const data: Record<string, unknown> = { name: dto.name, ...this.seoGeoData(dto) }
      // slug só muda se enviado explicitamente (mantém URLs estáveis no rename)
      if (dto.slug !== undefined && dto.slug.trim()) {
        data.slug = await this.uniqueSlug(dto.slug, id)
      }
      return this.prisma.tag.update({ where: { id }, data })
    })
  }

  async remove(id: string) {
    await this.ensure(id)
    await this.prisma.tag.delete({ where: { id } })
    return { ok: true }
  }

  private async ensure(id: string) {
    const t = await this.prisma.tag.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('Tag não encontrada.')
  }
}
