import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator'

// Senha NÃO entra aqui: trocar senha é uma ação própria (POST /admin/users/:id/password),
// para não escorregar numa edição de nome.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(180)
  email?: string

  @IsOptional()
  @IsUUID()
  roleId?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
