import { IsString } from 'class-validator'

export class CreateRepoDto {
  @IsString()
  name: string

  @IsString()
  gitUrl: string

  @IsString()
  accessKey: string
}
