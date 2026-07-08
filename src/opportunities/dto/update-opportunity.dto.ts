import { IsArray, IsIn, IsObject, IsNumber, IsOptional, IsString } from 'class-validator'

// Campos editáveis na triagem do admin (PATCH /opportunities/:id).
export class UpdateOpportunityDto {
  // status é validado contra os estágios do funil (dado) no service, não aqui
  @IsOptional() @IsString() status?: string

  @IsOptional()
  @IsIn(['Quente', 'Morno', 'Frio', 'Sem classificação'])
  temperature?: string

  @IsOptional() @IsNumber() boardOrder?: number

  // motivo da perda (quando status = estágio de perda)
  @IsOptional() @IsString() lossReason?: string

  // valores dos campos personalizados (patch parcial, mesclado no service)
  @IsOptional() @IsObject() fields?: Record<string, unknown>

  // responsáveis: conjunto completo de ids de usuário (substitui os atuais)
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[]
}
