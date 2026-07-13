import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common'
import { LocationsService } from './locations.service'
import { UpdateStateRateDto, UpdateCityRateDto } from './dto/update-rates.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  // ── Público: usado pelo simulador (site) e pelos filtros do admin ──
  @Get('states')
  states() {
    return this.locations.states()
  }

  @Get('cities')
  cities(@Query('uf') uf?: string) {
    if (!uf) throw new BadRequestException('Informe a UF (?uf=SP).')
    return this.locations.cities(uf)
  }

  // ── Protegido: edição de taxas no admin ──
  @Patch('states/:uf')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('locations:manage')
  updateStateRate(@Param('uf') uf: string, @Body() dto: UpdateStateRateDto) {
    return this.locations.updateStateRate(uf, dto.notaryRate)
  }

  @Patch('cities/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('locations:manage')
  updateCityRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCityRateDto,
  ) {
    return this.locations.updateCityRate(id, dto.itbiRate)
  }
}
