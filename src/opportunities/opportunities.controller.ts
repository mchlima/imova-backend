import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { OpportunitiesService } from './opportunities.service'
import { UpdateOpportunityDto } from './dto/update-opportunity.dto'
import { CreateOpportunityDto } from './dto/create-opportunity.dto'
import { MovePipelineDto } from './dto/move-pipeline.dto'
import { ReorderDto } from './dto/reorder.dto'
import { CreateActivityDto } from './dto/create-activity.dto'
import { UpdateActivityDto } from './dto/update-activity.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { SafeUser } from '../auth/auth.service'

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  // A captura pública (simulador) fica no módulo capture. Aqui, só triagem (sessão).
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.opportunities.findAll()
  }

  // Criação manual no admin (contato existente ou novo). Origem padrão = 'manual'.
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunities.createManual(dto)
  }

  // Agenda de follow-up: atividades pendentes de todas as oportunidades.
  @Get('activities/pending')
  @UseGuards(JwtAuthGuard)
  pendingActivities() {
    return this.opportunities.pendingActivities()
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.opportunities.findOne(id)
  }

  // Reordenação do kanban (em lote) — precisa vir ANTES de @Patch(':id').
  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  reorder(@Body() dto: ReorderDto) {
    return this.opportunities.reorder(dto.items)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunities.update(id, dto)
  }

  // Move a oportunidade para outro board (ex.: "enviar para o board da corretora").
  @Post(':id/move-pipeline')
  @UseGuards(JwtAuthGuard)
  moveToPipeline(@Param('id') id: string, @Body() dto: MovePipelineDto) {
    return this.opportunities.moveToPipeline(id, dto.pipelineId, dto.assigneeIds)
  }

  // Exclui a oportunidade (atividades caem em cascata; o contato permanece).
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.opportunities.remove(id)
  }

  // ── atividades / histórico (CRM) ──
  @Post(':id/activities')
  @UseGuards(JwtAuthGuard)
  addActivity(
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.opportunities.addActivity(id, dto, user.name)
  }

  @Patch(':id/activities/:activityId')
  @UseGuards(JwtAuthGuard)
  updateActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.opportunities.updateActivity(id, activityId, dto)
  }

  @Delete(':id/activities/:activityId')
  @UseGuards(JwtAuthGuard)
  removeActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
  ) {
    return this.opportunities.removeActivity(id, activityId)
  }
}
