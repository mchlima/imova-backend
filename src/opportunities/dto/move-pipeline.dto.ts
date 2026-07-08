import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

// Move a oportunidade para outro board (POST /opportunities/:id/move-pipeline).
// Cai no primeiro estágio do board de destino; assigneeIds (opcional) redefine os
// responsáveis (ex.: atribuir à corretora ao repassar).
export class MovePipelineDto {
  @IsString() @IsNotEmpty({ message: 'Informe o board de destino.' })
  pipelineId!: string

  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[]
}
