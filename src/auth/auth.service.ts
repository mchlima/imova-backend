import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UsersService } from '../users/users.service'

export interface JwtPayload {
  sub: string
  email: string
  role: string
}

// Versão pública do usuário (nunca expõe o passwordHash).
export interface SafeUser {
  id: string
  email: string
  name: string
  role: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** Valida credenciais e devolve o usuário sem o hash. Lança 401 se inválido. */
  async validateCredentials(email: string, password: string): Promise<SafeUser> {
    const user = await this.users.findByEmail(email)
    if (!user) throw new UnauthorizedException('E-mail ou senha incorretos.')

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('E-mail ou senha incorretos.')

    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }

  /** Assina o JWT que vai dentro do cookie httpOnly. */
  signToken(user: SafeUser): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }
    return this.jwt.sign(payload)
  }

  async userFromId(id: string): Promise<SafeUser | null> {
    const user = await this.users.findById(id)
    if (!user) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }
}
