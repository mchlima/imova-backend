import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Initial accounts for the opportunity-triage admin area.
const SEED_USERS = [
  {
    email: 'm.macedomarques@gmail.com',
    name: 'Michel Lima',
    password: 'DevTest123!',
    role: UserRole.ADMIN,
  },
]

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash, role: u.role },
      create: { email: u.email, name: u.name, passwordHash, role: u.role },
    })
    console.log(`✔ seeded user ${user.email} (${user.role})`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
