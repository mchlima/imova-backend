// Vocabulário canônico de características/lazer dos empreendimentos (ADR 0010 §3.3).
// Fica em código (não é tabela). O backend valida `amenities` contra estes slugs;
// o meta-endpoint expõe rótulo/categoria para o front montar os filtros e a LP.

export interface AmenityDef {
  slug: string
  label: string
  category: 'lazer' | 'esporte' | 'pet' | 'conveniencia' | 'bem_estar' | 'estrutura'
}

export const AMENITIES: AmenityDef[] = [
  { slug: 'piscina_adulto', label: 'Piscina adulto', category: 'lazer' },
  { slug: 'piscina_infantil', label: 'Piscina infantil', category: 'lazer' },
  { slug: 'salao_festas', label: 'Salão de festas', category: 'lazer' },
  { slug: 'salao_jogos', label: 'Salão de jogos', category: 'lazer' },
  { slug: 'salao_multiuso', label: 'Salão multiuso', category: 'lazer' },
  { slug: 'churrasqueira', label: 'Churrasqueira', category: 'lazer' },
  { slug: 'espaco_gourmet', label: 'Espaço gourmet', category: 'lazer' },
  { slug: 'cinema', label: 'Cinema', category: 'lazer' },
  { slug: 'praca_fogo', label: 'Praça do fogo', category: 'lazer' },
  { slug: 'redario', label: 'Redário', category: 'lazer' },
  { slug: 'solarium', label: 'Solárium', category: 'lazer' },
  { slug: 'deck_molhado', label: 'Deck molhado', category: 'lazer' },
  { slug: 'espaco_bar', label: 'Espaço bar', category: 'lazer' },
  { slug: 'sport_bar', label: 'Sport bar', category: 'lazer' },
  { slug: 'espaco_camarote', label: 'Espaço camarote', category: 'lazer' },
  { slug: 'espaco_influencer', label: 'Espaço influencer', category: 'lazer' },

  { slug: 'quadra', label: 'Quadra', category: 'esporte' },
  { slug: 'fitness', label: 'Academia / fitness', category: 'esporte' },
  { slug: 'ginastica_externa', label: 'Ginástica externa', category: 'esporte' },
  { slug: 'playground', label: 'Playground', category: 'esporte' },
  { slug: 'brinquedoteca', label: 'Brinquedoteca', category: 'esporte' },

  { slug: 'pet_place', label: 'Pet place', category: 'pet' },
  { slug: 'pet_care', label: 'Pet care', category: 'pet' },
  { slug: 'pet_agility', label: 'Pet agility', category: 'pet' },

  { slug: 'coworking', label: 'Coworking', category: 'conveniencia' },
  { slug: 'mini_mercado', label: 'Mini mercado', category: 'conveniencia' },
  { slug: 'delivery', label: 'Espaço delivery', category: 'conveniencia' },
  { slug: 'bicicletario', label: 'Bicicletário', category: 'conveniencia' },
  { slug: 'lavanderia', label: 'Lavanderia', category: 'conveniencia' },

  { slug: 'espaco_bem_estar', label: 'Espaço bem-estar', category: 'bem_estar' },
  { slug: 'sala_massagem', label: 'Sala de massagem', category: 'bem_estar' },
  { slug: 'beauty_place', label: 'Beauty place', category: 'bem_estar' },
  { slug: 'atelie', label: 'Ateliê', category: 'bem_estar' },
  { slug: 'sala_funcional', label: 'Sala funcional', category: 'bem_estar' },

  { slug: 'elevador', label: 'Elevador', category: 'estrutura' },
  { slug: 'portaria_24h', label: 'Portaria 24h', category: 'estrutura' },
  { slug: 'gerador', label: 'Gerador', category: 'estrutura' },
  { slug: 'acessibilidade', label: 'Acessibilidade', category: 'estrutura' },
]

export const AMENITY_SLUGS: string[] = AMENITIES.map((a) => a.slug)
const AMENITY_SET = new Set(AMENITY_SLUGS)
export const isAmenity = (slug: string) => AMENITY_SET.has(slug)
