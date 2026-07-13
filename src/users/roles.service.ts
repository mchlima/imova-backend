import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PERMISSION_GROUPS, isValidPermission } from '../auth/permissions'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    })
  }

  /** Catálogo de permissões (código) — alimenta a tela de edição de perfis. */
  catalog() {
    return PERMISSION_GROUPS
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('Perfil de acesso não encontrado.')

    // A role de sistema é a rede de segurança: se ela pudesse perder permissões,
    // dava para deixar a instalação inteira sem ninguém capaz de administrar.
    if (role.isSystem) {
      throw new ForbiddenException('O perfil Administrador não pode ser alterado.')
    }

    if (dto.permissions) {
      const unknown = dto.permissions.filter((p) => !isValidPermission(p))
      if (unknown.length) {
        throw new BadRequestException(`Permissões desconhecidas: ${unknown.join(', ')}.`)
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() || null }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
      include: { _count: { select: { users: true } } },
    })
  }
}
