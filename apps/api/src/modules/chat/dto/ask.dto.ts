import { IsString } from 'class-validator'

export class AskDto {
  @IsString()
  question: string

  @IsString()
  sessionId: string
}
