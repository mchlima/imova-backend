import { IsIn, IsNotEmpty, IsString } from 'class-validator'

// Nova forma de contato (POST /contacts/:id/channels).
export class CreateChannelDto {
  @IsIn(['email', 'whatsapp', 'telefone', 'outro'])
  type!: string

  @IsString()
  @IsNotEmpty({ message: 'Informe o valor do contato.' })
  value!: string
}
