import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Armazenamento PRIVADO de documentos de leads no Cloudflare R2 (bucket imova-leads).
// Diferente do R2Service (bucket público de imagens): aqui não há URL pública — o
// acesso é sempre via URL pré-assinada de curta duração, gerada pelo backend atrás do JWT.
@Injectable()
export class LeadsStorageService {
  private readonly logger = new Logger(LeadsStorageService.name)
  private readonly bucket: string
  private readonly client: S3Client | null

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID')
    // credenciais dedicadas do bucket privado (fallback: as da conta usadas no bucket público)
    const accessKeyId =
      config.get<string>('R2_LEADS_ACCESS_KEY_ID') || config.get<string>('R2_ACCESS_KEY_ID')
    const secretAccessKey =
      config.get<string>('R2_LEADS_SECRET_ACCESS_KEY') || config.get<string>('R2_SECRET_ACCESS_KEY')
    this.bucket = config.get<string>('R2_LEADS_BUCKET', 'imova-leads')

    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    } else {
      this.client = null
      this.logger.warn('R2 (leads) não configurado — defina R2_LEADS_BUCKET e as credenciais R2.')
    }
  }

  get configured(): boolean {
    return !!this.client
  }

  private ensure(): S3Client {
    if (!this.client) throw new InternalServerErrorException('Armazenamento de documentos não configurado.')
    return this.client
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.ensure().send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    )
  }

  // URL temporária para ver/baixar o objeto. `download` força o download com o nome original;
  // caso contrário abre inline (o navegador renderiza PDF/imagem).
  async signedUrl(key: string, fileName: string, download: boolean, ttlSeconds = 300): Promise<string> {
    const disposition = `${download ? 'attachment' : 'inline'}; filename="${fileName.replace(/"/g, '')}"`
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: disposition,
    })
    // cast: incompatibilidade só de TIPOS entre versões do @smithy (runtime é compatível)
    return getSignedUrl(this.ensure() as never, command as never, { expiresIn: ttlSeconds })
  }

  async remove(key?: string | null): Promise<void> {
    if (!this.client || !key) return
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (e) {
      this.logger.warn(`Falha ao remover objeto R2 "${key}": ${(e as Error).message}`)
    }
  }
}
