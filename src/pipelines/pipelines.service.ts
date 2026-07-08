import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { CreateStageDto, ReorderStagesDto, UpdateStageDto } from './dto/stage.dto'
import { UpdatePipelineDto } from './dto/pipeline.dto'

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Boards (pipelines) do tenant, na ordem. Cada board tem seus próprios estágios.
  async pipelines() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.pipeline.findMany({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, key: true, label: true, order: true, ownerUserId: true },
    })
  }

  // Atualiza um board (rótulo, key, ordem, dono). ownerUserId vazio/null desatribui.
  async updatePipeline(id: string, dto: UpdatePipelineDto) {
    const tenantId = await this.tenant.currentId()
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!pipeline) throw new NotFoundException('Board não encontrado.')
    const data: Record<string, unknown> = {}
    if (dto.label !== undefined) data.label = dto.label
    if (dto.order !== undefined) data.order = dto.order
    if (dto.ownerUserId !== undefined) data.ownerUserId = dto.ownerUserId || null
    if (dto.key !== undefined) {
      const key = dto.key.trim()
      if (!key) throw new BadRequestException('A key não pode ser vazia.')
      const dup = await this.prisma.pipeline.findFirst({
        where: { tenantId, key, id: { not: id } },
        select: { id: true },
      })
      if (dup) throw new BadRequestException('Já existe um pipeline com essa key.')
      data.key = key
    }
    await this.prisma.pipeline.update({ where: { id }, data })
    return this.pipelines()
  }

  // Estágios do tenant, na ordem. Devolve TODOS os boards (cada estágio traz seu
  // pipelineId), pra o front agrupar as colunas por board e manter o lookup global
  // de cor/label por key.
  async stages() {
    const tenantId = await this.tenant.currentId()
    const stages = await this.prisma.stage.findMany({ where: { tenantId }, orderBy: { order: 'asc' } })
    // nº de oportunidades por (pipeline, status) — usado na config (delete com migração)
    const grouped = await this.prisma.opportunity.groupBy({
      by: ['pipelineId', 'status'],
      where: { tenantId },
      _count: { _all: true },
    })
    const countOf = (pipelineId: string, key: string) =>
      grouped.find((g) => g.pipelineId === pipelineId && g.status === key)?._count._all ?? 0
    return stages.map((s) => ({ ...s, oppCount: countOf(s.pipelineId, s.key) }))
  }

  async createStage(dto: CreateStageDto) {
    const tenantId = await this.tenant.currentId()
    const pipeline = dto.pipelineId
      ? await this.ensurePipeline(tenantId, dto.pipelineId)
      : await this.defaultPipeline(tenantId)
    const order = dto.order ?? (await this.nextOrder(tenantId, pipeline.id))
    return this.prisma.stage.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        key: dto.key,
        label: dto.label,
        color: dto.color ?? '#64748b',
        order,
        inKanban: dto.inKanban ?? true,
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
      },
    })
  }

  async updateStage(id: string, dto: UpdateStageDto) {
    await this.ensureStage(id)
    return this.prisma.stage.update({ where: { id }, data: dto })
  }

  // Exclui um estágio. Se houver oportunidades nele, migra-as para `moveToStageId`
  // (mesmo pipeline) antes de apagar — evita oportunidades órfãs (status sem coluna).
  async deleteStage(id: string, moveToStageId?: string) {
    const stage = await this.ensureStage(id)
    const where = {
      tenantId: stage.tenantId,
      pipelineId: stage.pipelineId,
      status: stage.key,
    }
    const count = await this.prisma.opportunity.count({ where })
    if (count > 0) {
      if (!moveToStageId)
        throw new BadRequestException('Há oportunidades neste estágio. Informe o estágio de destino.')
      const target = await this.prisma.stage.findFirst({
        where: { id: moveToStageId, tenantId: stage.tenantId, pipelineId: stage.pipelineId },
        select: { id: true, key: true },
      })
      if (!target || target.id === id)
        throw new BadRequestException('Estágio de destino inválido.')
      await this.prisma.opportunity.updateMany({ where, data: { status: target.key } })
    }
    await this.prisma.stage.delete({ where: { id } })
    return { ok: true, moved: count }
  }

  async reorderStages(dto: ReorderStagesDto) {
    const tenantId = await this.tenant.currentId()
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.stage.updateMany({ where: { id: i.id, tenantId }, data: { order: i.order } }),
      ),
    )
    return { ok: true }
  }

  // board padrão: o primeiro por ordem (não por key — 'corretora' < 'default').
  private async defaultPipeline(tenantId: string) {
    let pipeline = await this.prisma.pipeline.findFirst({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    if (!pipeline) {
      pipeline = await this.prisma.pipeline.create({
        data: { tenantId, key: 'default', label: 'Captação' },
      })
    }
    return pipeline
  }
  private async ensurePipeline(tenantId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id: pipelineId, tenantId } })
    if (!pipeline) throw new NotFoundException('Board não encontrado.')
    return pipeline
  }
  // próxima ordem dentro de um board (estágios são ordenados por board).
  private async nextOrder(tenantId: string, pipelineId: string) {
    const last = await this.prisma.stage.findFirst({
      where: { tenantId, pipelineId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    return (last?.order ?? 0) + 1
  }
  private async ensureStage(id: string) {
    const tenantId = await this.tenant.currentId()
    const s = await this.prisma.stage.findFirst({
      where: { id, tenantId },
      select: { id: true, tenantId: true, pipelineId: true, key: true },
    })
    if (!s) throw new NotFoundException('Estágio não encontrado.')
    return s
  }
}
