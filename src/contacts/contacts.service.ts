import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { LeadsStorageService } from '../documents/leads-storage.service'
import { UpdateContactDto } from './dto/update-contact.dto'
import { CreateContactDto } from './dto/create-contact.dto'
import { CreateChannelDto } from './dto/create-channel.dto'

const channels = { channels: { orderBy: { createdAt: 'asc' as const } } }

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly storage: LeadsStorageService,
  ) {}

  // Lista de contatos (do tenant atual) com canais e a contagem de oportunidades.
  async findAll() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { ...channels, _count: { select: { opportunities: true } } },
    })
  }

  // Contato + canais + suas oportunidades (resumo), da mais recente para a mais antiga.
  async findOne(id: string) {
    const tenantId = await this.tenant.currentId()
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        ...channels,
        opportunities: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            stageId: true,
            temperature: true,
            fields: true,
            createdAt: true,
            assignees: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } },
            comments: { select: { id: true } },
            tasks: { select: { done: true } },
            activities: { select: { done: true, dueAt: true } },
            _count: { select: { documents: true } },
          },
        },
      },
    })
    if (!contact) throw new NotFoundException('Contato não encontrado.')
    return contact
  }

  // Criação manual de contato (com canais). Escopado pelo tenant atual.
  async create(dto: CreateContactDto) {
    const tenantId = await this.tenant.currentId()
    const { channels: chs, ...rest } = dto
    return this.prisma.contact.create({
      data: {
        tenantId,
        ...rest,
        channels: chs?.length ? { create: chs.map((c) => ({ type: c.type, value: c.value })) } : undefined,
      },
      include: channels,
    })
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.ensureExists(id)
    return this.prisma.contact.update({ where: { id }, data: dto, include: channels })
  }

  async addChannel(id: string, dto: CreateChannelDto) {
    await this.ensureExists(id)
    await this.prisma.contactChannel.create({
      data: { contactId: id, type: dto.type, value: dto.value },
    })
    return this.prisma.contact.findUnique({ where: { id }, include: channels })
  }

  async removeChannel(id: string, channelId: string) {
    await this.ensureExists(id)
    const ch = await this.prisma.contactChannel.findUnique({ where: { id: channelId } })
    if (!ch || ch.contactId !== id) throw new NotFoundException('Canal não encontrado.')
    await this.prisma.contactChannel.delete({ where: { id: channelId } })
    return this.prisma.contact.findUnique({ where: { id }, include: channels })
  }

  /**
   * Exclui contatos e TUDO que pende deles: oportunidades (com atividades, eventos,
   * comentários e tarefas, por cascata) e documentos.
   *
   * Excluir em cascata é deliberado: todo lead capturado nasce como contato +
   * oportunidade, então recusar contatos "com oportunidades" deixaria a exclusão
   * inútil justamente para o caso de uso real (limpar leads de teste e spam).
   * Quem chama precisa avisar o usuário — a UI mostra a contagem antes de confirmar.
   *
   * Os objetos do R2 saem ANTES das linhas: se o storage falhar, o banco continua
   * apontando para eles e dá para tentar de novo. Na ordem inversa, o arquivo ficaria
   * órfão no bucket, sem ninguém que soubesse dele.
   */
  async removeMany(ids: string[]) {
    const tenantId = await this.tenant.currentId()

    const targets = await this.prisma.contact.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true },
    })
    if (!targets.length) throw new NotFoundException('Nenhum contato encontrado.')
    const targetIds = targets.map((c) => c.id)

    const docs = await this.prisma.document.findMany({
      where: { tenantId, contactId: { in: targetIds } },
      select: { storageKey: true },
    })
    for (const d of docs) await this.storage.remove(d.storageKey)

    const [opportunities] = await this.prisma.$transaction([
      this.prisma.opportunity.deleteMany({ where: { tenantId, contactId: { in: targetIds } } }),
      this.prisma.contact.deleteMany({ where: { tenantId, id: { in: targetIds } } }),
    ])

    return {
      deleted: targetIds.length,
      opportunities: opportunities.count,
      documents: docs.length,
    }
  }

  async remove(id: string) {
    await this.ensureExists(id)
    return this.removeMany([id])
  }

  /** Quantas oportunidades e documentos seriam levados junto — a UI avisa antes. */
  async deletionImpact(ids: string[]) {
    const tenantId = await this.tenant.currentId()
    const [opportunities, documents] = await Promise.all([
      this.prisma.opportunity.count({ where: { tenantId, contactId: { in: ids } } }),
      this.prisma.document.count({ where: { tenantId, contactId: { in: ids } } }),
    ])
    return { contacts: ids.length, opportunities, documents }
  }

  // Garante que o contato existe e é do tenant atual.
  private async ensureExists(id: string) {
    const tenantId = await this.tenant.currentId()
    const c = await this.prisma.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!c) throw new NotFoundException('Contato não encontrado.')
    return tenantId
  }
}
