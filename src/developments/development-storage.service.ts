import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { R2Service } from '../cms/r2.service'

export interface UploadedImage {
  buffer: Buffer
  mimetype: string
  size: number
}

export type ImageKind = 'hero' | 'lazer' | 'planta'

// Gestão dos arquivos de empreendimento no R2 (bucket público), com prefixo
// determinístico por empreendimento e transcodificação para WebP — para conter
// espaço no tier grátis e permitir varredura/deleção em lote (ADR 0010 §4).
@Injectable()
export class DevelopmentStorageService {
  private readonly logger = new Logger(DevelopmentStorageService.name)
  // teto de dimensão (px) — evita guardar renders gigantes
  private readonly MAX_DIM = 2000

  constructor(private readonly r2: R2Service) {}

  private prefix(tenantId: string, developmentId: string) {
    return `developments/${tenantId}/${developmentId}/`
  }

  /**
   * Transcodifica p/ WebP e sobe ao R2. Retorna a chave e a URL pública.
   * NÃO cria a linha no banco — quem chama grava a linha e, se falhar, chama
   * `remove(key)` (compensação) para não deixar órfão.
   */
  async upload(
    tenantId: string,
    developmentId: string,
    kind: ImageKind,
    file: UploadedImage,
  ): Promise<{ key: string; url: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo de imagem ausente.')
    if (!file.mimetype.startsWith('image/'))
      throw new BadRequestException('O arquivo precisa ser uma imagem.')

    let body: Buffer
    try {
      body = await sharp(file.buffer)
        .rotate() // respeita EXIF
        .resize({ width: this.MAX_DIM, height: this.MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
    } catch (e) {
      this.logger.warn(`Falha ao transcodificar imagem: ${(e as Error).message}`)
      throw new BadRequestException('Imagem inválida ou corrompida.')
    }

    const key = `${this.prefix(tenantId, developmentId)}${kind}/${randomUUID()}.webp`
    const url = await this.r2.upload(key, body, 'image/webp')
    return { key, url }
  }

  /** Remove um objeto pela chave (usado em troca/exclusão de imagem e na compensação). */
  async remove(key?: string | null): Promise<void> {
    await this.r2.remove(key)
  }

  /** Remove TUDO do empreendimento no R2 (chamado ao excluí-lo). */
  async removeAll(tenantId: string, developmentId: string): Promise<number> {
    return this.r2.removeByPrefix(this.prefix(tenantId, developmentId))
  }

  /**
   * Reconciliação sob demanda: apaga do R2 os objetos deste empreendimento que
   * não têm linha correspondente (`knownKeys` = storageKeys no banco).
   */
  async reconcile(
    tenantId: string,
    developmentId: string,
    knownKeys: string[],
  ): Promise<{ removed: number; keys: string[] }> {
    const known = new Set(knownKeys)
    const all = await this.r2.listKeys(this.prefix(tenantId, developmentId))
    const orphans = all.filter((k) => !known.has(k))
    await this.r2.removeMany(orphans)
    return { removed: orphans.length, keys: orphans }
  }

  /** Reconciliação de TODOS os empreendimentos do tenant (varre o prefixo do tenant). */
  async reconcileTenant(
    tenantId: string,
    knownKeys: string[],
  ): Promise<{ removed: number; keys: string[] }> {
    const known = new Set(knownKeys)
    const all = await this.r2.listKeys(`developments/${tenantId}/`)
    const orphans = all.filter((k) => !known.has(k))
    await this.r2.removeMany(orphans)
    return { removed: orphans.length, keys: orphans }
  }
}
