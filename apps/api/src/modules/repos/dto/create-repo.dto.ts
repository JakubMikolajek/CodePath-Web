import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export type RepoAuthType = 'https_token' | 'none' | 'ssh_key'

export class CreateRepoDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  accessKey?: string

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  authSecret?: string

  @IsIn(['none', 'https_token', 'ssh_key'])
  @IsOptional()
  authType?: RepoAuthType

  @IsOptional()
  @IsString()
  @MaxLength(255)
  authUsername?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  branch?: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(2048)
  gitUrl: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string
}
