import { IsNotEmpty, IsString } from 'class-validator'

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  identifier: string

  @IsNotEmpty()
  @IsString()
  password: string
}
