import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService, type UploadedDocument } from './documents.service'
import { CreateDocumentDto } from './dto/create-document.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { SafeUser } from '../auth/auth.service'

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // Upload (multipart): campo 'file' + contactId/opportunityId/category/categoryLabel.
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  create(
    @UploadedFile() file: UploadedDocument,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.documents.create(file, dto, user.name)
  }

  // Documentos de um contato (reutilizáveis entre oportunidades).
  @Get('contact/:contactId')
  listByContact(@Param('contactId') contactId: string) {
    return this.documents.listByContact(contactId)
  }

  // URL pré-assinada (curta) para ver/baixar. ?download=1 força o download.
  @Get(':id/url')
  getUrl(@Param('id') id: string, @Query('download') download?: string) {
    return this.documents.getUrl(id, download === '1')
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documents.remove(id)
  }
}
