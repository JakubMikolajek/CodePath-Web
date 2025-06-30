import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator'

export class FileDto {
  @IsString() path: string
  @IsString() lastModified: string
  @IsString() hash: string
}

export class CreateRepoDto {
  @IsString() name: string
  @IsString() path: string
  @IsNumber() userId: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[]
}
