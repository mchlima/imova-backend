import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

// Item de reordenação do kanban: nova posição (boardOrder) e, opcionalmente,
// nova coluna (status) quando o card é movido entre colunas.
class ReorderItem {
  @IsString() id!: string

  @IsOptional()
  @IsIn(['Lead', 'Contatar', 'Qualificar', 'Repassado', 'Perdido'])
  status?: string

  @IsNumber() boardOrder!: number
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[]
}
