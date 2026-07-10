import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { DevelopmentRegiao, DevelopmentStatus } from '@prisma/client'
import { AMENITY_SLUGS } from '../amenities'

const REGIOES = Object.values(DevelopmentRegiao)
const STATUSES = Object.values(DevelopmentStatus)

// Tipologia (planta) — enviada aninhada; o save substitui a lista inteira.
export class TypologyInputDto {
  @IsString() @MinLength(1) @MaxLength(80) label!: string
  @IsOptional() @IsInt() @Min(0) bedrooms?: number
  @IsOptional() @IsInt() @Min(0) suites?: number
  @IsOptional() @IsNumber() @Min(0) areaMin?: number
  @IsOptional() @IsNumber() @Min(0) areaMax?: number
  @IsOptional() @IsInt() @Min(0) priceFrom?: number
  @IsOptional() @IsInt() @Min(0) parking?: number
  @IsOptional() @IsBoolean() terraco?: boolean
  @IsOptional() @IsInt() order?: number
  // planta desta tipologia (upload retorna url+storageKey; salvos junto da lista)
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string
  @IsOptional() @IsString() @MaxLength(300) imageStorageKey?: string
}

// Criação: só o nome é obrigatório (nasce como rascunho).
export class CreateDevelopmentDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string
}

export class UpdateDevelopmentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string
  @IsOptional() @IsString() slug?: string
  @IsOptional() @IsString() @MaxLength(120) construtora?: string
  @IsOptional() @IsString() @MaxLength(40) tipo?: string
  @IsOptional() @IsString() descricao?: string

  @IsOptional() @IsString() @MaxLength(160) masterplanName?: string

  @IsOptional() @IsString() @MaxLength(2) uf?: string
  @IsOptional() @IsString() @MaxLength(120) cidade?: string
  @IsOptional() @IsString() @MaxLength(120) bairro?: string
  @IsOptional() @IsIn(REGIOES) regiao?: DevelopmentRegiao
  @IsOptional() @IsString() @MaxLength(240) endereco?: string
  @IsOptional() @IsString() @MaxLength(240) standEndereco?: string
  @IsOptional() @IsNumber() lat?: number
  @IsOptional() @IsNumber() lng?: number

  @IsOptional() @IsIn(STATUSES) status?: DevelopmentStatus
  @IsOptional() @IsInt() @Min(0) obraEvolucaoPct?: number
  @IsOptional() @IsString() @MaxLength(60) entregaLabel?: string

  @IsOptional() @IsInt() @Min(0) priceFrom?: number
  @IsOptional() @IsInt() @Min(0) priceMax?: number
  @IsOptional() @IsString() @MaxLength(120) programa?: string
  @IsOptional() @IsBoolean() aceitaFgts?: boolean
  @IsOptional() @IsInt() @Min(0) subsidioAte?: number
  @IsOptional() @IsInt() @Min(0) rendaMinima?: number
  @IsOptional() @IsInt() @Min(0) tetoHis1?: number
  @IsOptional() @IsInt() @Min(0) tetoHis2?: number
  @IsOptional() @IsInt() @Min(0) tetoHmp?: number

  @IsOptional() @IsInt() @Min(0) totalUnidades?: number
  @IsOptional() @IsInt() @Min(0) torres?: number
  @IsOptional() @IsString() @MaxLength(120) pavimentos?: string
  @IsOptional() @IsNumber() @Min(0) terrenoM2?: number

  @IsOptional() @IsArray() @IsIn(AMENITY_SLUGS, { each: true }) amenities?: string[]

  @IsOptional() @IsString() @MaxLength(200) incorporadora?: string
  @IsOptional() @IsString() @MaxLength(30) cnpj?: string
  @IsOptional() @IsString() @MaxLength(200) registroIncorporacao?: string

  @IsOptional() @IsString() @MaxLength(160) arquitetura?: string
  @IsOptional() @IsString() @MaxLength(160) paisagismo?: string
  @IsOptional() @IsString() @MaxLength(160) decoracao?: string

  @IsOptional() @IsString() @MaxLength(200) seoTitle?: string
  @IsOptional() @IsString() @MaxLength(300) seoDescription?: string

  // lista completa de tipologias (substitui a atual quando enviada)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TypologyInputDto)
  typologies?: TypologyInputDto[]
}

// metadados de uma imagem (legenda/ordem/tipo)
export class UpdateImageDto {
  @IsOptional() @IsString() @MaxLength(200) caption?: string
  @IsOptional() @IsInt() order?: number
  @IsOptional() @IsIn(['hero', 'lazer', 'planta']) kind?: 'hero' | 'lazer' | 'planta'
}

// filtros do catálogo público (query string)
export class DevelopmentFilterDto {
  @IsOptional() @IsIn(REGIOES) regiao?: DevelopmentRegiao
  @IsOptional() @IsString() bairro?: string // bairroSlug
  @IsOptional() @IsIn(STATUSES) status?: DevelopmentStatus
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) precoMin?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) precoMax?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) dorms?: number // dormitórios mínimos
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) vagas?: number // vagas mínimas
  @IsOptional() @IsString() amenities?: string // slugs separados por vírgula
  @IsOptional() @IsIn(['novidades', 'menor_preco', 'maior_preco']) sort?: string
}
