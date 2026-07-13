import { PrismaClient } from '@prisma/client'
import { DEFAULT_ROLES } from '../src/auth/permissions'

const prisma = new PrismaClient()

// Semeia os perfis de acesso (RBAC) e faz o backfill dos usuários existentes, que
// vinham do enum legado users.role (ADMIN | AGENT) para a relação users.roleId.
//
// Idempotente: reexecutar reconcilia. A role de sistema (ADMIN) é sempre reescrita
// com o wildcard; a AGENT só é CRIADA com as permissões padrão — se você editou as
// permissões dela no admin, o seed não sobrescreve sua escolha.

async function main() {
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        // só a role de sistema tem as permissões forçadas (ela é a rede de segurança)
        ...(r.isSystem && { permissions: r.permissions }),
      },
      create: r,
    })
    console.log(`✔ perfil ${role.key} (${role.permissions.length} permissões)`)
  }

  const roles = await prisma.role.findMany({ select: { id: true, key: true } })
  const byKey = new Map(roles.map((r) => [r.key, r.id]))

  // backfill: usuários sem roleId herdam a role de mesmo nome do enum legado
  const orphans = await prisma.user.findMany({
    where: { roleId: null },
    select: { id: true, email: true, role: true },
  })
  for (const u of orphans) {
    const roleId = byKey.get(u.role)
    if (!roleId) {
      console.warn(`⚠ ${u.email}: role legada '${u.role}' sem equivalente — pulando`)
      continue
    }
    await prisma.user.update({ where: { id: u.id }, data: { roleId } })
    console.log(`✔ ${u.email} → ${u.role}`)
  }

  const semRole = await prisma.user.count({ where: { roleId: null } })
  if (semRole > 0) console.warn(`⚠ ainda há ${semRole} usuário(s) sem perfil de acesso.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
