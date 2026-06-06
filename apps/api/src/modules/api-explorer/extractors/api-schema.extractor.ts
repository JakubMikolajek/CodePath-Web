import { RepoOpenApiSchemaType } from '@workspace/codepath-common/api-explorer'
import type { RepoOpenApiSchema } from '@workspace/codepath-common/api-explorer'

export class ApiSchemaExtractor {
  extractSchemasFromContent(content: string): Record<string, RepoOpenApiSchema> {
    if (!content.trim()) {
      return {}
    }

    return {
      ...this.extractTypeScriptObjectSchemas(content),
      ...this.extractPythonObjectSchemas(content)
    }
  }

  private extractBracedBlock(content: string, startBraceIndex: number): null | string {
    if (startBraceIndex < 0 || startBraceIndex >= content.length || content[startBraceIndex] !== '{') {
      return null
    }

    let depth = 0
    for (let index = startBraceIndex; index < content.length; index += 1) {
      const char = content[index]
      if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          return content.slice(startBraceIndex + 1, index)
        }
      }
    }

    return null
  }

  private extractPythonObjectSchemas(content: string): Record<string, RepoOpenApiSchema> {
    const schemas: Record<string, RepoOpenApiSchema> = {}
    const classPattern = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:\s*$/gm

    for (const classMatch of content.matchAll(classPattern)) {
      const typeName = this.normalizeTypeName(classMatch[1])
      const bases = classMatch[2] ?? ''
      if (!typeName || !/\b(BaseModel|Serializer|Schema)\b/.test(bases)) {
        continue
      }

      const start = classMatch.index ?? 0
      const afterClass = content.slice(start)
      const bodyMatch = afterClass.match(/^class[^\n]*\n((?:[ \t]+[^\n]*\n?)*)/m)
      const body = bodyMatch?.[1] ?? ''
      const properties: Record<string, RepoOpenApiSchema> = {}
      const required: string[] = []

      for (const fieldMatch of body.matchAll(/^[ \t]+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^\n=]+)(?:\s*=\s*(.+))?$/gm)) {
        const name = fieldMatch[1] ?? ''
        const rawType = fieldMatch[2] ?? ''
        if (!name) {
          continue
        }

        properties[name] = this.inferSchemaFromTypeHint(rawType)

        const hasDefault = typeof fieldMatch[3] === 'string' && fieldMatch[3].trim().length > 0
        if (!hasDefault && !/\bOptional\[/i.test(rawType)) {
          required.push(name)
        }
      }

      if (Object.keys(properties).length === 0) {
        continue
      }

      schemas[typeName] = {
        properties,
        required: required.length > 0 ? required : undefined,
        type: RepoOpenApiSchemaType.OBJECT
      }
    }

    return schemas
  }

  private extractTypeScriptObjectSchemas(content: string): Record<string, RepoOpenApiSchema> {
    const schemas: Record<string, RepoOpenApiSchema> = {}
    const objectPattern = /\b(?:export\s+)?(?:class|interface|type)\s+([A-Z][A-Za-z0-9_]*)\b/g

    for (const match of content.matchAll(objectPattern)) {
      const typeName = this.normalizeTypeName(match[1])
      if (!typeName || /(Controller|Service|Repository|Module)$/.test(typeName)) {
        continue
      }

      const declarationStart = match.index ?? 0
      const braceIndex = content.indexOf('{', declarationStart)
      if (braceIndex < 0) {
        continue
      }

      const block = this.extractBracedBlock(content, braceIndex)
      if (!block) {
        continue
      }

      const properties: Record<string, RepoOpenApiSchema> = {}
      const required: string[] = []
      for (const propertyMatch of block.matchAll(/(?:public\s+|private\s+|protected\s+|readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??\s*:\s*([^;\n=]+)/g)) {
        const name = propertyMatch[1] ?? ''
        const rawType = propertyMatch[2] ?? ''
        if (!name) {
          continue
        }

        const schema = this.inferSchemaFromTypeHint(rawType)
        properties[name] = schema

        if (!propertyMatch[0].includes('?')) {
          required.push(name)
        }
      }

      if (Object.keys(properties).length === 0) {
        continue
      }

      schemas[typeName] = {
        properties,
        required: required.length > 0 ? required : undefined,
        type: RepoOpenApiSchemaType.OBJECT
      }
    }

    return schemas
  }

  private inferSchemaFromTypeHint(rawType: string): RepoOpenApiSchema {
    const normalized = rawType
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\(/, '')
      .replace(/\)$/, '')
    const lower = normalized.toLowerCase()

    if (!normalized) {
      return { type: RepoOpenApiSchemaType.STRING }
    }

    if (lower.startsWith('array<') || /\[\]$/.test(normalized) || lower.startsWith('list[') || lower.startsWith('sequence[')) {
      return {
        items: { type: RepoOpenApiSchemaType.STRING },
        type: RepoOpenApiSchemaType.ARRAY
      }
    }

    if (/\b(boolean|bool)\b/i.test(normalized)) {
      return { type: RepoOpenApiSchemaType.BOOLEAN }
    }

    if (/\b(number|float|double|decimal)\b/i.test(normalized)) {
      return { type: RepoOpenApiSchemaType.NUMBER }
    }

    if (/\b(integer|int)\b/i.test(normalized)) {
      return { type: RepoOpenApiSchemaType.INTEGER }
    }

    if (/\b(object|dict|record)\b/i.test(normalized)) {
      return {
        additionalProperties: true,
        type: RepoOpenApiSchemaType.OBJECT
      }
    }

    return { type: RepoOpenApiSchemaType.STRING }
  }

  private normalizeTypeName(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined
    }

    const normalized = value
      .trim()
      .split(/[\s<>\[\],|]/)[0]
      ?.replace(/^.*\./, '')
      ?.replace(/[^A-Za-z0-9_]/g, '')

    if (!normalized || normalized.length === 0) {
      return undefined
    }

    return normalized
  }
}
