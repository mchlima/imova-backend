import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { AuthService, JwtPayload } from './auth.service'

export const AUTH_COOKIE = 'imova_token'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const token = req.cookies?.[AUTH_COOKIE]
    if (!token) throw new UnauthorizedException('Não autenticado.')

    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token)
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.')
    }

    const user = await this.auth.userFromId(payload.sub)
    if (!user) throw new UnauthorizedException('Usuário não encontrado.')

    // Disponibiliza o usuário autenticado nos handlers via @CurrentUser().
    ;(req as Request & { user?: unknown }).user = user
    return true
  }
}
