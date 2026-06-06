import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export enum RepoAuthType {
  HTTPS_TOKEN = 'https_token',
  NONE = 'none',
  SSH_KEY = 'ssh_key',
}

export class CreateRepoDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  accessKey?: string

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  authSecret?: string

  @IsEnum(RepoAuthType)
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
