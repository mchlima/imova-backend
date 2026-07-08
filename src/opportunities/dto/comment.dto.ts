import { IsNotEmpty, IsString } from 'class-validator'

// Comentário interno da equipe na oportunidade.
export class CreateCommentDto {
  @IsString() @IsNotEmpty() body!: string
}

export class UpdateCommentDto {
  @IsString() @IsNotEmpty() body!: string
}
