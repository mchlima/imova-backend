import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'requiredPermissions'

/**
 * Exige as permissões listadas na rota (todas — AND). Use junto do PermissionsGuard:
 * `@UseGuards(JwtAuthGuard, PermissionsGuard)` no controller.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)
