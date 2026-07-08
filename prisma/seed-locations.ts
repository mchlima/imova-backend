import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Estados: nome, região e alíquota efetiva ESTIMADA de cartório (emolumentos) ──
// Emolumentos são tabela estadual progressiva; aqui aproximados por um % por estado.
const STATES: Record<string, { name: string; region: string; notaryRate: number }> = {
  AC: { name: 'Acre', region: 'Norte', notaryRate: 0.012 },
  AL: { name: 'Alagoas', region: 'Nordeste', notaryRate: 0.013 },
  AP: { name: 'Amapá', region: 'Norte', notaryRate: 0.012 },
  AM: { name: 'Amazonas', region: 'Norte', notaryRate: 0.012 },
  BA: { name: 'Bahia', region: 'Nordeste', notaryRate: 0.014 },
  CE: { name: 'Ceará', region: 'Nordeste', notaryRate: 0.012 },
  DF: { name: 'Distrito Federal', region: 'Centro-Oeste', notaryRate: 0.012 },
  ES: { name: 'Espírito Santo', region: 'Sudeste', notaryRate: 0.013 },
  GO: { name: 'Goiás', region: 'Centro-Oeste', notaryRate: 0.012 },
  MA: { name: 'Maranhão', region: 'Nordeste', notaryRate: 0.013 },
  MT: { name: 'Mato Grosso', region: 'Centro-Oeste', notaryRate: 0.012 },
  MS: { name: 'Mato Grosso do Sul', region: 'Centro-Oeste', notaryRate: 0.012 },
  MG: { name: 'Minas Gerais', region: 'Sudeste', notaryRate: 0.012 },
  PA: { name: 'Pará', region: 'Norte', notaryRate: 0.013 },
  PB: { name: 'Paraíba', region: 'Nordeste', notaryRate: 0.013 },
  PR: { name: 'Paraná', region: 'Sul', notaryRate: 0.013 },
  PE: { name: 'Pernambuco', region: 'Nordeste', notaryRate: 0.013 },
  PI: { name: 'Piauí', region: 'Nordeste', notaryRate: 0.013 },
  RJ: { name: 'Rio de Janeiro', region: 'Sudeste', notaryRate: 0.015 },
  RN: { name: 'Rio Grande do Norte', region: 'Nordeste', notaryRate: 0.013 },
  RS: { name: 'Rio Grande do Sul', region: 'Sul', notaryRate: 0.014 },
  RO: { name: 'Rondônia', region: 'Norte', notaryRate: 0.012 },
  RR: { name: 'Roraima', region: 'Norte', notaryRate: 0.012 },
  SC: { name: 'Santa Catarina', region: 'Sul', notaryRate: 0.012 },
  SP: { name: 'São Paulo', region: 'Sudeste', notaryRate: 0.013 },
  SE: { name: 'Sergipe', region: 'Nordeste', notaryRate: 0.013 },
  TO: { name: 'Tocantins', region: 'Norte', notaryRate: 0.012 },
}

const CAPITALS: Record<string, string> = {
  AC: 'Rio Branco', AL: 'Maceió', AP: 'Macapá', AM: 'Manaus', BA: 'Salvador',
  CE: 'Fortaleza', DF: 'Brasília', ES: 'Vitória', GO: 'Goiânia', MA: 'São Luís',
  MT: 'Cuiabá', MS: 'Campo Grande', MG: 'Belo Horizonte', PA: 'Belém',
  PB: 'João Pessoa', PR: 'Curitiba', PE: 'Recife', PI: 'Teresina',
  RJ: 'Rio de Janeiro', RN: 'Natal', RS: 'Porto Alegre', RO: 'Porto Velho',
  RR: 'Boa Vista', SC: 'Florianópolis', SP: 'São Paulo', SE: 'Aracaju', TO: 'Palmas',
}

// ITBI por cidade (estimativas para as principais; o resto cai no default abaixo).
const ITBI: Record<string, number> = {
  'SP:São Paulo': 0.03, 'SP:Campinas': 0.027, 'SP:Guarulhos': 0.02, 'SP:Santos': 0.02,
  'SP:São Bernardo do Campo': 0.02, 'RJ:Rio de Janeiro': 0.03, 'RJ:Niterói': 0.02,
  'MG:Belo Horizonte': 0.03, 'MG:Uberlândia': 0.02, 'RS:Porto Alegre': 0.03,
  'PR:Curitiba': 0.027, 'PR:Londrina': 0.02, 'PR:Maringá': 0.02, 'SC:Florianópolis': 0.02,
  'SC:Joinville': 0.02, 'BA:Salvador': 0.03, 'PE:Recife': 0.03, 'CE:Fortaleza': 0.02,
  'DF:Brasília': 0.03, 'GO:Goiânia': 0.02, 'ES:Vitória': 0.02,
}

interface IbgeMunicipio {
  id: number
  nome: string
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } }
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: string } } }
}

const ufOf = (m: IbgeMunicipio): string | undefined =>
  m.microrregiao?.mesorregiao?.UF?.sigla ??
  m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla

async function main() {
  console.log('Buscando municípios no IBGE…')
  const res = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
  )
  if (!res.ok) throw new Error(`IBGE retornou ${res.status}`)
  const municipios = (await res.json()) as IbgeMunicipio[]
  console.log(`Recebidos ${municipios.length} municípios.`)

  // limpa e recria
  await prisma.city.deleteMany()
  await prisma.state.deleteMany()

  await prisma.state.createMany({
    data: Object.entries(STATES).map(([uf, s]) => ({ uf, ...s })),
  })

  const rows = municipios
    .map((m) => {
      const uf = ufOf(m)
      if (!uf || !STATES[uf]) return null
      const isCapital = CAPITALS[uf] === m.nome
      const itbiRate = ITBI[`${uf}:${m.nome}`] ?? (isCapital ? 0.03 : 0.02)
      return { id: m.id, name: m.nome, uf, itbiRate, isCapital }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // insere em lotes
  const chunk = 1000
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.city.createMany({ data: rows.slice(i, i + chunk), skipDuplicates: true })
  }

  console.log(`✔ ${Object.keys(STATES).length} estados e ${rows.length} cidades semeados.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
