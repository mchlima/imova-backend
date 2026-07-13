import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { RolesService } from './roles.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { SafeUser } from '../auth/auth.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

// Lista de usuários para atribuição de responsáveis — qualquer usuário logado.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAssignable()
  }
}

// Administração de usuários.
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('users:manage')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAllForAdmin()
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: SafeUser) {
    return this.users.update(id, dto, me.id)
  }

  @Post(':id/password')
  @HttpCode(200)
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: SafeUser) {
    return this.users.remove(id, me.id)
  }
}

// Perfis de acesso (roles) e o catálogo de permissões.
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('users:manage')
export class AdminRolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  findAll() {
    return this.roles.findAll()
  }

  /** Vocabulário de permissões (vive no código) para montar a tela de perfis. */
  @Get('permissions')
  catalog() {
    return this.roles.catalog()
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto)
  }
}
