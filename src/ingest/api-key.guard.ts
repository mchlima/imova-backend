import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'

// Autentica requisições de ingestão externa por API key do tenant.
// Header: Authorization: Bearer <api-key>. Guardamos só o sha256 da chave;
// aqui recalculamos o hash e buscamos a ApiKey (não revogada) do tenant.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const auth: string = req.headers['authorization'] || ''
    const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!key) throw new UnauthorizedException('API key ausente.')

    const hash = createHash('sha256').update(key).digest('hex')
    const rec = await this.prisma.apiKey.findFirst({ where: { hash, revokedAt: null } })
    if (!rec) throw new UnauthorizedException('API key inválida.')

    // disponibiliza o tenant resolvido para o controller
    req.tenantId = rec.tenantId
    return true
  }
}
