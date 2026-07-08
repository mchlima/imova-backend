import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreateActivityDto {
  @IsString() @IsNotEmpty() @MaxLength(40) type!: string

  // Para interações é o título curto; para type=nota é o próprio texto da anotação.
  @IsString() @IsNotEmpty({ message: 'Escreva algo.' }) @MaxLength(2000)
  title!: string

  @IsOptional() @IsString() notes?: string

  // agendamento (futuro). Ausente = atividade apenas registrada.
  @IsOptional() @IsDateString() dueAt?: string

  // true quando é um registro de algo já feito.
  @IsOptional() @IsBoolean() done?: boolean
}
