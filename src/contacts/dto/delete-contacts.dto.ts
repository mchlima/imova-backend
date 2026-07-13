import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator'

// Exclusão em massa. O teto evita que um "selecionar todos" numa base grande vire
// uma transação gigante — a UI fatia em lotes se precisar.
export class DeleteContactsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(200, { message: 'Excluir no máximo 200 contatos por vez.' })
  @IsUUID('4', { each: true })
  ids!: string[]
}
