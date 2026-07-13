import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { SafeUser } from './auth.service'
import { PERMISSIONS_KEY } from './require-permissions.decorator'
import { hasPermission } from './permissions'

/**
 * Autoriza a rota pelas permissões do usuário. Roda DEPOIS do JwtAuthGuard, que já
 * colocou o SafeUser (com permissions resolvidas do banco) em req.user — ler do banco,
 * e não do JWT, faz a revogação valer na hora, sem esperar o token expirar.
 *
 * Rota sem @RequirePermissions passa direto: exige apenas estar autenticado.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const req = context.switchToHttp().getRequest<Request & { user?: SafeUser }>()
    const granted = req.user?.permissions ?? []

    const missing = required.filter((p) => !hasPermission(granted, p))
    if (missing.length) {
      throw new ForbiddenException(
        `Você não tem permissão para esta ação (${missing.join(', ')}).`,
      )
    }
    return true
  }
}
