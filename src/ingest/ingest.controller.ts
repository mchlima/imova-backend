import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { OpportunitiesService } from '../opportunities/opportunities.service'
import { ApiKeyGuard } from './api-key.guard'
import { IngestDto } from './dto/ingest.dto'

// Fronteira de ingestão do CRM para projetos externos (server-to-server).
// O Meu Revelar, sendo o host, usa o POST /opportunities interno; outros projetos
// mandam pra cá com a API key do seu tenant.
@Controller('ingest')
export class IngestController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  ingest(@Body() dto: IngestDto, @Req() req: { tenantId: string }) {
    return this.opportunities.ingest({
      tenantId: req.tenantId,
      source: dto.source,
      contact: dto.contact,
      fields: dto.fields,
      stageExternalId: dto.stageExternalId,
    })
  }
}
