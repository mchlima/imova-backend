import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

// Item de reordenação do kanban: nova posição (boardOrder) e, opcionalmente,
// novo estágio (stageId — id interno) quando o card é movido entre colunas.
class ReorderItem {
  @IsString() id!: string

  @IsOptional() @IsString() stageId?: string

  @IsNumber() boardOrder!: number
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[]
}
