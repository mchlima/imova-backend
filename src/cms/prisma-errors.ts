import { Prisma } from '@prisma/client'

/** Verdadeiro se o erro for violação de unicidade (P2002), opcionalmente num campo. */
export function isUniqueViolation(e: unknown, field?: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false
  if (!field) return true
  const target = e.meta?.target
  return Array.isArray(target) ? target.includes(field) : true
}

/**
 * Executa `fn` e, se colidir no slug (corrida P2002), tenta de novo —
 * `fn` regenera o slug a cada tentativa, pegando o próximo sufixo livre.
 */
export async function retryOnSlugCollision<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      if (!isUniqueViolation(e, 'slug')) throw e
      lastErr = e
    }
  }
  throw lastErr
}
