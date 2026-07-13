import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { RolesService } from './roles.service'

// Núcleo de usuários (serviço). É consumido pelo AuthModule, então NÃO importa
// AuthModule aqui (evita dependência circular). A API HTTP fica no UsersApiModule.
@Module({
  providers: [UsersService, RolesService],
  exports: [UsersService, RolesService],
})
export class UsersModule {}
