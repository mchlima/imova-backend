import { Module } from '@nestjs/common'
import { LocationsService } from './locations.service'
import { LocationsController } from './locations.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule], // JwtAuthGuard para as rotas de edição de taxas
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
