import { Type } from 'class-transformer'
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { FaqItemDto } from './post.dto'

export class UpsertTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name!: string

  @IsOptional() @IsString() slug?: string

  @IsOptional() @IsString() description?: string

  // SEO/GEO
  @IsOptional() @IsString() intro?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq?: FaqItemDto[]

  @IsOptional() @IsString() metaTitle?: string
  @IsOptional() @IsString() metaDescription?: string
  @IsOptional() @IsString() canonicalUrl?: string
  @IsOptional() @IsString() ogImage?: string
}
