import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { UpdateContactDto } from './dto/update-contact.dto'
import { CreateContactDto } from './dto/create-contact.dto'
import { CreateChannelDto } from './dto/create-channel.dto'

const channels = { channels: { orderBy: { createdAt: 'asc' as const } } }

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
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

  // Garante que o contato existe e é do tenant atual.
  private async ensureExists(id: string) {
    const tenantId = await this.tenant.currentId()
    const c = await this.prisma.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!c) throw new NotFoundException('Contato não encontrado.')
    return tenantId
  }
}
