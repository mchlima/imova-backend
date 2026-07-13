import { Module } from '@nestjs/common'
import { ContactsService } from './contacts.service'
import { ContactsController } from './contacts.controller'
import { AuthModule } from '../auth/auth.module'
import { DocumentsModule } from '../documents/documents.module'

// DocumentsModule exporta o LeadsStorageService: ao excluir um contato, os arquivos
// dele saem do R2 — senão ficariam órfãos no bucket, sem linha que os referenciasse.
@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
