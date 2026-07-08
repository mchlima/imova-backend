import { Module } from '@nestjs/common'
import { CaptureController } from './capture.controller'
import { OpportunitiesModule } from '../opportunities/opportunities.module'

@Module({
  imports: [OpportunitiesModule], // usa OpportunitiesService.ingest()
  controllers: [CaptureController],
})
export class CaptureModule {}
