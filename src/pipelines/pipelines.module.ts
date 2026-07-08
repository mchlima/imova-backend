import { Module } from '@nestjs/common'
import { PipelinesService } from './pipelines.service'
import { PipelinesController } from './pipelines.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  // AuthModule exporta o JwtService usado pelo JwtAuthGuard.
  imports: [AuthModule],
  controllers: [PipelinesController],
  providers: [PipelinesService],
})
export class PipelinesModule {}
