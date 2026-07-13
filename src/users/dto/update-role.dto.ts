import { ArrayUnique, IsArray, IsOptional, IsString, Length } from 'class-validator'

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string

  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string

  // Validadas contra o catálogo do código (permissions.ts) no serviço: o admin não
  // pode inventar uma permissão que nenhuma rota verifica.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[]
}
