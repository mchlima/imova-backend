import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { R2Service } from '../cms/r2.service'
import { DevelopmentsService } from './developments.service'
import { DevelopmentStorageService } from './development-storage.service'
import { DevelopmentsController } from './developments.controller'
import { AdminDevelopmentsController } from './admin-developments.controller'

// TenantService e PrismaService são @Global — não precisam ser reprovidos aqui.
// R2Service não é global (vive no CmsModule), então é provido localmente.
@Module({
  imports: [AuthModule], // JwtAuthGuard nas rotas /admin/*
  controllers: [DevelopmentsController, AdminDevelopmentsController],
  providers: [DevelopmentsService, DevelopmentStorageService, R2Service],
})
export class DevelopmentsModule {}
