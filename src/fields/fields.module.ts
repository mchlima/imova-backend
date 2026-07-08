import { Module } from '@nestjs/common'
import { FieldsService } from './fields.service'
import { FieldsController } from './fields.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [FieldsController],
  providers: [FieldsService],
})
export class FieldsModule {}
