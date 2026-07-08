import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  states() {
    return this.prisma.state.findMany({
      orderBy: { name: 'asc' },
      select: { uf: true, name: true, region: true, notaryRate: true },
    })
  }

  cities(uf: string) {
    return this.prisma.city.findMany({
      where: { uf: uf.toUpperCase() },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, itbiRate: true, isCapital: true },
    })
  }

  async updateStateRate(uf: string, notaryRate: number) {
    const state = await this.prisma.state.findUnique({ where: { uf: uf.toUpperCase() } })
    if (!state) throw new NotFoundException('Estado não encontrado.')
    return this.prisma.state.update({
      where: { uf: uf.toUpperCase() },
      data: { notaryRate },
      select: { uf: true, name: true, region: true, notaryRate: true },
    })
  }

  async updateCityRate(id: number, itbiRate: number) {
    const city = await this.prisma.city.findUnique({ where: { id } })
    if (!city) throw new NotFoundException('Cidade não encontrada.')
    return this.prisma.city.update({
      where: { id },
      data: { itbiRate },
      select: { id: true, name: true, itbiRate: true, isCapital: true },
    })
  }
}
