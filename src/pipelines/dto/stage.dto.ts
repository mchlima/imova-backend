import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'

export class CreateStageDto {
  // key casa com Opportunity.status; imutável após criação (não migra status).
  @IsString() @IsNotEmpty() key!: string
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
  // ao mudar a key, o service migra Opportunity.status (oldKey → newKey) do pipeline.
  @IsOptional() @IsString() @IsNotEmpty() key?: string
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
