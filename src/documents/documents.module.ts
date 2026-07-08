import { Module } from '@nestjs/common'
import { DocumentsService } from './documents.service'
import { DocumentsController } from './documents.controller'
import { LeadsStorageService } from './leads-storage.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  // AuthModule exporta o JwtService usado pelo JwtAuthGuard.
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, LeadsStorageService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
