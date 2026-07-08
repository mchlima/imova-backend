import { Module } from '@nestjs/common'
import { IngestController } from './ingest.controller'
import { ApiKeyGuard } from './api-key.guard'
import { OpportunitiesModule } from '../opportunities/opportunities.module'

@Module({
  imports: [OpportunitiesModule], // usa OpportunitiesService.ingest()
  controllers: [IngestController],
  providers: [ApiKeyGuard],
})
export class IngestModule {}
