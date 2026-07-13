import { Module } from '@nestjs/common'
import { UsersController, AdminUsersController, AdminRolesController } from './users.controller'
import { UsersModule } from './users.module'
import { AuthModule } from '../auth/auth.module'

// API HTTP de usuários (rotas protegidas). Separado do UsersModule para evitar a
// dependência circular AuthModule ⇄ UsersModule: aqui importamos ambos sem ciclo.
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [UsersController, AdminUsersController, AdminRolesController],
})
export class UsersApiModule {}
