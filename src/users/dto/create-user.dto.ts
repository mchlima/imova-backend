import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator'

// A senha é definida por quem administra (não há auto-cadastro). O mínimo de 8 e o
// máximo de 32 espelham o gerador de senha do admin.
export class CreateUserDto {
  @IsString()
  @Length(2, 120)
  name!: string

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(180)
  email!: string

  @IsString()
  @Length(8, 32, { message: 'A senha deve ter de 8 a 32 caracteres.' })
  password!: string

  @IsUUID()
  roleId!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
