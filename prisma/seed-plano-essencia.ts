import {
  PrismaClient,
  DevelopmentRegiao,
  DevelopmentStatus,
  DevelopmentImageKind,
} from '@prisma/client'

const prisma = new PrismaClient()

// Seed do Plano&Essência (Rio Pequeno, zona oeste de SP) — Plano&Plano.
// Dados extraídos do Book de Mesa Preliminar + página oficial. Idempotente:
// re-executar atualiza o registro e recria tipologias/imagens.
//
// Imagens de lazer/fachada: assets hospedados no site (public/img); plantas
// recortadas do book. storageKey vazio (não estão no R2).

const SLUG = 'plano-essencia'
const IMG_BASE = '/img/empreendimentos/plano-essencia'

const AMENITIES = [
  'piscina_adulto', 'piscina_infantil', 'churrasqueira', 'quadra', 'playground',
  'coworking', 'salao_festas', 'salao_jogos', 'espaco_influencer', 'pet_care',
  'espaco_bem_estar', 'fitness', 'sala_funcional', 'brinquedoteca', 'delivery',
  'mini_mercado', 'bicicletario',
]

// itens de lazer com foto (fachada/hero + perspectivas)
const LAZER: { file: string; caption: string }[] = [
  { file: 'piscina.webp', caption: 'Piscina' },
  { file: 'fitness.webp', caption: 'Fitness' },
  { file: 'salao-festas.webp', caption: 'Salão de festas' },
]

// tipologias: cada planta com metragem exata (do book). 2 dorms, com opção de
// vaga e varanda. areaMin === areaMax (metragem exata da planta).
const TYPOLOGIES: {
  label: string
  area: number
  planta: string
}[] = [
  { label: '2 dormitórios', area: 31.71, planta: 'planta-31.webp' },
  { label: '2 dormitórios', area: 32.7, planta: 'planta-32.webp' },
  { label: '2 dormitórios', area: 34.43, planta: 'planta-34.webp' },
]

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'imova' },
    update: {},
    create: { slug: 'imova', name: 'ReveLar' },
  })
  const tenantId = tenant.id

  const scalars = {
    name: 'Plano&Essência',
    construtora: 'Plano&Plano',
    tipo: 'apartamentos',
    descricao:
      'Plano&Essência, da Plano&Plano, fica no Rio Pequeno, zona oeste de São Paulo, a poucos ' +
      'minutos do Eixo Butantã, da USP, do Raposo Shopping e da Rodovia Raposo Tavares. São 3 torres ' +
      'e 954 unidades de 2 dormitórios (31,71 a 34,53 m²), enquadradas no Minha Casa Minha Vida ' +
      '(Habitação de Interesse Social), com subsídio de até R$ 55 mil e uso do FGTS na entrada. ' +
      'Lazer completo com piscina adulto e infantil, fitness, coworking, ' +
      'espaço influencer, brinquedoteca, pet care, salão de festas e mais, na Rua Paulo da Silva.',
    masterplanName: 'Plano&Essência',
    masterplanSlug: 'plano-essencia',
    uf: 'SP',
    cidade: 'São Paulo',
    cidadeSlug: 'sao-paulo',
    bairro: 'Rio Pequeno',
    bairroSlug: 'rio-pequeno',
    regiao: DevelopmentRegiao.zona_oeste,
    endereco: 'Rua Paulo da Silva, 199 — Rio Pequeno',
    status: DevelopmentStatus.breve_lancamento,
    priceFrom: 208367,
    programa: 'Minha Casa Minha Vida (HIS)',
    aceitaFgts: true,
    subsidioAte: 55000,
    amenities: AMENITIES,
    // tetos HIS (Prefeitura de SP) — aciona o selo HIS na LP
    tetoHis1: 276102,
    tetoHis2: 383636,
    totalUnidades: 954,
    torres: 3,
    arquitetura: 'RS',
    paisagismo: 'Marcelo Novaes',
    decoracao: 'Interno P&P',
    incorporadora: 'Plano Timbó Empreendimentos Imobiliários Ltda',
    cnpj: '48.505.478/0001-08',
    seoTitle: 'Plano&Essência — Apartamentos 2 dormitórios no Rio Pequeno (SP) | ReveLar',
    seoDescription:
      'Plano&Essência (Plano&Plano): apartamentos de 2 dormitórios no Rio Pequeno, zona oeste de ' +
      'São Paulo, a partir de R$ 208.367. MCMV, subsídio de até R$ 55 mil e uso do FGTS. Simule e fale com um corretor.',
    // facetas
    bedroomsMin: 2,
    bedroomsMax: 2,
    parkingMax: 0, // vaga opcional/limitada — não exibida no site
    areaMin: 31.71,
    areaMax: 34.53,
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
      bedrooms: 2,
      areaMin: t.area,
      areaMax: t.area,
      priceFrom: null,
      parking: null, // vaga opcional/limitada — não exibida
      terraco: false, // varanda opcional
      order: i,
      imageUrl: `${IMG_BASE}/${t.planta}`,
      imageStorageKey: '',
    })),
  })

  const images = [
    { file: 'portaria.webp', caption: 'Portaria', kind: DevelopmentImageKind.hero },
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
