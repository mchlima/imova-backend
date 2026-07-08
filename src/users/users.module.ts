import { Module } from '@nestjs/common'
import { UsersService } from './users.service'

// Núcleo de usuários (serviço). É consumido pelo AuthModule, então NÃO importa
// AuthModule aqui (evita dependência circular). A API HTTP fica no UsersApiModule.
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
