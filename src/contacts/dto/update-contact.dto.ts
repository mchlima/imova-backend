import { IsOptional, IsString } from 'class-validator'

// Campos editáveis do contato (PATCH /contacts/:id). As formas de contato
// (e-mail/telefone) são gerenciadas pelos endpoints de channels.
export class UpdateContactDto {
  @IsOptional() @IsString() name?: string
  // residência (onde mora) — endereço estruturado
  @IsOptional() @IsString() residenceUf?: string
  @IsOptional() @IsString() residenceCity?: string
  @IsOptional() @IsString() residenceStreetType?: string
  @IsOptional() @IsString() residenceStreet?: string
  @IsOptional() @IsString() residenceNumber?: string
  @IsOptional() @IsString() residenceComplement?: string
  @IsOptional() @IsString() residenceNeighborhood?: string
  @IsOptional() @IsString() residencePostalCode?: string
}
