import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

class NewContactChannelDto {
  @IsIn(['email', 'whatsapp', 'telefone', 'outro'])
  type!: string

  @IsString() @IsNotEmpty({ message: 'Informe o valor do contato.' })
  value!: string
}

class NewContactDto {
  @IsString() @IsNotEmpty({ message: 'Informe o nome do contato.' }) name!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NewContactChannelDto)
  channels!: NewContactChannelDto[]
}

// Criação manual de oportunidade no admin (POST /opportunities).
// Ou aponta um contato existente (contactId) OU manda os dados de um novo (contact).
export class CreateOpportunityDto {
  @IsOptional() @IsString() contactId?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => NewContactDto)
  contact?: NewContactDto

  // origem: 'manual' (padrão) ou 'import' para a base trazida de fora.
  @IsOptional() @IsString() source?: string

  // estágio inicial (key). Ausente = primeiro estágio do funil.
  @IsOptional() @IsString() stageKey?: string

  @IsOptional()
  @IsIn(['Quente', 'Morno', 'Frio', 'Sem classificação'])
  temperature?: string

  // valores dos campos personalizados, aninhados por seção { sectionKey: { fieldKey } }
  @IsOptional() @IsObject() fields?: Record<string, Record<string, unknown>>

  // responsáveis pela oportunidade (ids de usuário)
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[]
}
