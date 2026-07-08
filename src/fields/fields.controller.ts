import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { FieldsService } from './fields.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import {
  CreateFieldDto,
  CreateSectionDto,
  ReorderDto,
  UpdateFieldDto,
  UpdateSectionDto,
} from './dto/field.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  // Para o drawer (só campos ativos).
  @Get('field-definitions')
  definitions() {
    return this.fields.definitions()
  }

  // Para a tela de gestão (inclui arquivados).
  @Get('field-definitions/all')
  allDefinitions() {
    return this.fields.allDefinitions()
  }

  // ── seções ──
  @Post('field-sections')
  createSection(@Body() dto: CreateSectionDto) {
    return this.fields.createSection(dto)
  }
  @Patch('field-sections/reorder')
  reorderSections(@Body() dto: ReorderDto) {
    return this.fields.reorderSections(dto)
  }
  @Patch('field-sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.fields.updateSection(id, dto)
  }
  @Delete('field-sections/:id')
  deleteSection(@Param('id') id: string) {
    return this.fields.deleteSection(id)
  }

  // ── campos ──
  @Post('field-definitions')
  createField(@Body() dto: CreateFieldDto) {
    return this.fields.createField(dto)
  }
  @Patch('field-definitions/reorder')
  reorderFields(@Body() dto: ReorderDto) {
    return this.fields.reorderFields(dto)
  }
  @Patch('field-definitions/:id')
  updateField(@Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.fields.updateField(id, dto)
  }
  @Delete('field-definitions/:id')
  deleteField(@Param('id') id: string) {
    return this.fields.deleteField(id)
  }
}
