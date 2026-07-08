import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { TenantModule } from './tenant/tenant.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { UsersApiModule } from './users/users-api.module'
import { OpportunitiesModule } from './opportunities/opportunities.module'
import { PipelinesModule } from './pipelines/pipelines.module'
import { IngestModule } from './ingest/ingest.module'
import { CaptureModule } from './capture/capture.module'
import { FieldsModule } from './fields/fields.module'
import { ContactsModule } from './contacts/contacts.module'
import { LocationsModule } from './locations/locations.module'
import { CmsModule } from './cms/cms.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TenantModule,
    UsersModule,
    AuthModule,
    UsersApiModule,
    OpportunitiesModule,
    PipelinesModule,
    IngestModule,
    CaptureModule,
    FieldsModule,
    ContactsModule,
    LocationsModule,
    CmsModule,
  ],
})
export class AppModule {}
