import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TenantService } from '../tenant/tenant.service'
import { UpdateOpportunityDto } from './dto/update-opportunity.dto'
import { CreateOpportunityDto } from './dto/create-opportunity.dto'
import { CreateActivityDto } from './dto/create-activity.dto'
import { UpdateActivityDto } from './dto/update-activity.dto'

// Contato (com canais) + responsáveis + histórico/atividades (timeline) em ordem cronológica.
const withRelations = {
  contact: { include: { channels: { orderBy: { createdAt: 'asc' as const } } } },
  assignees: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } },
  activities: { orderBy: { createdAt: 'desc' as const } },
}

// Payload genérico de ingestão (CRM core — sem regra de domínio do Meu Revelar).
// Fonte externa (outro projeto) chega por aqui via /ingest; a captura do Meu Revelar
// (POST /opportunities) monta este mesmo shape internamente.
export interface IngestInput {
  tenantId: string
  source?: string
  contact: { name: string; channels: { type: string; value: string }[] }
  // valores dos campos personalizados, aninhados por seção: { sectionKey: { fieldKey: valor } }
  // chaves sem definição (seção ou campo) são ignoradas.
  fields?: Record<string, Record<string, unknown>>
  stageKey?: string // estágio inicial (decidido por quem chama); ausente = primeiro estágio
}

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Captura do simulador: acha-ou-cria o contato (dedup por e-mail) e cria a
  // oportunidade ligada a ele. Os dados de pessoa vão para o contato; os de
  // interesse/financeiro, para a oportunidade.
  // Ingestão genérica (CRM core). Resolve/dedup o contato por e-mail dentro do
  // tenant, adiciona canais que faltarem e cria a oportunidade no estágio dado
  // (ou no primeiro estágio do funil). Sem nenhuma regra específica de domínio.
  async ingest(input: IngestInput) {
    const { tenantId, contact: c, stageKey } = input
    const contact = await this.resolveContact(tenantId, c)

    // toda oportunidade nova cai no board padrão (Captação) — o repasse é manual.
    const pipeline = await this.defaultPipeline(tenantId)
    const status = stageKey || (await this.defaultStageKey(tenantId, pipeline.id))
    // sanitiza os campos aninhados contra as definições (ignora seção/campo desconhecido)
    const map = await this.fieldTypeMap(tenantId)
    const fields = sanitizeNested(map, input.fields ?? {})
    return this.prisma.opportunity.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        contactId: contact.id,
        status,
        source: input.source ?? '',
        fields: fields as Prisma.InputJsonValue,
      },
      include: withRelations,
    })
  }

  // Criação manual no admin: usa um contato existente (contactId) OU cria/dedup
  // um novo a partir dos dados enviados. Origem padrão = 'manual'.
  async createManual(dto: CreateOpportunityDto) {
    const tenantId = await this.tenant.currentId()

    let contactId = dto.contactId
    if (contactId) {
      const exists = await this.prisma.contact.findFirst({
        where: { id: contactId, tenantId },
        select: { id: true },
      })
      if (!exists) throw new NotFoundException('Contato não encontrado.')
    } else {
      if (!dto.contact) {
        throw new BadRequestException('Informe um contato existente ou os dados de um novo contato.')
      }
      const contact = await this.resolveContact(tenantId, dto.contact)
      contactId = contact.id
    }

    // board de destino: o informado (criação a partir de um board) ou o padrão.
    const pipeline = dto.pipelineId
      ? await this.ensurePipeline(tenantId, dto.pipelineId)
      : await this.defaultPipeline(tenantId)
    const status = dto.stageKey || (await this.defaultStageKey(tenantId, pipeline.id))
    const map = await this.fieldTypeMap(tenantId)
    const fields = sanitizeNested(map, dto.fields ?? {})
    return this.prisma.opportunity.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        contactId,
        status,
        source: dto.source ?? 'manual',
        temperature: dto.temperature ?? 'Sem classificação',
        fields: fields as Prisma.InputJsonValue,
        ...(dto.assigneeIds?.length
          ? { assignees: { connect: dto.assigneeIds.map((uid) => ({ id: uid })) } }
          : {}),
      },
      include: withRelations,
    })
  }

  // Acha-ou-cria o contato do tenant por e-mail (dedup), atualizando o nome e
  // acrescentando canais que faltarem. Compartilhado por ingest e criação manual.
  private async resolveContact(
    tenantId: string,
    c: { name: string; channels: { type: string; value: string }[] },
  ) {
    const email = c.channels.find((ch) => ch.type === 'email')?.value

    let contact = email
      ? await this.prisma.contact.findFirst({
          where: {
            tenantId,
            channels: { some: { type: 'email', value: { equals: email, mode: 'insensitive' } } },
          },
        })
      : null

    if (!contact) {
      return this.prisma.contact.create({
        data: { tenantId, name: c.name, channels: { create: c.channels } },
      })
    }

    if (c.name) await this.prisma.contact.update({ where: { id: contact.id }, data: { name: c.name } })
    // adiciona canais que ainda não existem nesse contato
    for (const ch of c.channels) {
      const has = await this.prisma.contactChannel.findFirst({
        where: { contactId: contact.id, type: ch.type, value: ch.value },
      })
      if (!has) {
        await this.prisma.contactChannel.create({
          data: { contactId: contact.id, type: ch.type, value: ch.value },
        })
      }
    }
    return contact
  }

  // Primeiro estágio de um board (ou do tenant, se pipelineId ausente) — fallback
  // quando a ingestão não informa o estágio inicial.
  private async defaultStageKey(tenantId: string, pipelineId?: string) {
    const stage = await this.prisma.stage.findFirst({
      where: { tenantId, ...(pipelineId ? { pipelineId } : {}) },
      orderBy: { order: 'asc' },
    })
    return stage?.key ?? 'Lead'
  }

  // Board padrão do tenant (primeiro por ordem) — destino de novas oportunidades.
  private async defaultPipeline(tenantId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    if (!pipeline) throw new NotFoundException('Nenhum board configurado.')
    return pipeline
  }

  // Garante que o board existe e é do tenant atual.
  private async ensurePipeline(tenantId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
    })
    if (!pipeline) throw new NotFoundException('Board não encontrado.')
    return pipeline
  }

  // Move a oportunidade para outro board: cai no 1º estágio do destino, no topo da
  // coluna, e opcionalmente (re)atribui responsáveis. É o "enviar para o board da corretora".
  async moveToPipeline(id: string, pipelineId: string, assigneeIds?: string[]) {
    const tenantId = await this.ensureExists(id)
    const pipeline = await this.ensurePipeline(tenantId, pipelineId)
    const status = await this.defaultStageKey(tenantId, pipeline.id)
    return this.prisma.opportunity.update({
      where: { id },
      data: {
        pipelineId: pipeline.id,
        status,
        boardOrder: 0,
        ...(assigneeIds ? { assignees: { set: assigneeIds.map((uid) => ({ id: uid })) } } : {}),
      },
      include: withRelations,
    })
  }

  async findAll() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.opportunity.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: withRelations,
    })
  }

  async findOne(id: string) {
    const tenantId = await this.tenant.currentId()
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, tenantId },
      include: withRelations,
    })
    if (!opportunity) throw new NotFoundException('Oportunidade não encontrada.')
    return opportunity
  }

  // Reordenação do kanban: atualiza boardOrder (e status, se mudou de coluna) em lote.
  // updateMany com filtro de tenant garante que só se mexe no que é do tenant.
  async reorder(items: { id: string; status?: string; boardOrder: number }[]) {
    const tenantId = await this.tenant.currentId()
    return this.prisma.$transaction(
      items.map((i) =>
        this.prisma.opportunity.updateMany({
          where: { id: i.id, tenantId },
          data: { boardOrder: i.boardOrder, ...(i.status ? { status: i.status } : {}) },
        }),
      ),
    )
  }

  // Exclui a oportunidade. As atividades caem por cascata (onDelete: Cascade);
  // o contato NÃO é removido (1 contato → N oportunidades ao longo do tempo).
  async remove(id: string) {
    await this.ensureExists(id)
    await this.prisma.opportunity.delete({ where: { id } })
    return { ok: true }
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    const tenantId = await this.ensureExists(id)
    const { fields: fieldsPatch, assigneeIds, ...rest } = dto
    const data: Record<string, unknown> = { ...rest }
    // patch parcial dos campos personalizados: mescla no JSONB e coage por tipo
    if (fieldsPatch && typeof fieldsPatch === 'object') {
      data.fields = await this.mergeFields(tenantId, id, fieldsPatch)
    }
    // responsáveis: substitui o conjunto inteiro pelo enviado (set)
    if (assigneeIds) {
      data.assignees = { set: assigneeIds.map((uid) => ({ id: uid })) }
    }
    return this.prisma.opportunity.update({ where: { id }, data, include: withRelations })
  }

  // Mapa sectionKey → { fieldKey → type } das definições ativas do tenant.
  private async fieldTypeMap(tenantId: string) {
    const defs = await this.prisma.fieldDefinition.findMany({
      where: { tenantId, archived: false },
      select: { key: true, type: true, section: { select: { key: true } } },
    })
    const map: Record<string, Record<string, string>> = {}
    for (const d of defs) (map[d.section.key] ||= {})[d.key] = d.type
    return map
  }

  // Mescla um patch parcial aninhado em Opportunity.fields, coagindo por tipo e
  // ignorando seção/campo sem definição. Merge por seção (não substitui a seção toda).
  private async mergeFields(tenantId: string, id: string, patch: Record<string, unknown>) {
    const map = await this.fieldTypeMap(tenantId)
    const sanitized = sanitizeNested(map, patch as Record<string, Record<string, unknown>>)
    const opp = await this.prisma.opportunity.findUnique({ where: { id }, select: { fields: true } })
    const current = (opp?.fields as Record<string, Record<string, unknown>>) ?? {}
    const merged: Record<string, Record<string, unknown>> = { ...current }
    for (const [sk, fields] of Object.entries(sanitized)) {
      merged[sk] = { ...(current[sk] ?? {}), ...fields }
    }
    return merged
  }

  // Atividades pendentes de todas as oportunidades (página de Follow-up).
  // Notas (type=nota) nunca ficam pendentes, então não aparecem aqui.
  async pendingActivities() {
    const tenantId = await this.tenant.currentId()
    return this.prisma.opportunityActivity.findMany({
      where: { done: false, tenantId },
      orderBy: [{ dueAt: 'asc' }],
      include: {
        opportunity: {
          select: {
            id: true,
            status: true,
            temperature: true,
            fields: true,
            contact: {
              select: { name: true, channels: { select: { type: true, value: true } } },
            },
          },
        },
      },
    })
  }

  // ── atividades (CRM) ──
  async addActivity(id: string, dto: CreateActivityDto, author: string) {
    const tenantId = await this.ensureExists(id)
    const done = dto.done ?? false
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null
    // atividade passada registrada como concluída: aconteceu na data escolhida (dueAt),
    // não "agora" — então doneAt = dueAt. Nota/registro sem data → doneAt = agora.
    await this.prisma.opportunityActivity.create({
      data: {
        tenantId,
        opportunityId: id,
        type: dto.type,
        title: dto.title,
        notes: dto.notes ?? '',
        dueAt,
        done,
        doneAt: done ? (dueAt ?? new Date()) : null,
        author,
      },
    })
    return this.prisma.opportunity.findUnique({ where: { id }, include: withRelations })
  }

  async updateActivity(id: string, activityId: string, dto: UpdateActivityDto) {
    await this.ensureActivity(id, activityId)
    const data: Record<string, unknown> = {}
    if (dto.type !== undefined) data.type = dto.type
    if (dto.title !== undefined) data.title = dto.title
    if (dto.notes !== undefined) data.notes = dto.notes
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null
    if (dto.done !== undefined) {
      data.done = dto.done
      data.doneAt = dto.done ? new Date() : null
    }
    await this.prisma.opportunityActivity.update({ where: { id: activityId }, data })
    return this.prisma.opportunity.findUnique({ where: { id }, include: withRelations })
  }

  async removeActivity(id: string, activityId: string) {
    await this.ensureActivity(id, activityId)
    await this.prisma.opportunityActivity.delete({ where: { id: activityId } })
    return this.prisma.opportunity.findUnique({ where: { id }, include: withRelations })
  }

  // Garante que a oportunidade existe e é do tenant atual; retorna o tenantId.
  private async ensureExists(id: string) {
    const tenantId = await this.tenant.currentId()
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!opportunity) throw new NotFoundException('Oportunidade não encontrada.')
    return tenantId
  }

  private async ensureActivity(opportunityId: string, activityId: string) {
    const tenantId = await this.tenant.currentId()
    const a = await this.prisma.opportunityActivity.findFirst({
      where: { id: activityId, tenantId },
      select: { opportunityId: true },
    })
    if (!a || a.opportunityId !== opportunityId)
      throw new NotFoundException('Atividade não encontrada.')
  }
}

// Coage o valor de um campo personalizado conforme o tipo da definição.
function coerceFieldValue(type: string, v: unknown): unknown {
  if (type === 'number' || type === 'money') return v === '' || v == null ? 0 : Number(v)
  if (type === 'boolean') return !!v
  if (type === 'multiselect') return Array.isArray(v) ? v : []
  return v == null ? '' : String(v)
}

// Sanitiza um objeto aninhado { sectionKey: { fieldKey: valor } } contra o mapa de
// tipos: mantém só seções/campos com definição, coagindo o valor. Ignora o resto.
function sanitizeNested(
  map: Record<string, Record<string, string>>,
  patch: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [sk, fields] of Object.entries(patch || {})) {
    const sec = map[sk]
    if (!sec || typeof fields !== 'object' || fields === null) continue
    for (const [fk, v] of Object.entries(fields)) {
      if (!(fk in sec)) continue
      ;(out[sk] ||= {})[fk] = coerceFieldValue(sec[fk], v)
    }
  }
  return out
}
