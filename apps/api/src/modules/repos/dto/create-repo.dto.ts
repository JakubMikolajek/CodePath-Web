import { IsString } from 'class-validator'

export class CreateRepoDto {
  @IsString()
  accessKey: string

  @IsString()
  gitUrl: string

  @IsString()
  name: string
}
