import { Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested } from 'class-validator'

export class FileDto {
  @IsString() path: string
  @IsString() lastModified: string
  @IsString() hash: string
}

export class CreateRepoDto {
  @IsString() name: string
  @IsString() path: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[]
}
