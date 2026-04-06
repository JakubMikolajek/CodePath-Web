import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'

export class RegisterDto {
  @IsEmail()
  email: string

  @IsNotEmpty()
  @IsString()
  login: string

  @IsString()
  @MinLength(8)
  password: string
}
