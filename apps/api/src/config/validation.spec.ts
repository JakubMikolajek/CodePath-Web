import { BadRequestException } from '@nestjs/common'

import { AskDto } from '../modules/chat/dto/ask.dto'
import { CreateRepoDto } from '../modules/repos/dto/create-repo.dto'
import { createApiValidationPipe } from './validation'

describe('API boundary validation', () => {
  it('rejects unknown fields on DTO payloads', async () => {
    const pipe = createApiValidationPipe()

    await expect(pipe.transform({
      gitUrl: 'https://github.com/acme/demo.git',
      name: 'demo',
      unexpected: 'field'
    }, {
      data: '',
      metatype: CreateRepoDto,
      type: 'body'
    })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects empty repository name', async () => {
    const pipe = createApiValidationPipe()

    await expect(pipe.transform({
      gitUrl: 'https://github.com/acme/demo.git',
      name: ''
    }, {
      data: '',
      metatype: CreateRepoDto,
      type: 'body'
    })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects chat payloads without a UUID session id', async () => {
    const pipe = createApiValidationPipe()

    await expect(pipe.transform({
      question: 'What does this repo do?',
      sessionId: 'not-a-uuid'
    }, {
      data: '',
      metatype: AskDto,
      type: 'body'
    })).rejects.toBeInstanceOf(BadRequestException)
  })
})
