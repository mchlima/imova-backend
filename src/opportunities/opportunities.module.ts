import { Module } from '@nestjs/common'
import { OpportunitiesService } from './opportunities.service'
import { OpportunitiesController } from './opportunities.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  // AuthModule exporta o JwtService usado pelo JwtAuthGuard.
  imports: [AuthModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
