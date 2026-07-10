import {
  PrismaClient,
  DevelopmentRegiao,
  DevelopmentStatus,
  DevelopmentImageKind,
} from '@prisma/client'

const prisma = new PrismaClient()

// Seed do Plano&Park Santo Amaro (Av. Guido Caloi, Santo Amaro — zona sul de SP).
// Dados da página oficial (ficha técnica) + galerias (geral e plantas). As plantas
// do zip não vinham identificadas: foram validadas pela página (nº de dorms, térreo
// e metragem por torre) e consolidadas nas tipologias comercializadas. Idempotente.
//
// ⚠️ lat/lng são ESTIMATIVA do endereço (ajustar no admin se necessário).

const SLUG = 'plano-park-santo-amaro'
const IMG_BASE = '/img/empreendimentos/plano-park-santo-amaro'

const AMENITIES = [
  'piscina_adulto', 'piscina_infantil', 'churrasqueira', 'playground', 'quadra',
  'redario', 'praca_fogo', 'salao_festas', 'salao_jogos', 'brinquedoteca',
  'espaco_bem_estar', 'espaco_influencer', 'sala_massagem', 'fitness', 'coworking',
  'delivery', 'mini_mercado', 'pet_care', 'bicicletario',
]

// galeria (perspectivas ilustradas — legendas da página oficial)
const LAZER: { file: string; caption: string }[] = [
  { file: 'piscina.webp', caption: 'Piscina' },
  { file: 'churrasqueira.webp', caption: 'Churrasqueira' },
  { file: 'playground.webp', caption: 'Playground' },
  { file: 'quadra.webp', caption: 'Quadra recreativa' },
  { file: 'brinquedoteca.webp', caption: 'Brinquedoteca' },
  { file: 'fitness.webp', caption: 'Fitness' },
  { file: 'coworking.webp', caption: 'Coworking' },
  { file: 'salao-festas.webp', caption: 'Salão de festas' },
  { file: 'salao-jogos.webp', caption: 'Salão de jogos' },
  { file: 'pet-care.webp', caption: 'Pet care' },
  { file: 'spa.webp', caption: 'Spa' },
  { file: 'bem-estar.webp', caption: 'Espaço bem-estar' },
  { file: 'lounge-lareira.webp', caption: 'Lounge lareira' },
  { file: 'redario.webp', caption: 'Redário' },
  { file: 'food-bike.webp', caption: 'Praça Food Bike' },
  { file: 'praca.webp', caption: 'Praça' },
  { file: 'bicicletario.webp', caption: 'Bicicletário' },
  { file: 'mini-mercado.webp', caption: 'Mini mercado' },
  { file: 'delivery.webp', caption: 'Espaço delivery' },
]

// tipologias comercializadas (ficha técnica). terraco = "Varanda" na LP.
const TYPOLOGIES: {
  label: string
  bedrooms: number
  terraco: boolean
  areaMin: number
  areaMax: number
  planta: string
}[] = [
  { label: '2 dormitórios', bedrooms: 2, terraco: false, areaMin: 35.8, areaMax: 36.64, planta: 'planta-2dorms.webp' },
  { label: '2 dormitórios (térreo)', bedrooms: 2, terraco: false, areaMin: 32.74, areaMax: 33.47, planta: 'planta-2dorms-terreo.webp' },
  { label: '1 dormitório', bedrooms: 1, terraco: true, areaMin: 26.87, areaMax: 27.34, planta: 'planta-1dorm.webp' },
  { label: '1 dormitório (térreo)', bedrooms: 1, terraco: false, areaMin: 24.53, areaMax: 25.38, planta: 'planta-1dorm-terreo.webp' },
]

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'imova' },
    update: {},
    create: { slug: 'imova', name: 'ReveLar' },
  })
  const tenantId = tenant.id

  const scalars = {
    name: 'Plano&Park Santo Amaro',
    construtora: 'Plano&Plano',
    tipo: 'apartamentos',
    descricao:
      'Plano&Park Santo Amaro, da Plano&Plano, fica na Av. Guido Caloi, em Santo Amaro, zona sul de ' +
      'São Paulo. São 4 torres e 799 unidades de 1 e 2 dormitórios (24,53 a 36,64 m²), enquadradas no ' +
      'Minha Casa Minha Vida (HIS-1, HIS-2 e HMP), com uso do FGTS na entrada e subsídio conforme a renda. ' +
      'Lazer completo com piscina adulto e infantil, quadra recreativa, fitness, coworking, spa, ' +
      'brinquedoteca, pet care, salão de festas, praça Food Bike e mais — condições pensadas para quem ' +
      'quer sair do aluguel na região de Santo Amaro.',
    masterplanName: 'Plano&Park Santo Amaro',
    masterplanSlug: 'plano-park-santo-amaro',
    uf: 'SP',
    cidade: 'São Paulo',
    cidadeSlug: 'sao-paulo',
    bairro: 'Santo Amaro',
    bairroSlug: 'santo-amaro',
    regiao: DevelopmentRegiao.zona_sul,
    endereco: 'Av. Guido Caloi, 1.062 — Santo Amaro',
    lat: -23.6552, // ESTIMATIVA — validar no admin
    lng: -46.7348,
    status: DevelopmentStatus.lancamento,
    priceFrom: 239900,
    programa: 'Minha Casa Minha Vida (HIS/HMP)',
    aceitaFgts: true,
    subsidioAte: 55000,
    // tetos HIS/HMP (Prefeitura de SP) — acionam o selo dinâmico na LP
    tetoHis1: 266000,
    tetoHis2: 369600,
    tetoHmp: 518000,
    // ficha técnica (página oficial)
    totalUnidades: 799,
    torres: 4,
    pavimentos: '16 pavimentos + térreo',
    arquitetura: 'Rodrigo Sobreiro Arquitetos',
    paisagismo: 'Núcleo Arquitetura da Paisagem',
    decoracao: 'Decore sem Segredos',
    incorporadora: 'Plano Candeias Empreendimentos Imobiliários Ltda',
    cnpj: '54.765.191/0001-01',
    registroIncorporacao: 'R.2 (12/12/2025) — matrícula nº 549.355, 11º Oficial de Registro de Imóveis de São Paulo',
    amenities: AMENITIES,
    seoTitle: 'Plano&Park Santo Amaro — Apartamentos 1 e 2 dormitórios em Santo Amaro (SP) | ReveLar',
    seoDescription:
      'Plano&Park Santo Amaro (Plano&Plano): apartamentos de 1 e 2 dormitórios de 24,53 a 36,64 m² em ' +
      'Santo Amaro, zona sul de São Paulo, a partir de R$ 239.900. MCMV (HIS/HMP), subsídio e uso do FGTS. ' +
      'Simule o financiamento e fale com um corretor.',
    // facetas
    bedroomsMin: 1,
    bedroomsMax: 2,
    parkingMax: 0,
    areaMin: 24.53,
    areaMax: 36.64,
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
      parking: null, // vaga não divulgada
      terraco: t.terraco,
      order: i,
      imageUrl: `${IMG_BASE}/${t.planta}`,
      imageStorageKey: '',
    })),
  })

  const images = [
    { file: 'fachada.webp', caption: 'Fachada', kind: DevelopmentImageKind.hero },
    ...LAZER.map((l) => ({ ...l, kind: DevelopmentImageKind.lazer })),
  ]
  await prisma.developmentImage.createMany({
    data: images.map((img, i) => ({
      developmentId: dev.id,
      storageKey: '',
      url: `${IMG_BASE}/${img.file}`,
      kind: img.kind,
      caption: img.caption,
      order: i,
    })),
  })

  console.log(
    `✔ Empreendimento semeado: ${dev.name} (/${dev.slug}) — ${TYPOLOGIES.length} plantas, ${images.length} imagens`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
