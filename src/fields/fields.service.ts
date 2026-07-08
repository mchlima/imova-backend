import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import {
  CreateFieldDto,
  CreateSectionDto,
  ReorderDto,
  UpdateFieldDto,
  UpdateSectionDto,
} from './dto/field.dto'

@Injectable()
export class FieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Seções (na ordem) com seus campos ativos (na ordem) do tenant atual.
  async definitions() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.fieldSection.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: { fields: { where: { archived: false }, orderBy: { order: 'asc' } } },
    })
  }

  // Todas as definições (inclui arquivadas) — para a tela de gestão.
  async allDefinitions() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.fieldSection.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: { fields: { orderBy: { order: 'asc' } } },
    })
  }

  // ── seções ──
  async createSection(dto: CreateSectionDto) {
    const tenantId = await this.tenant.currentId()
    const order = dto.order ?? (await this.nextSectionOrder(tenantId))
    return this.prisma.fieldSection.create({
      data: { tenantId, key: dto.key, label: dto.label, order },
    })
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const { tenantId, section } = await this.ensureSection(id)
    // se a key da seção mudou, recria os índices dos campos indexados dessa seção
    // (o caminho do índice inclui a key da seção). Valores antigos ficam órfãos.
    if (dto.key && dto.key !== section.key) {
      const indexed = await this.prisma.fieldDefinition.findMany({
        where: { sectionId: id, indexed: true },
        select: { id: true, key: true },
      })
      for (const f of indexed) {
        await this.dropFieldIndex(f.id)
        await this.createFieldIndex(f.id, dto.key, f.key)
      }
    }
    return this.prisma.fieldSection.update({ where: { id }, data: dto })
  }

  async deleteSection(id: string) {
    await this.ensureSection(id)
    // onDelete: Cascade remove as definições da seção (valores no JSONB permanecem)
    await this.prisma.fieldSection.delete({ where: { id } })
    return { ok: true }
  }

  async reorderSections(dto: ReorderDto) {
    const tenantId = await this.tenant.currentId()
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.fieldSection.updateMany({
          where: { id: i.id, tenantId },
          data: { order: i.order },
        }),
      ),
    )
    return { ok: true }
  }

  // ── campos ──
  async createField(dto: CreateFieldDto) {
    const tenantId = await this.tenant.currentId()
    await this.ensureSectionOwned(tenantId, dto.sectionId)
    const order = dto.order ?? (await this.nextFieldOrder(dto.sectionId))
    return this.prisma.fieldDefinition.create({
      data: {
        tenantId,
        sectionId: dto.sectionId,
        key: dto.key,
        label: dto.label,
        type: dto.type,
        options: dto.options ?? [],
        order,
      },
    })
  }

  async updateField(id: string, dto: UpdateFieldDto) {
    const { tenantId, field } = await this.ensureField(id)
    let sectionKey = field.section.key
    if (dto.sectionId) {
      const target = await this.ensureSectionOwned(tenantId, dto.sectionId)
      sectionKey = target.key
    }
    const willIndex = dto.indexed ?? field.indexed
    const newKey = dto.key ?? field.key
    const pathChanged = sectionKey !== field.section.key || newKey !== field.key

    // reconcilia o índice de expressão (caminho aninhado, nome estável por id)
    if (!willIndex && field.indexed) {
      await this.dropFieldIndex(id)
    } else if (willIndex && (!field.indexed || pathChanged)) {
      await this.dropFieldIndex(id) // idempotente
      await this.createFieldIndex(id, sectionKey, newKey)
    }

    return this.prisma.fieldDefinition.update({ where: { id }, data: dto })
  }

  async deleteField(id: string) {
    const { field } = await this.ensureField(id)
    if (field.indexed) await this.dropFieldIndex(id)
    await this.prisma.fieldDefinition.delete({ where: { id } })
    return { ok: true }
  }

  async reorderFields(dto: ReorderDto) {
    const tenantId = await this.tenant.currentId()
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.fieldDefinition.updateMany({
          where: { id: i.id, tenantId },
          data: { order: i.order },
        }),
      ),
    )
    return { ok: true }
  }

  // ── promoção: índice de expressão sobre Opportunity.fields->'seção'->>'campo' ──
  // Nome do índice estável por id do campo; caminho usa as keys atuais (validadas
  // como slug no DTO, seguras pra interpolar).
  private indexName(fieldId: string) {
    return `opp_field_${fieldId.replace(/-/g, '')}_idx`
  }
  private async createFieldIndex(fieldId: string, sectionKey: string, fieldKey: string) {
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${this.indexName(fieldId)}" ON "opportunities" (("fields"->'${sectionKey}'->>'${fieldKey}'))`,
    )
  }
  private async dropFieldIndex(fieldId: string) {
    await this.prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${this.indexName(fieldId)}"`)
  }

  // ── helpers ──
  private async nextSectionOrder(tenantId: string) {
    const last = await this.prisma.fieldSection.findFirst({
      where: { tenantId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    return (last?.order ?? 0) + 1
  }
  private async nextFieldOrder(sectionId: string) {
    const last = await this.prisma.fieldDefinition.findFirst({
      where: { sectionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    return (last?.order ?? 0) + 1
  }
  private async ensureSection(id: string) {
    const tenantId = await this.tenant.currentId()
    const section = await this.prisma.fieldSection.findFirst({
      where: { id, tenantId },
      select: { id: true, key: true },
    })
    if (!section) throw new NotFoundException('Seção não encontrada.')
    return { tenantId, section }
  }
  private async ensureSectionOwned(tenantId: string, sectionId: string) {
    const s = await this.prisma.fieldSection.findFirst({
      where: { id: sectionId, tenantId },
      select: { id: true, key: true },
    })
    if (!s) throw new BadRequestException('Seção inválida.')
    return s
  }
  private async ensureField(id: string) {
    const tenantId = await this.tenant.currentId()
    const field = await this.prisma.fieldDefinition.findFirst({
      where: { id, tenantId },
      select: { id: true, key: true, indexed: true, section: { select: { key: true } } },
    })
    if (!field) throw new NotFoundException('Campo não encontrado.')
    return { tenantId, field }
  }
}
