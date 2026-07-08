import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class UpdateActivityDto {
  @IsOptional() @IsString() @MaxLength(40) type?: string
  @IsOptional() @IsString() @MaxLength(2000) title?: string
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsDateString() dueAt?: string
  @IsOptional() @IsBoolean() done?: boolean
}
