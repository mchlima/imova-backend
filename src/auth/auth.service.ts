import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UsersService, UserWithRole } from '../users/users.service'
import { expand } from './permissions'

export interface JwtPayload {
  sub: string
  email: string
}

// Versão pública do usuário (nunca expõe o passwordHash). As permissões vêm
// resolvidas da role a cada requisição — não do JWT — para que uma revogação no
// admin valha na hora, sem esperar o token de 7 dias expirar.
export interface SafeUser {
  id: string
  email: string
  name: string
  role: { id: string; key: string; name: string } | null
  permissions: string[]
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  private toSafeUser(user: UserWithRole): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.roleRef
        ? { id: user.roleRef.id, key: user.roleRef.key, name: user.roleRef.name }
        : null,
      // sem role = sem permissão: um usuário órfão não vira admin por acidente
      permissions: expand(user.roleRef?.permissions ?? []),
    }
  }

  /** Valida credenciais e devolve o usuário sem o hash. Lança 401 se inválido. */
  async validateCredentials(email: string, password: string): Promise<SafeUser> {
    const user = await this.users.findByEmail(email)
    if (!user) throw new UnauthorizedException('E-mail ou senha incorretos.')

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('E-mail ou senha incorretos.')
    if (!user.active) throw new UnauthorizedException('Este acesso foi desativado.')

    return this.toSafeUser(user)
  }

  /** Assina o JWT que vai dentro do cookie httpOnly. Carrega só a identidade. */
  signToken(user: SafeUser): string {
    const payload: JwtPayload = { sub: user.id, email: user.email }
    return this.jwt.sign(payload)
  }

  async userFromId(id: string): Promise<SafeUser | null> {
    const user = await this.users.findById(id)
    if (!user || !user.active) return null
    return this.toSafeUser(user)
  }
}
