import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

// Tenant inicial (o Meu Revelar) e o funil default como dado.
// Os estágios espelham os status que antes eram constantes no código.
// key === Opportunity.status (mantido igual para não migrar dados de status).
const TENANT = { slug: 'imova', name: 'Meu Revelar' }
const PIPELINE = { key: 'default', label: 'Funil de vendas' }
const STAGES = [
  { key: 'Lead', label: 'Lead', color: '#1E40AF', order: 1, inKanban: true },
  { key: 'Contatar', label: 'Contatar', color: '#B45309', order: 2, inKanban: true },
  { key: 'Qualificar', label: 'Qualificar', color: '#4338CA', order: 3, inKanban: true },
  { key: 'Repassado', label: 'Repassado', color: '#146c4e', order: 4, inKanban: false, isWon: true },
  { key: 'Perdido', label: 'Perdido', color: '#DC2626', order: 5, inKanban: false, isLost: true },
  // Nutrição: fora do funil ativo (interesse fora da área de atendimento).
  { key: 'Nutrição', label: 'Nutrição', color: '#6D28D9', order: 6, inKanban: false },
]

// Seções + campos personalizados espelhando os quadros hardcoded do drawer.
// key === chave no JSONB Opportunity.fields (e casa com as colunas atuais no backfill).
const FIELD_SECTIONS = [
  { key: 'qualificacao', label: 'Qualificação', order: 1 },
  { key: 'preferencias', label: 'Preferências do imóvel', order: 2 },
  { key: 'simulador', label: 'Simulador', order: 3 },
]
const FIELD_DEFINITIONS = [
  { section: 'simulador', key: 'uf', label: 'UF de interesse', type: 'text', options: [], order: 1 },
  { section: 'simulador', key: 'city', label: 'Cidade de interesse', type: 'text', options: [], order: 2 },
  { section: 'simulador', key: 'propertyValue', label: 'Valor do imóvel', type: 'money', options: [], order: 3 },
  { section: 'simulador', key: 'income', label: 'Renda familiar', type: 'money', options: [], order: 4 },
  { section: 'simulador', key: 'downPayment', label: 'Entrada', type: 'money', options: [], order: 5 },
  { section: 'simulador', key: 'fgts', label: 'FGTS', type: 'money', options: [], order: 6 },
  { section: 'simulador', key: 'interestRate', label: 'Taxa de juros (% a.a.)', type: 'number', options: [], order: 7 },
  { section: 'simulador', key: 'amortization', label: 'Tabela', type: 'select', options: ['SAC', 'Price'], order: 8 },
  { section: 'simulador', key: 'buyerType', label: 'Perfil', type: 'select', options: ['CPF', 'CNPJ'], order: 9 },
  { section: 'qualificacao', key: 'hasProperty', label: 'Já tem imóvel em vista?', type: 'select', options: ['Sim', 'Não'], order: 1 },
  { section: 'qualificacao', key: 'hasCredit', label: 'Aprovação de crédito', type: 'select', options: ['Sim', 'Em análise', 'Não'], order: 2 },
  { section: 'qualificacao', key: 'deadlineValue', label: 'Prazo de compra', type: 'number', options: [], order: 3 },
  { section: 'qualificacao', key: 'deadlineUnit', label: 'Unidade do prazo', type: 'select', options: ['meses', 'anos'], order: 4 },
  { section: 'preferencias', key: 'propertyType', label: 'Tipo', type: 'select', options: ['Casa', 'Apartamento', 'Terreno', 'Outro'], order: 1 },
  { section: 'preferencias', key: 'purpose', label: 'Finalidade', type: 'select', options: ['Moradia', 'Investimento'], order: 2 },
  { section: 'preferencias', key: 'bedrooms', label: 'Quartos', type: 'text', options: [], order: 3 },
  { section: 'preferencias', key: 'parkingSpots', label: 'Vagas', type: 'text', options: [], order: 4 },
  { section: 'preferencias', key: 'neighborhoods', label: 'Bairros / regiões de interesse', type: 'text', options: [], order: 5 },
  { section: 'preferencias', key: 'needs', label: 'Necessidades e preferências', type: 'textarea', options: [], order: 6 },
]

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT.slug },
    update: { name: TENANT.name },
    create: TENANT,
  })
  console.log(`✔ tenant ${tenant.slug}`)

  const pipeline = await prisma.pipeline.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: PIPELINE.key } },
    update: { label: PIPELINE.label },
    create: { tenantId: tenant.id, key: PIPELINE.key, label: PIPELINE.label },
  })
  console.log(`✔ pipeline ${pipeline.key}`)

  for (const s of STAGES) {
    await prisma.stage.upsert({
      where: {
        tenantId_pipelineId_key: { tenantId: tenant.id, pipelineId: pipeline.id, key: s.key },
      },
      update: {
        label: s.label,
        color: s.color,
        order: s.order,
        inKanban: s.inKanban,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      },
      create: {
        tenantId: tenant.id,
        pipelineId: pipeline.id,
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
  console.log(`✔ ${STAGES.length} stages`)

  // seções + campos personalizados
  const sectionIds: Record<string, string> = {}
  for (const s of FIELD_SECTIONS) {
    const sec = await prisma.fieldSection.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: s.key } },
      update: { label: s.label, order: s.order },
      create: { tenantId: tenant.id, key: s.key, label: s.label, order: s.order },
    })
    sectionIds[s.key] = sec.id
  }
  for (const f of FIELD_DEFINITIONS) {
    await prisma.fieldDefinition.upsert({
      where: {
        tenantId_sectionId_key: { tenantId: tenant.id, sectionId: sectionIds[f.section], key: f.key },
      },
      update: { label: f.label, type: f.type, options: f.options, order: f.order },
      create: {
        tenantId: tenant.id,
        sectionId: sectionIds[f.section],
        key: f.key,
        label: f.label,
        type: f.type,
        options: f.options,
        order: f.order,
      },
    })
  }
  console.log(`✔ ${FIELD_SECTIONS.length} seções, ${FIELD_DEFINITIONS.length} campos`)

  // API key de ingestão: gera uma se o tenant ainda não tiver nenhuma.
  // O texto puro só aparece AGORA (guardamos apenas o hash) — salve-o.
  const hasKey = await prisma.apiKey.findFirst({ where: { tenantId: tenant.id, revokedAt: null } })
  if (!hasKey) {
    const plain = `imova_${randomBytes(24).toString('hex')}`
    const hash = createHash('sha256').update(plain).digest('hex')
    await prisma.apiKey.create({ data: { tenantId: tenant.id, hash, label: 'ingestão inicial' } })
    console.log(`\n🔑 API key do tenant '${tenant.slug}' (salve, não será exibida de novo):`)
    console.log(`   ${plain}\n`)
  } else {
    console.log('✔ api key já existe (nenhuma nova gerada)')
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
