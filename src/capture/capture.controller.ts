import { Body, Controller, Post } from '@nestjs/common'
import { OpportunitiesService } from '../opportunities/opportunities.service'
import { TenantService } from '../tenant/tenant.service'
import { IngestDto } from '../ingest/dto/ingest.dto'

// Captura PÚBLICA (ex.: simulador do site). Genérica, sem regra de domínio:
// recebe { contact, fields, stageExternalId } e delega ao core. Quem chama (o site)
// decide o estágio — inclusive o roteamento de área (RMSP) vive no site.
// Resolve o tenant padrão desta instância (não usa API key, é público).
@Controller('capture')
export class CaptureController {
  constructor(
    private readonly opportunities: OpportunitiesService,
    private readonly tenant: TenantService,
  ) {}

  @Post()
  async capture(@Body() dto: IngestDto) {
    const tenantId = await this.tenant.currentId()
    return this.opportunities.ingest({
      tenantId,
      source: dto.source ?? 'capture',
      contact: dto.contact,
      fields: dto.fields,
      stageExternalId: dto.stageExternalId,
    })
  }
}
