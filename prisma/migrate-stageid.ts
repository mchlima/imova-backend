/**
 * Migração: Opportunity.status (key string) → Opportunity.stageId (FK) + Stage.externalId.
 *
 * Rodar ANTES de `prisma db push --accept-data-loss` (que cria a FK/unique e derruba
 * as colunas antigas `stages.key` e `opportunities.status`). Idempotente. Requer BACKUP.
 *
 *   npx tsx prisma/migrate-stageid.ts
 *
 * Usa SQL cru porque o Prisma Client já foi gerado do schema NOVO (sem key/status),
 * mas as colunas antigas ainda existem no banco neste momento.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1) colunas novas (idempotente) — ainda convivendo com as antigas
  await prisma.$executeRawUnsafe(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "stageId" text;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "stages" ADD COLUMN IF NOT EXISTS "externalId" text;`)

  // 2) externalId para estágios que ainda não têm (uuid estável p/ integrações)
  const filled = await prisma.$executeRawUnsafe(
    `UPDATE "stages" SET "externalId" = gen_random_uuid()::text WHERE "externalId" IS NULL;`,
  )
  console.log('stages com externalId gerado:', filled)

  // 3) backfill stageId a partir de (tenantId, pipelineId, key == status)
  const moved = await prisma.$executeRawUnsafe(`
    UPDATE "opportunities" o
       SET "stageId" = s."id"
      FROM "stages" s
     WHERE s."tenantId" = o."tenantId"
       AND s."pipelineId" = o."pipelineId"
       AND s."key" = o."status"
       AND o."stageId" IS NULL;
  `)
  console.log('opportunities com stageId preenchido:', moved)

  // 4) relatório de órfãs (status sem estágio correspondente) — inspecionar antes do push
  const orphans = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "opportunities" WHERE "stageId" IS NULL;`,
  )
  console.log('opportunities sem stageId (órfãs):', orphans[0]?.n ?? 0)
}

main()
  .then(() => console.log('OK — agora rode: npx prisma db push --accept-data-loss'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
