import { Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

class IngestChannelDto {
  @IsString() @IsNotEmpty() type!: string // email | whatsapp | telefone | outro
  @IsString() @IsNotEmpty() value!: string
}

class IngestContactDto {
  @IsString() @IsNotEmpty({ message: 'Informe o nome do contato.' }) name!: string

  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma forma de contato.' })
  @ValidateNested({ each: true })
  @Type(() => IngestChannelDto)
  channels!: IngestChannelDto[]
}

// Payload genérico de ingestão (server-to-server, autenticado por API key).
// O tenant vem da API key — nunca do corpo.
export class IngestDto {
  @IsOptional() @IsString() source?: string

  @ValidateNested()
  @Type(() => IngestContactDto)
  contact!: IngestContactDto

  // campos personalizados, aninhados por seção: { sectionKey: { fieldKey: valor } }.
  // seção/campo sem definição no tenant é ignorado. Sem nenhum campo de domínio.
  @IsOptional() @IsObject() fields?: Record<string, Record<string, unknown>>

  // estágio inicial (key), decidido por quem chama. Ausente = primeiro estágio.
  @IsOptional() @IsString() stageKey?: string
}
