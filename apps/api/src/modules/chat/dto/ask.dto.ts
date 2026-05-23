import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator'

export class AskDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(8000)
  question: string

  @IsString()
  @IsUUID()
  sessionId: string
}
