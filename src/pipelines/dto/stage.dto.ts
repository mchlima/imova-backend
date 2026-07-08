import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'

export class CreateStageDto {
  // identidade é o id (gerado) + externalId (integrações); estágio é referenciado por id.
  @IsString() @IsNotEmpty() label!: string
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsInt() order?: number
  @IsOptional() @IsBoolean() inKanban?: boolean
  @IsOptional() @IsBoolean() isWon?: boolean
  @IsOptional() @IsBoolean() isLost?: boolean
  // board (pipeline) onde criar o estágio. Ausente = board padrão.
  @IsOptional() @IsString() pipelineId?: string
}

export class UpdateStageDto {
  @IsOptional() @IsString() @IsNotEmpty() label?: string
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsInt() order?: number
  @IsOptional() @IsBoolean() inKanban?: boolean
  @IsOptional() @IsBoolean() isWon?: boolean
  @IsOptional() @IsBoolean() isLost?: boolean
}

export class ReorderStagesDto {
  @IsArray() items!: { id: string; order: number }[]
}
