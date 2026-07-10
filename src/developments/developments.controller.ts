import { Controller, Get, Param, Query } from '@nestjs/common'
import { DevelopmentRegiao, DevelopmentStatus } from '@prisma/client'
import { DevelopmentsService } from './developments.service'
import { DevelopmentFilterDto } from './dto/development.dto'
import { AMENITIES } from './amenities'

// Catálogo público de empreendimentos (só publicados). Sem guard.
@Controller('developments')
export class DevelopmentsController {
  constructor(private readonly developments: DevelopmentsService) {}

  // metadados p/ o front montar filtros/rótulos (características, regiões, estágios)
  @Get('meta')
  meta() {
    return {
      amenities: AMENITIES,
      regioes: Object.values(DevelopmentRegiao),
      statuses: Object.values(DevelopmentStatus),
    }
  }

  // bairros distintos (select pesquisável do catálogo)
  @Get('bairros')
  bairros() {
    return this.developments.bairros()
  }

  @Get()
  list(@Query() filter: DevelopmentFilterDto) {
    return this.developments.listPublished(filter)
  }

  // deixado por último: não capturar 'meta'/'bairros' como slug
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.developments.getPublishedBySlug(slug)
  }
}
