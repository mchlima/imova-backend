import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { slugify } from '../cms/slug'
import { retryOnSlugCollision } from '../cms/prisma-errors'
import {
  CreateDevelopmentDto,
  DevelopmentFilterDto,
  TypologyInputDto,
  UpdateDevelopmentDto,
  UpdateImageDto,
} from './dto/development.dto'
import { DevelopmentStorageService, ImageKind, UploadedImage } from './development-storage.service'

const withRelations = {
  typologies: { orderBy: { order: 'asc' as const } },
  images: { orderBy: { order: 'asc' as const } },
}

@Injectable()
export class DevelopmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly storage: DevelopmentStorageService,
  ) {}

  // ── slug único por tenant ──
  private async uniqueSlug(tenantId: string, name: string, ignoreId?: string): Promise<string> {
    const base = slugify(name) || 'empreendimento'
    let slug = base
    let n = 2
    while (true) {
      const clash = await this.prisma.development.findFirst({
        where: { tenantId, slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
        select: { id: true },
      })
      if (!clash) return slug
      slug = `${base}-${n++}`
    }
  }

  // facetas de filtro derivadas das tipologias (recalculadas no save)
  private facets(typologies: TypologyInputDto[]) {
    const beds = typologies.map((t) => t.bedrooms ?? 0)
    const parks = typologies.map((t) => t.parking ?? 0)
    const suites = typologies.map((t) => t.suites ?? 0)
    const areasMin = typologies.map((t) => t.areaMin ?? 0).filter((a) => a > 0)
    const areasMax = typologies.map((t) => t.areaMax ?? 0).filter((a) => a > 0)
    return {
      bedroomsMin: beds.length ? Math.min(...beds) : 0,
      bedroomsMax: beds.length ? Math.max(...beds) : 0,
      parkingMax: parks.length ? Math.max(...parks) : 0,
      suitesMax: suites.length ? Math.max(...suites) : 0,
      areaMin: areasMin.length ? Math.min(...areasMin) : 0,
      areaMax: areasMax.length ? Math.max(...areasMax) : 0,
    }
  }

  // ── Admin ──
  async listAdmin() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.development.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: 'desc' }],
      include: { _count: { select: { typologies: true, images: true } } },
    })
  }

  async getAdmin(id: string) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { id, tenantId },
      include: withRelations,
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    return dev
  }

  async create(dto: CreateDevelopmentDto) {
    const tenantId = await this.tenant.currentId()
    const name = dto.name.trim()
    return retryOnSlugCollision(async () => {
      const slug = await this.uniqueSlug(tenantId, name)
      return this.prisma.development.create({
        data: { tenantId, name, slug },
        include: withRelations,
      })
    })
  }

  async update(id: string, dto: UpdateDevelopmentDto) {
    const tenantId = await this.tenant.currentId()
    const existing = await this.prisma.development.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Empreendimento não encontrado.')

    const data: Prisma.DevelopmentUpdateInput = {}

    // escalares diretos
    const assign = <K extends keyof UpdateDevelopmentDto>(k: K) => {
      if (dto[k] !== undefined) (data as Record<string, unknown>)[k as string] = dto[k]
    }
    ;([
      'name', 'construtora', 'tipo', 'descricao', 'uf', 'cidade', 'bairro', 'regiao',
      'endereco', 'standEndereco', 'lat', 'lng', 'status', 'obraEvolucaoPct', 'entregaLabel',
      'priceFrom', 'priceMax', 'programa', 'aceitaFgts', 'subsidioAte', 'rendaMinima',
      'tetoHis1', 'tetoHis2', 'tetoHmp', 'totalUnidades', 'torres', 'pavimentos', 'terrenoM2',
      'amenities', 'incorporadora', 'cnpj', 'registroIncorporacao', 'arquitetura', 'paisagismo',
      'decoracao', 'seoTitle', 'seoDescription',
    ] as (keyof UpdateDevelopmentDto)[]).forEach(assign)

    // slugs derivados
    if (dto.cidade !== undefined) data.cidadeSlug = slugify(dto.cidade)
    if (dto.bairro !== undefined) data.bairroSlug = slugify(dto.bairro)
    if (dto.masterplanName !== undefined) {
      data.masterplanName = dto.masterplanName
      data.masterplanSlug = dto.masterplanName ? slugify(dto.masterplanName) : ''
    }

    // slug do empreendimento: explícito ou re-derivado do nome
    if (dto.slug !== undefined && dto.slug.trim()) {
      data.slug = await this.uniqueSlug(tenantId, dto.slug, id)
    } else if (dto.name !== undefined) {
      data.slug = await this.uniqueSlug(tenantId, dto.name, id)
    }

    // tipologias: substitui a lista inteira + recalcula facetas
    let droppedPlantaKeys: string[] = []
    if (dto.typologies !== undefined) {
      const list = dto.typologies
      Object.assign(data, this.facets(list))
      // plantas que saíram da lista → apagar do R2 após salvar (delete-on-replace)
      const oldTypos = await this.prisma.developmentTypology.findMany({
        where: { developmentId: id },
        select: { imageStorageKey: true },
      })
      const kept = new Set(list.map((t) => t.imageStorageKey).filter(Boolean))
      droppedPlantaKeys = oldTypos
        .map((t) => t.imageStorageKey)
        .filter((k): k is string => !!k && !kept.has(k))
      data.typologies = {
        deleteMany: {},
        create: list.map((t, i) => ({
          label: t.label.trim(),
          bedrooms: t.bedrooms ?? 0,
          suites: t.suites ?? null,
          areaMin: t.areaMin ?? 0,
          areaMax: t.areaMax ?? 0,
          priceFrom: t.priceFrom ?? null,
          parking: t.parking ?? null,
          terraco: t.terraco ?? false,
          order: t.order ?? i,
          imageUrl: t.imageUrl ?? '',
          imageStorageKey: t.imageStorageKey ?? '',
        })),
      }
    }

    const saved = await retryOnSlugCollision(() =>
      this.prisma.development.update({ where: { id }, data, include: withRelations }),
    )
    // limpeza best-effort das plantas trocadas (não bloqueia a resposta)
    for (const key of droppedPlantaKeys) {
      await this.storage.remove(key).catch(() => undefined)
    }
    return saved
  }

  // upload da planta de uma tipologia: sobe ao R2 e devolve url+storageKey
  // (o vínculo é salvo junto da lista de tipologias, não cria linha de imagem)
  async addTypologyImage(id: string, file: UploadedImage) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    const { key, url } = await this.storage.upload(tenantId, id, 'planta', file)
    return { url, storageKey: key }
  }

  async remove(id: string) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    // apaga as linhas (cascade cuida de tipologias/imagens) e varre o R2 pelo prefixo
    await this.prisma.development.delete({ where: { id } })
    await this.storage.removeAll(tenantId, id)
    return { ok: true }
  }

  async publish(id: string) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { id, tenantId },
      select: { id: true, firstPublishedAt: true },
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    return this.prisma.development.update({
      where: { id },
      data: {
        published: true,
        publishedAt: new Date(),
        firstPublishedAt: dev.firstPublishedAt ?? new Date(),
      },
      include: withRelations,
    })
  }

  async unpublish(id: string) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    return this.prisma.development.update({
      where: { id },
      data: { published: false },
      include: withRelations,
    })
  }

  // ── Imagens (R2) ──
  async addImage(id: string, kind: ImageKind, file: UploadedImage) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { id, tenantId },
      select: { id: true, _count: { select: { images: true } } },
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    if (dev._count.images >= 30)
      throw new BadRequestException('Limite de 30 imagens por empreendimento atingido.')

    const { key, url } = await this.storage.upload(tenantId, id, kind, file)
    try {
      await this.prisma.developmentImage.create({
        data: { developmentId: id, storageKey: key, url, kind, order: dev._count.images },
      })
    } catch (e) {
      // compensação: se a linha não gravou, remove o objeto para não deixar órfão
      await this.storage.remove(key)
      throw e
    }
    return this.getAdmin(id)
  }

  async updateImage(id: string, imageId: string, dto: UpdateImageDto) {
    const tenantId = await this.tenant.currentId()
    const img = await this.prisma.developmentImage.findFirst({
      where: { id: imageId, developmentId: id, development: { tenantId } },
      select: { id: true },
    })
    if (!img) throw new NotFoundException('Imagem não encontrada.')
    await this.prisma.developmentImage.update({
      where: { id: imageId },
      data: {
        ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      },
    })
    return this.getAdmin(id)
  }

  async removeImage(id: string, imageId: string) {
    const tenantId = await this.tenant.currentId()
    const img = await this.prisma.developmentImage.findFirst({
      where: { id: imageId, developmentId: id, development: { tenantId } },
      select: { id: true, storageKey: true },
    })
    if (!img) throw new NotFoundException('Imagem não encontrada.')
    await this.prisma.developmentImage.delete({ where: { id: imageId } })
    await this.storage.remove(img.storageKey)
    return this.getAdmin(id)
  }

  // reconciliação sob demanda: apaga do R2 objetos sem linha no banco
  async reconcileStorage() {
    const tenantId = await this.tenant.currentId()
    const [imgs, typos] = await Promise.all([
      this.prisma.developmentImage.findMany({
        where: { development: { tenantId } },
        select: { storageKey: true },
      }),
      this.prisma.developmentTypology.findMany({
        where: { development: { tenantId } },
        select: { imageStorageKey: true },
      }),
    ])
    const known = [
      ...imgs.map((r) => r.storageKey),
      ...typos.map((t) => t.imageStorageKey),
    ].filter(Boolean)
    return this.storage.reconcileTenant(tenantId, known)
  }

  // ── Público ──
  async listPublished(f: DevelopmentFilterDto) {
    const tenantId = await this.tenant.currentId()
    const where: Prisma.DevelopmentWhereInput = { tenantId, published: true }
    if (f.regiao) where.regiao = f.regiao
    if (f.bairro) where.bairroSlug = f.bairro
    if (f.status) where.status = f.status
    if (f.dorms) where.bedroomsMax = { gte: f.dorms }
    if (f.vagas) where.parkingMax = { gte: f.vagas }
    if (f.precoMin || f.precoMax) {
      where.priceFrom = {
        ...(f.precoMin ? { gte: f.precoMin } : {}),
        ...(f.precoMax ? { lte: f.precoMax } : {}),
      }
    }
    const amenitySlugs = (f.amenities ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (amenitySlugs.length) where.amenities = { hasEvery: amenitySlugs }

    const orderBy: Prisma.DevelopmentOrderByWithRelationInput =
      f.sort === 'menor_preco'
        ? { priceFrom: 'asc' }
        : f.sort === 'maior_preco'
          ? { priceFrom: 'desc' }
          : { firstPublishedAt: 'desc' }

    return this.prisma.development.findMany({ where, orderBy, include: withRelations })
  }

  async getPublishedBySlug(slug: string) {
    const tenantId = await this.tenant.currentId()
    const dev = await this.prisma.development.findFirst({
      where: { tenantId, slug, published: true },
      include: withRelations,
    })
    if (!dev) throw new NotFoundException('Empreendimento não encontrado.')
    return dev
  }

  // bairros distintos (para o select pesquisável do catálogo)
  async bairros() {
    const tenantId = await this.tenant.currentId()
    const rows = await this.prisma.development.findMany({
      where: { tenantId, published: true, bairroSlug: { not: '' } },
      select: { bairro: true, bairroSlug: true, regiao: true },
      distinct: ['bairroSlug'],
      orderBy: { bairro: 'asc' },
    })
    return rows
  }
}
