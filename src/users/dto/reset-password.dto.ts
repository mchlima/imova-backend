import { IsString, Length } from 'class-validator'

export class ResetPasswordDto {
  @IsString()
  @Length(8, 32, { message: 'A senha deve ter de 8 a 32 caracteres.' })
  password!: string
}
