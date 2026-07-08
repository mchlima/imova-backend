import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

// Armazenamento de imagens no Cloudflare R2 (S3-compatível), bucket imova-public.
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name)
  private readonly bucket: string
  private readonly publicBase: string
  private readonly client: S3Client | null

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID')
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID')
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY')
    this.bucket = config.get<string>('R2_BUCKET', 'imova-public')
    this.publicBase = (config.get<string>('R2_PUBLIC_BASE', '') || '').replace(/\/+$/, '')

    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    } else {
      this.client = null
      this.logger.warn('R2 não configurado (defina R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).')
    }
  }

  get configured(): boolean {
    return !!this.client
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client) throw new InternalServerErrorException('Armazenamento de imagens não configurado.')
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return this.publicUrl(key)
  }

  /** Remove um objeto. Silencioso se a chave for vazia ou já não existir. */
  async remove(key?: string | null): Promise<void> {
    if (!this.client || !key) return
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (e) {
      this.logger.warn(`Falha ao remover objeto R2 "${key}": ${(e as Error).message}`)
    }
  }
}
