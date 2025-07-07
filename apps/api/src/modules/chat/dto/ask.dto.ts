import { IsOptional, IsString } from 'class-validator'

export class AskDto {
  @IsString()
  question: string

  @IsString()
  @IsOptional()
  sessionId?: string
}
