import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { FaqItemDto } from './post.dto'

// Campos SEO/GEO compartilhados por categoria e tag.
class SeoGeoFieldsDto {
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

export class CreateCategoryDto extends SeoGeoFieldsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string

  @IsOptional() @IsString() slug?: string

  @IsOptional()
  @IsString()
  parentId?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsInt()
  order?: number
}

export class UpdateCategoryDto extends SeoGeoFieldsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string
  @IsOptional() @IsString() slug?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() order?: number
}
