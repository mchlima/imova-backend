import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

// Criação de tarefa (checklist da oportunidade): só o título por ora.
export class CreateTaskDto {
  @IsString() @IsNotEmpty({ message: 'Informe o título da tarefa.' }) title!: string
}

// Atualização de tarefa: renomear e/ou marcar como concluída/não concluída.
export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string
  @IsOptional() @IsBoolean() done?: boolean
}
