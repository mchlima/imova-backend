import MarkdownIt from 'markdown-it'

// html:false → não permite HTML cru no markdown (autores internos, mas mantém seguro).
const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

export function renderMarkdown(src: string): string {
  return md.render(src || '')
}

// Tempo de leitura estimado (min), ~200 palavras/min.
export function readingTime(src: string): number {
  const words = (src || '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
