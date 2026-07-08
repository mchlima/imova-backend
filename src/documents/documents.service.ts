import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { LeadsStorageService } from './leads-storage.service'
import { CreateDocumentDto } from './dto/create-document.dto'

export interface UploadedDocument {
  buffer: Buffer
  mimetype: string
  size: number
  originalname: string
}

// Tipos aceitos: PDF, imagens e documentos do Office. Limite de tamanho aplicado no
// controller (FileInterceptor). Mantido em sincronia com o front (aba Documentos).
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

// campos seguros p/ o front (nunca expõe a storageKey do R2)
const publicSelect = {
  id: true,
  contactId: true,
  opportunityId: true,
  category: true,
  categoryLabel: true,
  fileName: true,
  mimeType: true,
  size: true,
  uploadedBy: true,
  createdAt: true,
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly storage: LeadsStorageService,
  ) {}

  async create(file: UploadedDocument | undefined, dto: CreateDocumentDto, uploadedBy: string) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.')
    if (!ALLOWED_MIME.has(file.mimetype))
      throw new BadRequestException('Tipo de arquivo não permitido.')
    const tenantId = await this.tenant.currentId()

    // valida o contato (dono) e, se informado, a oportunidade (mesmo tenant e contato)
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, tenantId },
      select: { id: true },
    })
    if (!contact) throw new NotFoundException('Contato não encontrado.')
    if (dto.opportunityId) {
      const opp = await this.prisma.opportunity.findFirst({
        where: { id: dto.opportunityId, tenantId },
        select: { contactId: true },
      })
      if (!opp) throw new NotFoundException('Oportunidade não encontrada.')
      if (opp.contactId !== dto.contactId)
        throw new BadRequestException('A oportunidade não pertence a este contato.')
    }

    const safeName = file.originalname.replace(/[^\w.\-() ]+/g, '_').slice(-120)
    const storageKey = `${tenantId}/contacts/${dto.contactId}/${randomUUID()}-${safeName}`
    await this.storage.upload(storageKey, file.buffer, file.mimetype)

    return this.prisma.document.create({
      data: {
        tenantId,
        contactId: dto.contactId,
        opportunityId: dto.opportunityId || null,
        category: dto.category || 'outro',
        categoryLabel: dto.categoryLabel || '',
        fileName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy,
      },
      select: publicSelect,
    })
  }

  // Todos os documentos de um contato (reutilizáveis) — o front marca os da oportunidade atual.
  async listByContact(contactId: string) {
    const tenantId = await this.tenant.currentId()
    return this.prisma.document.findMany({
      where: { tenantId, contactId },
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    })
  }

  // URL pré-assinada de curta duração para ver/baixar. `download` força o download.
  async getUrl(id: string, download: boolean) {
    const tenantId = await this.tenant.currentId()
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: { storageKey: true, fileName: true },
    })
    if (!doc) throw new NotFoundException('Documento não encontrado.')
    const url = await this.storage.signedUrl(doc.storageKey, doc.fileName, download)
    return { url }
  }

  async remove(id: string) {
    const tenantId = await this.tenant.currentId()
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true, storageKey: true },
    })
    if (!doc) throw new NotFoundException('Documento não encontrado.')
    await this.storage.remove(doc.storageKey)
    await this.prisma.document.delete({ where: { id: doc.id } })
    return { ok: true }
  }
}
