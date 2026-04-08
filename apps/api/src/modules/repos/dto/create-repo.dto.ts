import { IsIn, IsOptional, IsString } from 'class-validator'

export type RepoAuthType = 'https_token' | 'none' | 'ssh_key'

export class CreateRepoDto {
  @IsOptional()
  @IsString()
  accessKey?: string

  @IsOptional()
  @IsString()
  authSecret?: string

  @IsIn(['none', 'https_token', 'ssh_key'])
  @IsOptional()
  authType?: RepoAuthType

  @IsOptional()
  @IsString()
  authUsername?: string

  @IsOptional()
  @IsString()
  branch?: string

  @IsString()
  gitUrl: string

  @IsString()
  name: string
}
