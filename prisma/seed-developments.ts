import {
  PrismaClient,
  DevelopmentRegiao,
  DevelopmentStatus,
  DevelopmentImageKind,
} from '@prisma/client'

const prisma = new PrismaClient()

// Seed do primeiro empreendimento real (ADR 0010) — migra o registro que vivia
// em imova-site/app/data/empreendimentos.ts (Ares do Horto — fase Pau Brasil).
// Idempotente: re-executar atualiza o registro e recria tipologias/imagens.
//
// Obs.: as imagens apontam para os assets JÁ hospedados no site
// (imova-site/public/img/empreendimentos/ares-do-horto/*) — storageKey vazio,
// pois não estão no R2. Quem quiser geri-las no R2 reenvia pelo admin.

const SLUG = 'ares-do-horto'
const IMG_BASE = '/img/empreendimentos/ares-do-horto'

const AMENITIES = [
  'piscina_adulto', 'piscina_infantil', 'fitness', 'churrasqueira', 'praca_fogo',
  'playground', 'brinquedoteca', 'pet_place', 'pet_care', 'espaco_bem_estar',
  'coworking', 'delivery', 'mini_mercado', 'atelie', 'salao_festas', 'salao_jogos',
  'redario',
]

const LAZER: { file: string; caption: string }[] = [
  { file: 'praca-do-fogo.webp', caption: 'Praça do fogo' },
  { file: 'playground.webp', caption: 'Playground' },
  { file: 'pet.webp', caption: 'Espaço pet' },
  { file: 'piquenique.webp', caption: 'Espaço piquenique' },
  { file: 'churrasqueira.webp', caption: 'Churrasqueira' },
  { file: 'fitness.webp', caption: 'Fitness' },
  { file: 'bem-estar.webp', caption: 'Espaço bem-estar' },
  { file: 'brinquedoteca.webp', caption: 'Brinquedoteca' },
  { file: 'mini-mercado.webp', caption: 'Mini mercado' },
  { file: 'pet-care.webp', caption: 'Pet care' },
  { file: 'delivery.webp', caption: 'Delivery' },
  { file: 'bricolagem.webp', caption: 'Ateliê / bricolagem' },
]

// tipologias: cada uma é uma planta com suas próprias características.
// terraco = "Varanda" na LP. Área/preço sob consulta nesta fase.
const TYPOLOGIES: {
  label: string
  bedrooms: number
  terraco: boolean
  areaMin: number
  areaMax: number
  planta: string
}[] = [
  { label: '2 dormitórios', bedrooms: 2, terraco: false, areaMin: 31, areaMax: 33, planta: 'planta-2-dorms.webp' },
  { label: '2 dormitórios com varanda', bedrooms: 2, terraco: true, areaMin: 33, areaMax: 35, planta: 'planta-2-dorms-terraco.webp' },
]

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'imova' },
    update: {},
    create: { slug: 'imova', name: 'ReveLar' },
  })
  const tenantId = tenant.id

  const scalars = {
    name: 'Ares do Horto',
    construtora: 'Plano&Plano',
    tipo: 'apartamentos',
    descricao:
      'Ares do Horto, da Plano&Plano, é um bairro planejado no Horto do Ipê, zona sul de São Paulo, ' +
      'entregue em fases — cada condomínio com lazer, preço e prazo próprios. O Condomínio Pau Brasil ' +
      'é a fase em breve lançamento: apartamentos de 2 dormitórios enquadrados no Minha Casa Minha Vida ' +
      '(Habitação de Interesse Social), com subsídio de até R$ 55 mil e uso do FGTS na entrada — ' +
      'condições pensadas para quem quer sair do aluguel. Lazer completo com piscina, fitness, ' +
      'espaço bem-estar, brinquedoteca, espaço pet e mais, na Estrada do Campo Limpo.',
    masterplanName: 'Ares do Horto',
    masterplanSlug: 'ares-do-horto',
    uf: 'SP',
    cidade: 'São Paulo',
    cidadeSlug: 'sao-paulo',
    bairro: 'Horto do Ipê',
    bairroSlug: 'horto-do-ipe',
    regiao: DevelopmentRegiao.zona_sul,
    endereco: 'Estrada do Campo Limpo, 1501 — Horto do Ipê',
    lat: -23.629,
    lng: -46.7689,
    status: DevelopmentStatus.lancamento,
    priceFrom: 234592,
    programa: 'Minha Casa Minha Vida (HIS)',
    aceitaFgts: true,
    subsidioAte: 55000,
    // tetos HIS/HMP (Prefeitura de SP) — montam o selo dinâmico na LP
    tetoHis1: 276102,
    tetoHis2: 383636,
    tetoHmp: 537672,
    amenities: AMENITIES,
    seoTitle: 'Ares do Horto — Apartamentos 2 dormitórios no Horto do Ipê (SP) | ReveLar',
    seoDescription:
      'Ares do Horto (Plano&Plano): apartamentos de 2 dormitórios no Horto do Ipê, São Paulo, ' +
      'a partir de R$ 234.592. Simule o financiamento e fale com um corretor parceiro.',
    // facetas (2 dorms, área/preço sob consulta)
    bedroomsMin: 2,
    bedroomsMax: 2,
    parkingMax: 0,
    areaMin: 31,
    areaMax: 35,
    suitesMax: 0,
    published: true,
  }

  const dev = await prisma.development.upsert({
    where: { tenantId_slug: { tenantId, slug: SLUG } },
    update: scalars,
    create: {
      tenantId,
      slug: SLUG,
      firstPublishedAt: new Date(),
      publishedAt: new Date(),
      ...scalars,
    },
  })

  // recria filhos (idempotente)
  await prisma.developmentTypology.deleteMany({ where: { developmentId: dev.id } })
  await prisma.developmentImage.deleteMany({ where: { developmentId: dev.id } })

  await prisma.developmentTypology.createMany({
    data: TYPOLOGIES.map((t, i) => ({
      developmentId: dev.id,
      label: t.label,
      bedrooms: t.bedrooms,
      areaMin: t.areaMin,
      areaMax: t.areaMax,
      priceFrom: null,
      parking: null,
      terraco: t.terraco,
      order: i,
      imageUrl: `${IMG_BASE}/${t.planta}`,
      imageStorageKey: '', // asset hospedado no site, não no R2
    })),
  })

  const images = [
    { file: 'piscina.webp', caption: 'Piscina adulto e infantil', kind: DevelopmentImageKind.hero },
    ...LAZER.map((l) => ({ ...l, kind: DevelopmentImageKind.lazer })),
  ]
  await prisma.developmentImage.createMany({
    data: images.map((img, i) => ({
      developmentId: dev.id,
      storageKey: '', // asset hospedado no site, não no R2
      url: `${IMG_BASE}/${img.file}`,
      kind: img.kind,
      caption: img.caption,
      order: i,
    })),
  })

  console.log(`✔ Empreendimento semeado: ${dev.name} (/${dev.slug}) — ${images.length} imagens`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
