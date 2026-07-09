import { IsOptional, IsString, IsNotEmpty } from 'class-validator'

// Campos (multipart) que acompanham o upload do arquivo. contactId é o dono do
// documento; opportunityId (opcional) registra a oportunidade que originou o envio.
export class CreateDocumentDto {
  @IsString() @IsNotEmpty() contactId!: string
  @IsOptional() @IsString() opportunityId?: string
}
