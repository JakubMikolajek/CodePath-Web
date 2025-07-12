import { Logger } from '@nestjs/common'
import { forEach, has } from 'lodash'
import Parser, { SyntaxNode } from 'tree-sitter'
import { Project, SyntaxKind } from 'ts-morph'

interface Segment {
  kind: 'import' | 'function' | 'class' | 'file'
  name?: string
  code: string
}

export interface DepEdge {
  from: string
  to: string
  type: 'import' | 'extends' | 'calls'
  importedFrom?: string
}

interface ParsedFile {
  segments: Segment[]
  dependencies: DepEdge[]
}

const logger = new Logger('Parser')

const extToLang = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.vue': 'vue',
  '.py': 'python',
} as const

const unsupportedExts = new Set([
  '.json', '.md', '.cjs', '', '.lock', '.env',
])

export function parseSegments(src: string, ext: string, filePath: string): ParsedFile {
  logger.log(`[parser] parsing file: ${filePath} ext: "${ext}"`)

  if (has(unsupportedExts, ext)) {
    logger.log(`[parser] unsupported extension "${ext}", returning full file as-is`)
    return { segments: [{ kind: 'file', code: src }], dependencies: [] }
  }

  if (ext === '.ts' || ext === '.tsx') {
    return parseWithTsMorph(src, filePath)
  }

  if (ext === '.vue') {
    const { parse: parseSFC } = require('@vue/compiler-sfc')
    const { descriptor } = parseSFC(src)
    const scriptBlock = descriptor.script ?? descriptor.scriptSetup

    src = scriptBlock?.content ?? ''
    ext = scriptBlock?.lang === 'ts' ? '.ts' : '.js'

    logger.log(`[parser] detected .vue, switching to script block with extension: "${ext}"`)
  }

  const lang = extToLang[ext as keyof typeof extToLang]

  if (!lang) {
    logger.log(`[parser] no mapping found for extension "${ext}", returning full file as-is`)

    return { segments: [{ kind: 'file', code: src }], dependencies: [] }
  }

  let Lang

  try {
    Lang = require(`tree-sitter-${lang}`)
  }
  catch (err) {
    logger.error(`[parser] failed to load tree-sitter-${lang}:`, err)

    return { segments: [{ kind: 'file', code: src }], dependencies: [] }
  }

  const parser = new Parser()
  parser.setLanguage(Lang)

  const tree = parser.parse(src)
  const segments: Segment[] = []
  const dependencies: DepEdge[] = []

  function visit(node: SyntaxNode) {
    switch (node.type) {
      case 'import_statement':
      case 'import_from_statement':
        const importText = node.text
        const match = /['"]([^'"]+)['"]/.exec(importText)
        if (match) {
          dependencies.push({ from: filePath, to: match[1], type: 'import' })
        }
        push(node, 'import')
        break

      case 'function_declaration':
      case 'method_definition':
      case 'function_definition':
        push(node, 'function', getName(node))
        break

      case 'class_declaration':
      case 'class_definition':
        const className = getName(node)
        const superClass = node.childForFieldName?.('superclass')?.text

        if (className && superClass) {
          dependencies.push({ from: className, to: superClass, type: 'extends' })
        }

        push(node, 'class', className)
        break
    }

    node.namedChildren.forEach(visit)
  }

  function getName(node: SyntaxNode) {
    return node.childForFieldName?.('name')?.text
      ?? node.namedChildren[0]?.text
  }

  function push(n: SyntaxNode, kind: Segment['kind'], name?: string) {
    segments.push({ kind, name, code: src.slice(n.startIndex, n.endIndex) })
  }

  visit(tree.rootNode)

  if (!segments.length) {
    logger.log(`[parser] no segments detected, returning full file`)

    return { segments: [{ kind: 'file', code: src }], dependencies }
  }

  logger.log(`[parser] extracted ${segments.length} segments`)

  return { segments, dependencies }
}

function parseWithTsMorph(src: string, filePath: string): ParsedFile {
  const project = new Project({ useInMemoryFileSystem: true })
  const sourceFile = project.createSourceFile(filePath, src)

  const segments: Segment[] = []
  const dependencies: DepEdge[] = []

  const importMap = new Map<string, string>()

  forEach(sourceFile.getImportDeclarations(), (imp) => {
    const module = imp.getModuleSpecifierValue()

    forEach(imp.getNamedImports(), named => importMap.set(named.getName(), module))

    const def = imp.getDefaultImport()

    if (def) {
      importMap.set(def.getText(), module)
    }

    dependencies.push({ from: filePath, to: module, type: 'import' })
    segments.push({ kind: 'import', code: imp.getText() })
  })

  forEach(sourceFile.getClasses(), (cls) => {
    segments.push({ kind: 'class', name: cls.getName(), code: cls.getText() })

    const ext = cls.getExtends()

    if (ext) {
      dependencies.push({ from: cls.getName()!, to: ext.getText(), type: 'extends' })
    }
  })

  forEach(sourceFile.getFunctions(), (fn) => {
    segments.push({ kind: 'function', name: fn.getName(), code: fn.getText() })
  })

  forEach(sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression), (call) => {
    const fromFn = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
    const fnName = call.getExpression().getText()

    if (fromFn && fromFn.getName()) {
      const importedFrom = importMap.get(fnName)

      dependencies.push({
        from: fromFn.getName() ?? '<anonymous>',
        to: fnName,
        type: 'calls',
        importedFrom,
      })
    }
  })

  return { segments, dependencies }
}
