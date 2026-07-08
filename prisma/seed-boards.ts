import { PrismaClient } from '@prisma/client'

// Seed idempotente dos 2 boards (pipelines) do Meu Revelar.
//
//  1. Captação  (o board atual — key 'default'): onde todo lead do site cai. A
//     pré-venda recebe, qualifica e repassa.
//  2. Corretora (novo — key 'corretora'): funil ativo de vendas da corretora.
//
// Também faz o BACKFILL: toda oportunidade sem board vai para a Captação.
// Seguro rodar múltiplas vezes (upsert + update condicional).
const prisma = new PrismaClient()

const TENANT_SLUG = 'imova'

// Board 1 — Captação (reaproveita o pipeline 'default' existente, só renomeia/ordena).
const CAPTACAO = { key: 'default', label: 'Captação', order: 0 }

// Board 2 — Corretora (funil de vendas). Keys ÚNICAS entre boards (evita colisão no
// lookup global de cor/label por key). 'PerdidoVendas' rotula como "Perdido".
const CORRETORA = { key: 'corretora', label: 'Corretora', order: 1 }
const CORRETORA_STAGES = [
  { key: 'Atendimento', label: 'Em atendimento', color: '#B45309', order: 1, inKanban: true },
  { key: 'Visita', label: 'Visita agendada', color: '#0369A1', order: 2, inKanban: true },
  { key: 'Proposta', label: 'Proposta', color: '#7C3AED', order: 3, inKanban: true },
  { key: 'Negociacao', label: 'Negociação', color: '#C2410C', order: 4, inKanban: true },
  { key: 'Fechado', label: 'Fechado', color: '#146c4e', order: 5, inKanban: true, isWon: true },
  { key: 'PerdidoVendas', label: 'Perdido', color: '#DC2626', order: 6, inKanban: false, isLost: true },
]

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' não encontrado — rode o seed-crm antes.`)

  // 1. Captação: renomeia/ordena o pipeline default (mantém a key p/ estabilidade).
  const captacao = await prisma.pipeline.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: CAPTACAO.key } },
    update: { label: CAPTACAO.label, order: CAPTACAO.order },
    create: { tenantId: tenant.id, key: CAPTACAO.key, label: CAPTACAO.label, order: CAPTACAO.order },
  })
  console.log(`✔ board Captação (${captacao.id})`)

  // 2. Corretora: cria o board + estágios.
  const corretora = await prisma.pipeline.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: CORRETORA.key } },
    update: { label: CORRETORA.label, order: CORRETORA.order },
    create: { tenantId: tenant.id, key: CORRETORA.key, label: CORRETORA.label, order: CORRETORA.order },
  })
  for (const s of CORRETORA_STAGES) {
    await prisma.stage.upsert({
      where: { tenantId_pipelineId_key: { tenantId: tenant.id, pipelineId: corretora.id, key: s.key } },
      update: { label: s.label, color: s.color, order: s.order, inKanban: s.inKanban, isWon: s.isWon ?? false, isLost: s.isLost ?? false },
      create: {
        tenantId: tenant.id,
        pipelineId: corretora.id,
        key: s.key,
        label: s.label,
        color: s.color,
        order: s.order,
        inKanban: s.inKanban,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      },
    })
  }
  console.log(`✔ board Corretora (${corretora.id}) + ${CORRETORA_STAGES.length} estágios`)

  // 3. Backfill: oportunidades sem board → Captação.
  const res = await prisma.opportunity.updateMany({
    where: { tenantId: tenant.id, pipelineId: null },
    data: { pipelineId: captacao.id },
  })
  console.log(`✔ backfill: ${res.count} oportunidade(s) → Captação`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
