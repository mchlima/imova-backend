import { IsNumber, Max, Min } from 'class-validator'

// Alíquotas guardadas como fração (ex.: 0.03 = 3%). Limite de 0–20% por segurança.
export class UpdateStateRateDto {
  @IsNumber()
  @Min(0)
  @Max(0.2)
  notaryRate!: number
}

export class UpdateCityRateDto {
  @IsNumber()
  @Min(0)
  @Max(0.2)
  itbiRate!: number
}
