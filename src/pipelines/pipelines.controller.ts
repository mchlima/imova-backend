import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { PipelinesService } from './pipelines.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'
import { CreateStageDto, ReorderStagesDto, UpdateStageDto } from './dto/stage.dto'
import { UpdatePipelineDto } from './dto/pipeline.dto'

// Ler boards e estágios é parte de operar o kanban (opportunities:read). Alterar a
// estrutura do funil é configuração (pipelines:manage).
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  // Boards (pipelines) do tenant — abas do quadro de oportunidades.
  @Get('pipelines')
  @RequirePermissions('opportunities:read')
  listPipelines() {
    return this.pipelines.pipelines()
  }

  // Atualiza um board (rótulo, ordem, dono do board).
  @Patch('pipelines/:id')
  @RequirePermissions('pipelines:manage')
  updatePipeline(@Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.pipelines.updatePipeline(id, dto)
  }

  // Estágios do funil do tenant (para kanban, badges e gráficos do admin).
  @Get('stages')
  @RequirePermissions('opportunities:read')
  stages() {
    return this.pipelines.stages()
  }

  @Post('stages')
  @RequirePermissions('pipelines:manage')
  createStage(@Body() dto: CreateStageDto) {
    return this.pipelines.createStage(dto)
  }
  @Patch('stages/reorder')
  @RequirePermissions('pipelines:manage')
  reorderStages(@Body() dto: ReorderStagesDto) {
    return this.pipelines.reorderStages(dto)
  }
  @Patch('stages/:id')
  @RequirePermissions('pipelines:manage')
  updateStage(@Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.pipelines.updateStage(id, dto)
  }
  // moveTo (opcional): estágio de destino p/ migrar as oportunidades antes de excluir.
  @Delete('stages/:id')
  @RequirePermissions('pipelines:manage')
  deleteStage(@Param('id') id: string, @Query('moveTo') moveTo?: string) {
    return this.pipelines.deleteStage(id, moveTo)
  }
}
