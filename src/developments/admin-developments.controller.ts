import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'
import { DevelopmentsService } from './developments.service'
import type { ImageKind, UploadedImage } from './development-storage.service'
import {
  CreateDevelopmentDto,
  UpdateDevelopmentDto,
  UpdateImageDto,
} from './dto/development.dto'

const KINDS: ImageKind[] = ['hero', 'lazer', 'planta']

@Controller('admin/developments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminDevelopmentsController {
  constructor(private readonly developments: DevelopmentsService) {}

  @Get()
  @RequirePermissions('developments:read')
  list() {
    return this.developments.listAdmin()
  }

  @Post()
  @RequirePermissions('developments:write')
  create(@Body() dto: CreateDevelopmentDto) {
    return this.developments.create(dto)
  }

  // reconciliação de storage (rede de segurança anti-órfãos) — antes de :id
  @Post('reconcile-storage')
  @RequirePermissions('developments:write')
  reconcile() {
    return this.developments.reconcileStorage()
  }

  @Get(':id')
  @RequirePermissions('developments:read')
  get(@Param('id') id: string) {
    return this.developments.getAdmin(id)
  }

  @Patch(':id')
  @RequirePermissions('developments:write')
  update(@Param('id') id: string, @Body() dto: UpdateDevelopmentDto) {
    return this.developments.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('developments:delete')
  remove(@Param('id') id: string) {
    return this.developments.remove(id)
  }

  @Patch(':id/publish')
  @RequirePermissions('developments:publish')
  publish(@Param('id') id: string) {
    return this.developments.publish(id)
  }

  @Patch(':id/unpublish')
  @RequirePermissions('developments:publish')
  unpublish(@Param('id') id: string) {
    return this.developments.unpublish(id)
  }

  // ── imagens ──
  @Post(':id/images')
  @RequirePermissions('developments:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  addImage(
    @Param('id') id: string,
    @Query('kind') kind: string | undefined,
    @UploadedFile() file: UploadedImage,
  ) {
    const k = (KINDS as string[]).includes(kind ?? '') ? (kind as ImageKind) : 'lazer'
    if (!file) throw new BadRequestException('Arquivo de imagem ausente.')
    return this.developments.addImage(id, k, file)
  }

  // upload da planta de uma tipologia (devolve url+storageKey p/ salvar na lista)
  @Post(':id/typology-image')
  @RequirePermissions('developments:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  addTypologyImage(@Param('id') id: string, @UploadedFile() file: UploadedImage) {
    if (!file) throw new BadRequestException('Arquivo de imagem ausente.')
    return this.developments.addTypologyImage(id, file)
  }

  @Patch(':id/images/:imageId')
  @RequirePermissions('developments:write')
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.developments.updateImage(id, imageId, dto)
  }

  @Delete(':id/images/:imageId')
  @RequirePermissions('developments:write')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.developments.removeImage(id, imageId)
  }
}
