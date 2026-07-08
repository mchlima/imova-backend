import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { CreateStageDto, ReorderStagesDto, UpdateStageDto } from './dto/stage.dto'

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Estágios do funil do tenant atual, na ordem do funil.
  async stages() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.stage.findMany({ where: { tenantId }, orderBy: { order: 'asc' } })
  }

  async createStage(dto: CreateStageDto) {
    const tenantId = await this.tenant.currentId()
    const pipeline = await this.defaultPipeline(tenantId)
    const order = dto.order ?? (await this.nextOrder(tenantId))
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

  async deleteStage(id: string) {
    await this.ensureStage(id)
    await this.prisma.stage.delete({ where: { id } })
    return { ok: true }
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

  private async defaultPipeline(tenantId: string) {
    let pipeline = await this.prisma.pipeline.findFirst({ where: { tenantId }, orderBy: { key: 'asc' } })
    if (!pipeline) {
      pipeline = await this.prisma.pipeline.create({
        data: { tenantId, key: 'default', label: 'Funil de vendas' },
      })
    }
    return pipeline
  }
  private async nextOrder(tenantId: string) {
    const last = await this.prisma.stage.findFirst({
      where: { tenantId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    return (last?.order ?? 0) + 1
  }
  private async ensureStage(id: string) {
    const tenantId = await this.tenant.currentId()
    const s = await this.prisma.stage.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!s) throw new NotFoundException('Estágio não encontrado.')
    return tenantId
  }
}
