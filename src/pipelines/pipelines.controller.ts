import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { PipelinesService } from './pipelines.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateStageDto, ReorderStagesDto, UpdateStageDto } from './dto/stage.dto'
import { UpdatePipelineDto } from './dto/pipeline.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  // Boards (pipelines) do tenant — abas do quadro de oportunidades.
  @Get('pipelines')
  listPipelines() {
    return this.pipelines.pipelines()
  }

  // Atualiza um board (rótulo, ordem, dono do board).
  @Patch('pipelines/:id')
  updatePipeline(@Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.pipelines.updatePipeline(id, dto)
  }

  // Estágios do funil do tenant (para kanban, badges e gráficos do admin).
  @Get('stages')
  stages() {
    return this.pipelines.stages()
  }

  @Post('stages')
  createStage(@Body() dto: CreateStageDto) {
    return this.pipelines.createStage(dto)
  }
  @Patch('stages/reorder')
  reorderStages(@Body() dto: ReorderStagesDto) {
    return this.pipelines.reorderStages(dto)
  }
  @Patch('stages/:id')
  updateStage(@Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.pipelines.updateStage(id, dto)
  }
  // moveTo (opcional): estágio de destino p/ migrar as oportunidades antes de excluir.
  @Delete('stages/:id')
  deleteStage(@Param('id') id: string, @Query('moveTo') moveTo?: string) {
    return this.pipelines.deleteStage(id, moveTo)
  }
}
