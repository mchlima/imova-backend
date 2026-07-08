import { IsInt, IsOptional, IsString } from 'class-validator'

// Atualização de um board (PATCH /pipelines/:id). ownerUserId = dono do board
// (ownership leve); enviar null/'' desatribui.
export class UpdatePipelineDto {
  @IsOptional() @IsString() label?: string

  // identificador do board na URL/rota; único por tenant.
  @IsOptional() @IsString() key?: string

  @IsOptional() @IsInt() order?: number

  // dono do board; string vazia ou null desatribui.
  @IsOptional() @IsString() ownerUserId?: string | null
}
