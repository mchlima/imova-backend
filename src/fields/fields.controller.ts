import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { FieldsService } from './fields.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'
import {
  CreateFieldDto,
  CreateSectionDto,
  ReorderDto,
  UpdateFieldDto,
  UpdateSectionDto,
} from './dto/field.dto'

// Os campos ativos alimentam o drawer da oportunidade — quem opera o CRM precisa lê-los.
// Alterar a definição dos campos é configuração (fields:manage).
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  // Para o drawer (só campos ativos).
  @Get('field-definitions')
  @RequirePermissions('opportunities:read')
  definitions() {
    return this.fields.definitions()
  }

  // Para a tela de gestão (inclui arquivados).
  @Get('field-definitions/all')
  @RequirePermissions('fields:manage')
  allDefinitions() {
    return this.fields.allDefinitions()
  }

  // ── seções ──
  @Post('field-sections')
  @RequirePermissions('fields:manage')
  createSection(@Body() dto: CreateSectionDto) {
    return this.fields.createSection(dto)
  }
  @Patch('field-sections/reorder')
  @RequirePermissions('fields:manage')
  reorderSections(@Body() dto: ReorderDto) {
    return this.fields.reorderSections(dto)
  }
  @Patch('field-sections/:id')
  @RequirePermissions('fields:manage')
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.fields.updateSection(id, dto)
  }
  @Delete('field-sections/:id')
  @RequirePermissions('fields:manage')
  deleteSection(@Param('id') id: string) {
    return this.fields.deleteSection(id)
  }

  // ── campos ──
  @Post('field-definitions')
  @RequirePermissions('fields:manage')
  createField(@Body() dto: CreateFieldDto) {
    return this.fields.createField(dto)
  }
  @Patch('field-definitions/reorder')
  @RequirePermissions('fields:manage')
  reorderFields(@Body() dto: ReorderDto) {
    return this.fields.reorderFields(dto)
  }
  @Patch('field-definitions/:id')
  @RequirePermissions('fields:manage')
  updateField(@Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.fields.updateField(id, dto)
  }
  @Delete('field-definitions/:id')
  @RequirePermissions('fields:manage')
  deleteField(@Param('id') id: string) {
    return this.fields.deleteField(id)
  }
}
