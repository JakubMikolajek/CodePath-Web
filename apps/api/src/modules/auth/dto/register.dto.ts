import { IsString } from 'class-validator'

export class RegisterDto {
  @IsString()
  email: string

  @IsString()
  login: string

  @IsString()
  password: string
}
