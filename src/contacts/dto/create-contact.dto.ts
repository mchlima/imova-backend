import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

class ContactChannelDto {
  @IsIn(['email', 'whatsapp', 'telefone', 'outro'])
  type!: string

  @IsString()
  @IsNotEmpty({ message: 'Informe o valor do contato.' })
  value!: string
}

// Criação manual de contato no admin (POST /contacts). As formas de contato
// vêm junto; residência é opcional (mesmos campos do PATCH).
export class CreateContactDto {
  @IsString() @IsNotEmpty({ message: 'Informe o nome do contato.' }) name!: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactChannelDto)
  channels?: ContactChannelDto[]

  @IsOptional() @IsString() residenceUf?: string
  @IsOptional() @IsString() residenceCity?: string
  @IsOptional() @IsString() residenceStreetType?: string
  @IsOptional() @IsString() residenceStreet?: string
  @IsOptional() @IsString() residenceNumber?: string
  @IsOptional() @IsString() residenceComplement?: string
  @IsOptional() @IsString() residenceNeighborhood?: string
  @IsOptional() @IsString() residencePostalCode?: string
}
