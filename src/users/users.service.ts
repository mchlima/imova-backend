import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'

const BCRYPT_ROUNDS = 10

// Usuário com a role carregada — é do que o auth precisa para resolver permissões.
export type UserWithRole = Prisma.UserGetPayload<{ include: { roleRef: true } }>

// Campos expostos pela API de administração (nunca o passwordHash).
const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  active: true,
  createdAt: true,
  roleId: true,
  roleRef: { select: { id: true, key: true, name: true } },
} satisfies Prisma.UserSelect

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { roleRef: true },
    })
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roleRef: true },
    })
  }

  // Candidatos a responsáveis por oportunidades — visível a qualquer usuário logado.
  // Só os ativos: um acesso desativado não deve receber novas atribuições.
  findAssignable() {
    return this.prisma.user.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        roleRef: { select: { key: true, name: true } },
      },
    })
  }

  // ── administração (exige users:manage) ───────────────────────────────────

  findAllForAdmin() {
    return this.prisma.user.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: ADMIN_SELECT,
    })
  }

  private async assertRoleExists(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new BadRequestException('Perfil de acesso inexistente.')
  }

  private async assertEmailFree(email: string, exceptId?: string) {
    const clash = await this.prisma.user.findUnique({ where: { email } })
    if (clash && clash.id !== exceptId) {
      throw new ConflictException('Já existe um usuário com este e-mail.')
    }
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase()
    await this.assertEmailFree(email)
    await this.assertRoleExists(dto.roleId)

    return this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        roleId: dto.roleId,
        active: dto.active ?? true,
      },
      select: ADMIN_SELECT,
    })
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuário não encontrado.')

    // Trancar-se para fora do admin é irreversível pela própria interface — barramos aqui.
    const self = id === currentUserId
    if (self && dto.active === false) {
      throw new ForbiddenException('Você não pode desativar a própria conta.')
    }
    if (self && dto.roleId && dto.roleId !== user.roleId) {
      throw new ForbiddenException('Você não pode alterar o próprio perfil de acesso.')
    }

    if (dto.roleId) await this.assertRoleExists(dto.roleId)
    const email = dto.email?.trim().toLowerCase()
    if (email) await this.assertEmailFree(email, id)

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(email !== undefined && { email }),
        ...(dto.roleId !== undefined && { roleId: dto.roleId }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      select: ADMIN_SELECT,
    })
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuário não encontrado.')

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) },
    })
    return { ok: true as const }
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Você não pode excluir a própria conta.')
    }
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuário não encontrado.')

    // Excluir levaria junto a autoria dos posts. Desativar preserva o histórico.
    const posts = await this.prisma.post.count({ where: { authorId: id } })
    if (posts > 0) {
      throw new ConflictException(
        'Este usuário é autor de posts no CMS. Desative o acesso em vez de excluir.',
      )
    }

    await this.prisma.user.delete({ where: { id } })
    return { ok: true as const }
  }
}
