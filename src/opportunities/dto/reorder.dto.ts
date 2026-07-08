import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

// Item de reordenação do kanban: nova posição (boardOrder) e, opcionalmente,
// nova coluna (status) quando o card é movido entre colunas. O status é uma key de
// estágio (dado por board), validada contra o funil no service — não com lista fixa.
class ReorderItem {
  @IsString() id!: string

  @IsOptional() @IsString() status?: string

  @IsNumber() boardOrder!: number
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[]
}
