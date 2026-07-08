import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { readingTime } from './markdown'
import { HeartbeatDto, StartViewDto } from './dto/view.dto'

export const HEATMAP_BUCKETS = 20
const READ_RATIO = 0.4 // leu "de verdade" = tempo ativo ≥ 40% do tempo estimado
const BOUNCE_SECONDS = 10

@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra a abertura do artigo (a visualização nunca se perde). */
  async start(slug: string, dto: StartViewDto) {
    const post = await this.prisma.post.findFirst({
      where: { published: true, archived: false, publishedSlug: slug },
      select: { id: true },
    })
    if (!post) throw new NotFoundException('Conteúdo não encontrado.')
    const view = await this.prisma.postView.create({
      data: {
        postId: post.id,
        slug,
        sessionId: dto.sessionId ?? '',
        device: dto.device === 'mobile' ? 'mobile' : 'desktop',
        referrer: (dto.referrer ?? '').slice(0, 300),
        buckets: new Array(HEATMAP_BUCKETS).fill(0),
      },
      select: { id: true },
    })
    return { id: view.id }
  }

  /** Heartbeat idempotente: faz merge por MAX para não inflar em reenvios. */
  async heartbeat(id: string, dto: HeartbeatDto) {
    const view = await this.prisma.postView.findUnique({ where: { id } })
    if (!view) throw new NotFoundException('View não encontrada.')

    const prev = Array.isArray(view.buckets) ? (view.buckets as number[]) : []
    const incoming = Array.isArray(dto.buckets) ? dto.buckets : []
    const buckets = new Array(HEATMAP_BUCKETS).fill(0).map((_, i) => {
      const a = Number(prev[i]) || 0
      const b = Math.max(0, Math.min(Number(incoming[i]) || 0, 86400))
      return Math.max(a, b)
    })

    await this.prisma.postView.update({
      where: { id },
      data: {
        activeSeconds: Math.max(view.activeSeconds, Math.min(dto.activeSeconds | 0, 86400)),
        maxScroll: Math.max(view.maxScroll, Math.min(Math.max(dto.maxScroll | 0, 0), 100)),
        buckets,
      },
    })
    return { ok: true }
  }

  /** Métricas agregadas de um post (para o editor do admin). */
  async postAnalytics(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { body: true, publishedSnapshot: true },
    })
    if (!post) throw new NotFoundException('Post não encontrado.')

    const rows = await this.prisma.postView.findMany({
      where: { postId },
      select: { activeSeconds: true, maxScroll: true, buckets: true },
    })

    const estMin =
      (post.publishedSnapshot as { readingTime?: number } | null)?.readingTime ??
      readingTime(post.body)
    const estSeconds = estMin * 60

    const views = rows.length
    if (views === 0) {
      return {
        views: 0,
        estimatedReadingMinutes: estMin,
        medianActiveSeconds: 0,
        avgActiveSeconds: 0,
        readRate: 0,
        bounceRate: 0,
        avgScrollDepth: 0,
        heatmap: new Array(HEATMAP_BUCKETS).fill(0),
      }
    }

    const times = rows.map((r) => r.activeSeconds).sort((a, b) => a - b)
    const mid = Math.floor(times.length / 2)
    const median = times.length % 2 ? times[mid]! : Math.round((times[mid - 1]! + times[mid]!) / 2)
    const avg = Math.round(times.reduce((s, t) => s + t, 0) / views)
    const reads = rows.filter((r) => r.activeSeconds >= estSeconds * READ_RATIO).length
    const bounces = rows.filter((r) => r.activeSeconds < BOUNCE_SECONDS).length
    const avgScroll = Math.round(rows.reduce((s, r) => s + r.maxScroll, 0) / views)

    // mapa de calor: média de segundos ativos por faixa de scroll
    const heat = new Array(HEATMAP_BUCKETS).fill(0)
    for (const r of rows) {
      const b = Array.isArray(r.buckets) ? (r.buckets as number[]) : []
      for (let i = 0; i < HEATMAP_BUCKETS; i++) heat[i] += Number(b[i]) || 0
    }
    const heatmap = heat.map((s) => Math.round((s / views) * 10) / 10)

    return {
      views,
      estimatedReadingMinutes: estMin,
      medianActiveSeconds: median,
      avgActiveSeconds: avg,
      readRate: Math.round((reads / views) * 100),
      bounceRate: Math.round((bounces / views) * 100),
      avgScrollDepth: avgScroll,
      heatmap,
    }
  }

  /** Total de visualizações por post (para o dashboard do CMS). */
  async overview() {
    const grouped = await this.prisma.postView.groupBy({
      by: ['postId'],
      _count: { _all: true },
      _sum: { activeSeconds: true },
    })
    const total = grouped.reduce((s, g) => s + g._count._all, 0)
    const byPost: Record<string, number> = {}
    for (const g of grouped) byPost[g.postId] = g._count._all
    return { totalViews: total, byPost }
  }
}
