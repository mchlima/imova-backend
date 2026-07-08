import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator'

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'money',
  'select',
  'multiselect',
  'boolean',
  'date',
]

// key vira caminho no JSONB — restringe a um slug seguro.
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

export class CreateSectionDto {
  @IsString() @Matches(KEY_RE, { message: 'key inválida (use letras/números/_).' }) key!: string
  @IsString() @IsNotEmpty() label!: string
  @IsOptional() @IsInt() order?: number
}

export class UpdateSectionDto {
  @IsOptional() @Matches(KEY_RE, { message: 'key inválida (use letras/números/_).' }) key?: string
  @IsOptional() @IsString() @IsNotEmpty() label?: string
  @IsOptional() @IsInt() order?: number
}

export class CreateFieldDto {
  @IsString() sectionId!: string
  @IsString() @Matches(KEY_RE, { message: 'key inválida (use letras/números/_).' }) key!: string
  @IsString() @IsNotEmpty() label!: string
  @IsIn(FIELD_TYPES) type!: string
  @IsOptional() @IsArray() options?: string[]
  @IsOptional() @IsInt() order?: number
}

export class UpdateFieldDto {
  @IsOptional() @IsString() sectionId?: string
  @IsOptional() @Matches(KEY_RE, { message: 'key inválida (use letras/números/_).' }) key?: string
  @IsOptional() @IsString() @IsNotEmpty() label?: string
  @IsOptional() @IsIn(FIELD_TYPES) type?: string
  @IsOptional() @IsArray() options?: string[]
  @IsOptional() @IsInt() order?: number
  @IsOptional() @IsBoolean() archived?: boolean
  @IsOptional() @IsBoolean() indexed?: boolean
}

export class ReorderDto {
  @IsArray() items!: { id: string; order: number }[]
}
