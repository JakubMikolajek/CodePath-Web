import type { Nullable } from '@workspace/codepath-common'

const IGNORED_CALL_IDENTIFIERS = new Set([
  'and',
  'as',
  'assert',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'delete',
  'do',
  'elif',
  'else',
  'enum',
  'except',
  'export',
  'extends',
  'finally',
  'fn',
  'for',
  'from',
  'function',
  'if',
  'impl',
  'import',
  'in',
  'interface',
  'is',
  'lambda',
  'let',
  'loop',
  'match',
  'new',
  'or',
  'package',
  'pub',
  'raise',
  'return',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'throw',
  'trait',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield'
])

export class DependencyCodeExtractor {
  extractCallIdentifiers(content: string, language: string, fileExt: string): Set<string> {
    const calls = new Set<string>()

    if (!content.trim()) return calls

    const addCall = (candidate: Nullable<string>) => {
      if (!candidate) return

      const trimmed = candidate.trim()

      if (!trimmed || trimmed.length > 120 || IGNORED_CALL_IDENTIFIERS.has(trimmed)) return

      calls.add(trimmed)
    }

    if (language === 'python' || fileExt === '.py') {
      for (const match of content.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
        addCall(match[1] ?? null)
      }

      return calls
    }

    for (const match of content.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
      addCall(match[1] ?? null)
    }

    return calls
  }

  extractEventNames(content: string, edgeType: 'consumes' | 'produces'): Set<string> {
    const names = new Set<string>()
    const addEventName = (candidate: Nullable<string>) => {
      if (!candidate) return

      const normalized = candidate.trim()

      if (!normalized || normalized.length > 160) return

      names.add(normalized)
    }

    const producerPatterns = [
      /\b(?:emit|publish|send|dispatch)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:emit|publish|send|dispatch)\s+['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g
    ]

    const consumerPatterns = [
      /\b(?:on|subscribe|consume|listen|handle)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:on|subscribe|consume|listen|handle)\s+['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:basic_consume|assertQueue)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g
    ]

    const patterns = edgeType === 'produces' ? producerPatterns : consumerPatterns

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        addEventName(match[1] ?? null)
      }
    }

    return names
  }

  extractImportSpecifiers(content: string, language: string, fileExt: string): Set<string> {
    const importSpecifiers = new Set<string>()

    if (!content.trim()) return importSpecifiers

    const addSpecifier = (specifier: Nullable<string>): void => {
      if (!specifier) return

      const trimmed = specifier.trim()

      if (!trimmed || trimmed.length > 256) return

      importSpecifiers.add(trimmed)
    }

    const applyPattern = (pattern: RegExp, pickIndex = 1) => {
      for (const match of content.matchAll(pattern)) {
        addSpecifier(match[pickIndex] ?? null)
      }
    }

    applyPattern(/^\s*import\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/gm)
    applyPattern(/^\s*import\s+['"]([^'"]+)['"]/gm)
    applyPattern(/^\s*export\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/gm)
    applyPattern(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)
    applyPattern(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)
    applyPattern(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm)
    applyPattern(/^\s*use\s+([A-Za-z0-9_:]+)\s*;/gm)
    applyPattern(/^\s*import\s+([A-Za-z0-9_.*]+)\s*;/gm)
    applyPattern(/^\s*import\s*(?:\(\s*)?["'`]([^"'`]+)["'`]/gm)

    if (language === 'python' || fileExt === '.py') {
      for (const match of content.matchAll(/^\s*import\s+([A-Za-z0-9_.,\s]+)/gm)) {
        const modules = (match[1] ?? '').split(',')
          .map(moduleName => moduleName.trim().split(/\s+as\s+/i)[0]?.trim())
          .filter(Boolean)

        for (const moduleName of modules) {
          addSpecifier(moduleName ?? null)
        }
      }
    }

    return importSpecifiers
  }
}
