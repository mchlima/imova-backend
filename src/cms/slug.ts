// Stopwords PT-BR removidas dos slugs (apenas tokens isolados).
// Variantes com acento (à, às) caem nas sem acento (a, as) após a normalização.
const STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das',
  'e', 'ou', 'o', 'a', 'os', 'as',
  'um', 'uma', 'uns', 'umas',
  'no', 'na', 'nos', 'nas',
  'em', 'com', 'por', 'para', 'pra',
  'que', 'ao', 'aos',
])

export function slugify(input: string): string {
  const tokens =
    (input || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []

  const filtered = tokens.filter((t) => !STOPWORDS.has(t))
  // se sobrar vazio (ex.: título só com stopwords), mantém os tokens originais
  return (filtered.length ? filtered : tokens).join('-')
}
