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
import { DevelopmentsService } from './developments.service'
import type { ImageKind, UploadedImage } from './development-storage.service'
import {
  CreateDevelopmentDto,
  UpdateDevelopmentDto,
  UpdateImageDto,
} from './dto/development.dto'

const KINDS: ImageKind[] = ['hero', 'lazer', 'planta']

@Controller('admin/developments')
@UseGuards(JwtAuthGuard)
export class AdminDevelopmentsController {
  constructor(private readonly developments: DevelopmentsService) {}

  @Get()
  list() {
    return this.developments.listAdmin()
  }

  @Post()
  create(@Body() dto: CreateDevelopmentDto) {
    return this.developments.create(dto)
  }

  // reconciliação de storage (rede de segurança anti-órfãos) — antes de :id
  @Post('reconcile-storage')
  reconcile() {
    return this.developments.reconcileStorage()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.developments.getAdmin(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDevelopmentDto) {
    return this.developments.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.developments.remove(id)
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.developments.publish(id)
  }

  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.developments.unpublish(id)
  }

  // ── imagens ──
  @Post(':id/images')
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

  @Patch(':id/images/:imageId')
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.developments.updateImage(id, imageId, dto)
  }

  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.developments.removeImage(id, imageId)
  }
}
