import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class StartViewDto {
  @IsOptional() @IsString() sessionId?: string
  @IsOptional() @IsString() device?: string
  @IsOptional() @IsString() referrer?: string
}

export class HeartbeatDto {
  @IsInt() @Min(0) activeSeconds!: number

  @IsInt() @Min(0) @Max(100) maxScroll!: number

  @IsOptional() @IsArray() buckets?: number[]
}
