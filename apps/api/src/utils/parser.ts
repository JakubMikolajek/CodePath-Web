import { Logger } from '@nestjs/common'
import type { DependencyType, SegmentKind } from '@workspace/codepath-common/globals'
import { forEach, has } from 'lodash'
import type { SyntaxNode } from 'tree-sitter'
import Parser from 'tree-sitter'
import { Project, SyntaxKind } from 'ts-morph'

export interface Segment {
  code: string
  comment?: string
  decorators?: string[]
  endLine: number
  jsDoc?: string
  kind: SegmentKind
  name?: string
  params?: string[]
  returnType?: string
  startLine: number
}

export interface DepEdge {
  from: string
  importedFrom?: string
  to: string
  type: DependencyType
}

interface ParsedFile {
  parsedDependencies: DepEdge[]
  parsedSegments: Segment[]
}

const logger = new Logger('Parser')

const extToLang = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.vue': 'vue'
} as const

const unsupportedExts = new Set([
  '.json', '.md', '.cjs', '', '.lock', '.env'
])

export function parseSegments(src: string, ext: string, filePath: string): ParsedFile {
  logger.log(`[parser] parsing file: ${filePath} ext: "${ext}"`)

  if (has(unsupportedExts, ext)) {
    logger.log(`[parser] unsupported extension "${ext}", returning full file as-is`)
    return {
      parsedDependencies: [],
      parsedSegments: [{
        code: src,
        endLine: src.split('\n').length,
        kind: 'file',
        startLine: 1
      }]
    }
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

    return {
      parsedDependencies: [],
      parsedSegments: [{
        code: src,
        endLine: src.split('\n').length,
        kind: 'file',
        startLine: 1
      }]
    }
  }

  let Lang

  try {
    Lang = require(`tree-sitter-${lang}`)
  } catch (err) {
    logger.error(`[parser] failed to load tree-sitter-${lang}:`, err)

    return {
      parsedDependencies: [],
      parsedSegments: [{
        code: src,
        endLine: src.split('\n').length,
        kind: 'file',
        startLine: 1
      }]
    }
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
    // Attempt to find preceding comments
    let comment = ''
    let prev = n.previousSibling
    while (prev && (prev.type === 'comment' || prev.type === 'string_literal' || prev.type === 'doc_string')) { // python doc_string
      comment = prev.text + '\n' + comment
      prev = prev.previousSibling
    }

    // For Python, check body for docstring if it's a function/class
    if (!comment && (kind === 'function' || kind === 'class')) {
      const body = n.childForFieldName?.('body')
      if (body && body.firstNamedChild && body.firstNamedChild.type === 'expression_statement') {
        const expr = body.firstNamedChild.firstNamedChild
        if (expr && expr.type === 'string') {
          comment = expr.text
        }
      }
    }

    segments.push({
      code: src.slice(n.startIndex, n.endIndex),
      comment: comment.trim() || undefined,
      endLine: n.endPosition.row + 1,
      kind,
      name: name ?? 'anonymous',
      startLine: n.startPosition.row + 1
    })
  }

  visit(tree.rootNode)

  if (!segments.length) {
    logger.log('[parser] no segments detected, returning full file')

    return {
      parsedDependencies: dependencies,
      parsedSegments: [{
        code: src,
        endLine: src.split('\n').length,
        kind: 'file',
        startLine: 1
      }]
    }
  }

  logger.log(`[parser] extracted ${segments.length} segments`)

  return { parsedDependencies: dependencies, parsedSegments: segments }
}

function parseWithTsMorph(src: string, filePath: string): ParsedFile {
  const project = new Project({ useInMemoryFileSystem: true })
  const sourceFile = project.createSourceFile(filePath, src)

  const segments: Segment[] = []
  const dependencies: DepEdge[] = []

  const importMap = new Map<string, string>()

  forEach(sourceFile.getImportDeclarations(), imp => {
    const module = imp.getModuleSpecifierValue()

    forEach(imp.getNamedImports(), named => importMap.set(named.getName(), module))

    const def = imp.getDefaultImport()
    if (def) importMap.set(def.getText(), module)

    dependencies.push({ from: filePath, to: module, type: 'import' })
    segments.push({
      code: imp.getText(),
      endLine: imp.getEndLineNumber(),
      kind: 'import',
      startLine: imp.getStartLineNumber()
    })
  })

  forEach(sourceFile.getClasses(), cls => {
    const className = cls.getName()
    const decorators = cls.getDecorators().map(d => d.getText())
    const comment = cls.getJsDocs().map(doc => doc.getCommentText()).join('\n')
    const ext = cls.getExtends()

    if (ext) {
      dependencies.push({ from: className!, to: ext.getText(), type: 'extends' })
    }

    segments.push({
      code: cls.getText(),
      comment,
      decorators,
      endLine: cls.getEndLineNumber(),
      kind: 'class',
      name: className || 'anonymous',
      startLine: cls.getStartLineNumber()
    })

    forEach(cls.getMethods(), method => {
      const methodName = method.getName()
      const methodComment = method.getJsDocs().map(doc => doc.getCommentText()).join('\n')
      const methodParams = method.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`)
      const methodReturns = method.getReturnType().getText()
      const methodDecorators = method.getDecorators().map(d => d.getText())

      segments.push({
        code: method.getText(),
        comment: methodComment,
        decorators: methodDecorators,
        endLine: method.getEndLineNumber(),
        kind: 'method' as SegmentKind,
        name: `${className}.${methodName}`,
        params: methodParams,
        returnType: methodReturns,
        startLine: method.getStartLineNumber()
      })
    })
  })

  forEach(sourceFile.getInterfaces(), intf => {
    const name = intf.getName()
    const comment = intf.getJsDocs().map(doc => doc.getCommentText()).join('\n')

    segments.push({
      code: intf.getText(),
      comment,
      endLine: intf.getEndLineNumber(),
      kind: 'class',
      name: name,
      startLine: intf.getStartLineNumber()
    })
  })

  forEach(sourceFile.getTypeAliases(), typeAlias => {
    const name = typeAlias.getName()
    const comment = typeAlias.getJsDocs().map(doc => doc.getCommentText()).join('\n')

    segments.push({
      code: typeAlias.getText(),
      comment,
      endLine: typeAlias.getEndLineNumber(),
      kind: 'function',
      name: name,
      startLine: typeAlias.getStartLineNumber()
    })
  })

  forEach(sourceFile.getVariableStatements(), stmt => {
    const decls = stmt.getDeclarations()
    const comment = stmt.getJsDocs().map(doc => doc.getCommentText()).join('\n')

    decls.forEach(decl => {
      segments.push({
        code: stmt.getText(),
        comment,
        endLine: stmt.getEndLineNumber(),
        kind: 'function',
        name: decl.getName(),
        startLine: stmt.getStartLineNumber()
      })
    })
  })

  forEach(sourceFile.getFunctions(), fn => {
    const name = fn.getName()
    const comment = fn.getJsDocs().map(doc => doc.getCommentText()).join('\n')
    const params = fn.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`)
    const returns = fn.getReturnType().getText()

    segments.push({
      code: fn.getText(),
      comment,
      endLine: fn.getEndLineNumber(),
      kind: 'function',
      name: name || 'anonymous',
      params,
      returnType: returns,
      startLine: fn.getStartLineNumber()
    })
  })

  forEach(sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression), call => {
    const fromFn = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
    const fnName = call.getExpression().getText()

    if (fromFn && fromFn.getName()) {
      const importedFrom = importMap.get(fnName)

      dependencies.push({
        from: fromFn.getName() ?? '<anonymous>',
        importedFrom,
        to: fnName,
        type: 'calls'
      })
    }
  })

  return { parsedDependencies: dependencies, parsedSegments: segments }
}
