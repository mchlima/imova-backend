import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { PipelinesService } from './pipelines.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateStageDto, ReorderStagesDto, UpdateStageDto } from './dto/stage.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

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
  @Delete('stages/:id')
  deleteStage(@Param('id') id: string) {
    return this.pipelines.deleteStage(id)
  }
}
