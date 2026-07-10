import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

// Resolução do tenant do CRM.
//
// FASE 0: o CRM ainda roda embutido no ReveLar, então há um único tenant ('imova').
// Este serviço centraliza a resolução para que o resto do código já dependa de um
// "tenant atual" — e não de constantes. Na extração (ADR 0002), trocamos a
// implementação por resolução por request (sessão do usuário / API key), sem
// mexer nos chamadores.
@Injectable()
export class TenantService {
  private cachedId: string | null = null

  constructor(private readonly prisma: PrismaService) {}

  async currentId(): Promise<string> {
    if (this.cachedId) return this.cachedId
    const tenant = await this.prisma.tenant.upsert({
      where: { slug: 'imova' },
      update: {},
      create: { slug: 'imova', name: 'ReveLar' },
    })
    this.cachedId = tenant.id
    return tenant.id
  }
}
