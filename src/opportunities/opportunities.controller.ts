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
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto'
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { SafeUser } from '../auth/auth.service'

@Controller('opportunities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  // A captura pública (simulador) fica no módulo capture. Aqui, só triagem (sessão).
  @Get()
  @RequirePermissions('opportunities:read')
  findAll() {
    return this.opportunities.findAll()
  }

  // Criação manual no admin (contato existente ou novo). Origem padrão = 'manual'.
  @Post()
  @RequirePermissions('opportunities:write')
  create(@Body() dto: CreateOpportunityDto, @CurrentUser() user: SafeUser) {
    return this.opportunities.createManual(dto, user.name)
  }

  // Agenda de follow-up: atividades pendentes de todas as oportunidades.
  @Get('activities/pending')
  @RequirePermissions('opportunities:read')
  pendingActivities() {
    return this.opportunities.pendingActivities()
  }

  @Get(':id')
  @RequirePermissions('opportunities:read')
  findOne(@Param('id') id: string) {
    return this.opportunities.findOne(id)
  }

  // Reordenação do kanban (em lote) — precisa vir ANTES de @Patch(':id').
  @Patch('reorder')
  @RequirePermissions('opportunities:write')
  reorder(@Body() dto: ReorderDto, @CurrentUser() user: SafeUser) {
    return this.opportunities.reorder(dto.items, user.name)
  }

  @Patch(':id')
  @RequirePermissions('opportunities:write')
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto, @CurrentUser() user: SafeUser) {
    return this.opportunities.update(id, dto, user.name)
  }

  // Move a oportunidade para outro board (ex.: "enviar para o board da corretora").
  @Post(':id/move-pipeline')
  @RequirePermissions('opportunities:write')
  moveToPipeline(@Param('id') id: string, @Body() dto: MovePipelineDto, @CurrentUser() user: SafeUser) {
    return this.opportunities.moveToPipeline(id, dto.pipelineId, dto.assigneeIds, user.name)
  }

  // Exclui a oportunidade (atividades caem em cascata; o contato permanece).
  @Delete(':id')
  @RequirePermissions('opportunities:delete')
  remove(@Param('id') id: string) {
    return this.opportunities.remove(id)
  }

  // ── atividades / histórico (CRM) ──
  @Post(':id/activities')
  @RequirePermissions('opportunities:write')
  addActivity(
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.opportunities.addActivity(id, dto, user.name)
  }

  @Patch(':id/activities/:activityId')
  @RequirePermissions('opportunities:write')
  updateActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.opportunities.updateActivity(id, activityId, dto)
  }

  @Delete(':id/activities/:activityId')
  @RequirePermissions('opportunities:write')
  removeActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
  ) {
    return this.opportunities.removeActivity(id, activityId)
  }

  // ── comentários internos (CRM) ──
  @Post(':id/comments')
  @RequirePermissions('opportunities:write')
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentUser() user: SafeUser) {
    return this.opportunities.addComment(id, dto, user)
  }

  @Patch(':id/comments/:commentId')
  @RequirePermissions('opportunities:write')
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.opportunities.updateComment(id, commentId, dto, user)
  }

  @Delete(':id/comments/:commentId')
  @RequirePermissions('opportunities:write')
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.opportunities.removeComment(id, commentId, user)
  }

  // ── tarefas (checklist) ──
  @Post(':id/tasks')
  @RequirePermissions('opportunities:write')
  addTask(@Param('id') id: string, @Body() dto: CreateTaskDto) {
    return this.opportunities.addTask(id, dto)
  }

  @Patch(':id/tasks/:taskId')
  @RequirePermissions('opportunities:write')
  updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.opportunities.updateTask(id, taskId, dto, user.name)
  }

  @Delete(':id/tasks/:taskId')
  @RequirePermissions('opportunities:write')
  removeTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    return this.opportunities.removeTask(id, taskId)
  }
}
