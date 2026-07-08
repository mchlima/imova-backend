import { Type } from 'class-transformer'
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class FaqItemDto {
  @IsString() q!: string
  @IsString() a!: string
}

export class CreatePostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string
}

export class UpdatePostDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string
  @IsOptional() @IsString() slug?: string
  @IsOptional() @IsString() deck?: string
  @IsOptional() @IsString() body?: string

  @IsOptional() @IsArray() @IsString({ each: true }) bullets?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq?: FaqItemDto[]

  @IsOptional() @IsString() metaTitle?: string
  @IsOptional() @IsString() metaDescription?: string
  @IsOptional() @IsString() canonicalUrl?: string
  @IsOptional() @IsString() ogImage?: string

  // null limpa a categoria
  @IsOptional() categoryId?: string | null

  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[]
}
