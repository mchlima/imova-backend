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
  // histórico de alterações/movimentações (mais recente primeiro)
  events: { orderBy: { createdAt: 'desc' as const } },
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
  // estágio inicial referenciado pelo id EXTERNO (integrações); ausente = primeiro estágio
  stageExternalId?: string
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
    const { tenantId, contact: c, stageExternalId } = input
    const contact = await this.resolveContact(tenantId, c)

    // estágio via id externo (define também o pipeline); ausente = board padrão + 1º estágio.
    const stage = stageExternalId
      ? await this.prisma.stage.findFirst({ where: { tenantId, externalId: stageExternalId } })
      : null
    const pipelineId = stage ? stage.pipelineId : (await this.defaultPipeline(tenantId)).id
    const stageId = stage ? stage.id : await this.defaultStageId(tenantId, pipelineId)
    // sanitiza os campos aninhados contra as definições (ignora seção/campo desconhecido)
    const map = await this.fieldTypeMap(tenantId)
    const fields = sanitizeNested(map, input.fields ?? {})
    const created = await this.prisma.opportunity.create({
      data: {
        tenantId,
        pipelineId,
        contactId: contact.id,
        stageId,
        source: input.source ?? '',
        fields: fields as Prisma.InputJsonValue,
      },
      include: withRelations,
    })
    await this.saveEvents(tenantId, created.id, [{ type: 'created', data: { source: input.source ?? '' } }], 'Sistema')
    return created
  }

  // Criação manual no admin: usa um contato existente (contactId) OU cria/dedup
  // um novo a partir dos dados enviados. Origem padrão = 'manual'.
  async createManual(dto: CreateOpportunityDto, author: string) {
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
    const stageId = dto.stageId || (await this.defaultStageId(tenantId, pipeline.id))
    const map = await this.fieldTypeMap(tenantId)
    const fields = sanitizeNested(map, dto.fields ?? {})
    const created = await this.prisma.opportunity.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        contactId,
        stageId,
        source: dto.source ?? 'manual',
        temperature: dto.temperature ?? 'Sem classificação',
        fields: fields as Prisma.InputJsonValue,
        ...(dto.assigneeIds?.length
          ? { assignees: { connect: dto.assigneeIds.map((uid) => ({ id: uid })) } }
          : {}),
      },
      include: withRelations,
    })
    await this.saveEvents(tenantId, created.id, [{ type: 'created', data: { source: dto.source ?? 'manual' } }], author)
    return created
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

  // Id do primeiro estágio de um board (ou do tenant, se pipelineId ausente) — fallback
  // quando a ingestão/criação não informa o estágio inicial.
  private async defaultStageId(tenantId: string, pipelineId?: string) {
    const stage = await this.prisma.stage.findFirst({
      where: { tenantId, ...(pipelineId ? { pipelineId } : {}) },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    return stage?.id ?? null
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
  async moveToPipeline(id: string, pipelineId: string, assigneeIds: string[] | undefined, author: string) {
    const tenantId = await this.ensureExists(id)
    const before = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { pipelineId: true, pipeline: { select: { label: true } } },
    })
    const pipeline = await this.ensurePipeline(tenantId, pipelineId)
    const stageId = await this.defaultStageId(tenantId, pipeline.id)
    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        pipelineId: pipeline.id,
        stageId,
        boardOrder: 0,
        ...(assigneeIds ? { assignees: { set: assigneeIds.map((uid) => ({ id: uid })) } } : {}),
      },
      include: withRelations,
    })
    await this.saveEvents(
      tenantId,
      id,
      [
        {
          type: 'pipeline_changed',
          data: {
            fromPipelineId: before?.pipelineId ?? null,
            fromPipelineLabel: before?.pipeline?.label ?? null,
            toPipelineId: pipeline.id,
            toPipelineLabel: pipeline.label,
          },
        },
      ],
      author,
    )
    return updated
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
  async reorder(items: { id: string; stageId?: string; boardOrder: number }[], author: string) {
    const tenantId = await this.tenant.currentId()
    // estágios atuais dos itens que trazem stageId — p/ detectar mudança de coluna
    const withStage = items.filter((i) => i.stageId)
    const before = withStage.length
      ? await this.prisma.opportunity.findMany({
          where: { id: { in: withStage.map((i) => i.id) }, tenantId },
          select: { id: true, stageId: true },
        })
      : []
    const beforeMap = new Map(before.map((o) => [o.id, o.stageId]))
    const result = await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.opportunity.updateMany({
          where: { id: i.id, tenantId },
          data: { boardOrder: i.boardOrder, ...(i.stageId ? { stageId: i.stageId } : {}) },
        }),
      ),
    )
    // registra mudança de estágio (uma por card que trocou de coluna)
    const evs: { opportunityId: string; type: string; data: Prisma.InputJsonValue }[] = []
    for (const i of withStage) {
      const from = beforeMap.get(i.id) ?? null
      if (from === i.stageId) continue
      const e = await this.stageChangeEvent(from, i.stageId!, undefined)
      if (e) evs.push({ opportunityId: i.id, type: e.type, data: e.data })
    }
    if (evs.length) {
      await this.prisma.opportunityEvent.createMany({
        data: evs.map((e) => ({ tenantId, opportunityId: e.opportunityId, type: e.type, data: e.data, author })),
      })
    }
    return result
  }

  // Exclui a oportunidade. As atividades caem por cascata (onDelete: Cascade);
  // o contato NÃO é removido (1 contato → N oportunidades ao longo do tempo).
  async remove(id: string) {
    await this.ensureExists(id)
    await this.prisma.opportunity.delete({ where: { id } })
    return { ok: true }
  }

  async update(id: string, dto: UpdateOpportunityDto, author: string) {
    const tenantId = await this.ensureExists(id)
    // estado ANTES da alteração (para diffar e registrar no histórico)
    const before = await this.prisma.opportunity.findUnique({
      where: { id },
      select: {
        stageId: true,
        temperature: true,
        assignees: { select: { id: true, name: true } },
      },
    })
    const { fields: fieldsPatch, assigneeIds, ...rest } = dto
    const data: Record<string, unknown> = { ...rest }
    // patch parcial dos campos personalizados: mescla no JSONB e coage por tipo
    let changedFieldLabels: string[] = []
    if (fieldsPatch && typeof fieldsPatch === 'object') {
      const { merged, changed } = await this.mergeFields(tenantId, id, fieldsPatch)
      data.fields = merged
      changedFieldLabels = changed
    }
    // responsáveis: substitui o conjunto inteiro pelo enviado (set)
    if (assigneeIds) {
      data.assignees = { set: assigneeIds.map((uid) => ({ id: uid })) }
    }
    const updated = await this.prisma.opportunity.update({ where: { id }, data, include: withRelations })

    // ── histórico ──
    const events: { type: string; data: Prisma.InputJsonValue }[] = []
    if (before && dto.stageId !== undefined && dto.stageId !== before.stageId) {
      const e = await this.stageChangeEvent(before.stageId, dto.stageId, dto.lossReason)
      if (e) events.push(e)
    }
    if (before && dto.temperature !== undefined && dto.temperature !== before.temperature) {
      events.push({ type: 'temperature_changed', data: { from: before.temperature, to: dto.temperature } })
    }
    if (before && assigneeIds) {
      const beforeIds = new Set(before.assignees.map((a) => a.id))
      const addedIds = assigneeIds.filter((x) => !beforeIds.has(x))
      const removed = before.assignees.filter((a) => !assigneeIds.includes(a.id))
      if (addedIds.length || removed.length) {
        const added = updated.assignees.filter((a) => addedIds.includes(a.id)).map((a) => a.name)
        events.push({ type: 'assignees_changed', data: { added, removed: removed.map((a) => a.name) } })
      }
    }
    if (changedFieldLabels.length) {
      events.push({ type: 'fields_updated', data: { fields: changedFieldLabels } })
    }
    await this.saveEvents(tenantId, id, events, author)
    return updated
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

  // Mapa 'sectionKey.fieldKey' → label (para descrever campos alterados no histórico).
  private async fieldLabelMap(tenantId: string) {
    const defs = await this.prisma.fieldDefinition.findMany({
      where: { tenantId, archived: false },
      select: { key: true, label: true, section: { select: { key: true } } },
    })
    const map: Record<string, string> = {}
    for (const d of defs) map[`${d.section.key}.${d.key}`] = d.label
    return map
  }

  // Mescla um patch parcial aninhado em Opportunity.fields, coagindo por tipo e
  // ignorando seção/campo sem definição. Merge por seção (não substitui a seção toda).
  // Retorna também os RÓTULOS dos campos que realmente mudaram (para o histórico).
  private async mergeFields(tenantId: string, id: string, patch: Record<string, unknown>) {
    const map = await this.fieldTypeMap(tenantId)
    const labels = await this.fieldLabelMap(tenantId)
    const sanitized = sanitizeNested(map, patch as Record<string, Record<string, unknown>>)
    const opp = await this.prisma.opportunity.findUnique({ where: { id }, select: { fields: true } })
    const current = (opp?.fields as Record<string, Record<string, unknown>>) ?? {}
    const merged: Record<string, Record<string, unknown>> = { ...current }
    const changed: string[] = []
    for (const [sk, fields] of Object.entries(sanitized)) {
      merged[sk] = { ...(current[sk] ?? {}), ...fields }
      for (const [fk, v] of Object.entries(fields)) {
        const cur = current[sk]?.[fk]
        if (JSON.stringify(cur ?? null) !== JSON.stringify(v ?? null)) {
          changed.push(labels[`${sk}.${fk}`] ?? fk)
        }
      }
    }
    return { merged, changed }
  }

  // ── histórico (OpportunityEvent) ──
  // Classifica uma mudança de estágio em won/lost/stage_changed, com rótulos congelados.
  private async stageChangeEvent(fromStageId: string | null, toStageId: string, lossReason?: string) {
    if (fromStageId === toStageId) return null
    const [from, to] = await Promise.all([
      fromStageId
        ? this.prisma.stage.findUnique({ where: { id: fromStageId }, select: { label: true } })
        : null,
      this.prisma.stage.findUnique({
        where: { id: toStageId },
        select: { label: true, isWon: true, isLost: true },
      }),
    ])
    const data: Record<string, unknown> = {
      fromStageId,
      toStageId,
      fromStageLabel: from?.label ?? null,
      toStageLabel: to?.label ?? null,
    }
    if (to?.isWon) return { type: 'won', data: data as Prisma.InputJsonValue }
    if (to?.isLost) return { type: 'lost', data: { ...data, lossReason: lossReason ?? '' } as Prisma.InputJsonValue }
    return { type: 'stage_changed', data: data as Prisma.InputJsonValue }
  }

  // Persiste uma lista de eventos (no-op se vazia).
  private async saveEvents(
    tenantId: string,
    opportunityId: string,
    events: { type: string; data: Prisma.InputJsonValue }[],
    author: string,
  ) {
    if (!events.length) return
    await this.prisma.opportunityEvent.createMany({
      data: events.map((e) => ({ tenantId, opportunityId, type: e.type, data: e.data, author: author || '' })),
    })
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
            stageId: true,
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
