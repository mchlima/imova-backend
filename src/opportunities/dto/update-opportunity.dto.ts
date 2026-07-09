import { IsArray, IsIn, IsObject, IsNumber, IsOptional, IsString } from 'class-validator'

// Campos editáveis na triagem do admin (PATCH /opportunities/:id).
export class UpdateOpportunityDto {
  // estágio atual (id interno). A FK no banco garante que existe.
  @IsOptional() @IsString() stageId?: string

  @IsOptional()
  @IsIn(['Quente', 'Morno', 'Frio', 'Sem classificação'])
  temperature?: string

  @IsOptional() @IsNumber() boardOrder?: number

  // motivo da perda (quando o estágio é de perda)
  @IsOptional() @IsString() lossReason?: string

  // descrição livre (markdown) da oportunidade
  @IsOptional() @IsString() description?: string

  // valores dos campos personalizados (patch parcial, mesclado no service)
  @IsOptional() @IsObject() fields?: Record<string, unknown>

  // responsáveis: conjunto completo de ids de usuário (substitui os atuais)
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[]
}
