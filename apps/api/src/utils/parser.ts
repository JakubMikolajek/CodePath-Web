import { Logger } from '@nestjs/common'
import type { DependencyType, SegmentKind } from '@workspace/codepath-common/globals'
import type { SyntaxNode } from 'tree-sitter'
import Parser from 'tree-sitter'
import {
  type ArrowFunction,
  type CallExpression,
  type Expression,
  type FunctionExpression,
  type Node,
  Project,
  SyntaxKind
} from 'ts-morph'

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
  '.cjs': 'javascript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.vue': 'vue'
} as const

const unsupportedExts = new Set([
  '', '.env', '.json', '.lock', '.md'
])

const tsExts = new Set(['.ts', '.tsx', '.mts', '.cts'])

const tsProject = new Project({ useInMemoryFileSystem: true })
const parserByLang = new Map<string, Parser>()
const treeSitterLangByLang = new Map<string, Parser.Language>()

export function resolveCodeLanguageFromExt(ext: string): string {
  const normalizedExt = normalizeExt(ext)

  if (normalizedExt === '.ts' || normalizedExt === '.tsx' || normalizedExt === '.mts' || normalizedExt === '.cts') {
    return 'typescript'
  }

  if (normalizedExt === '.js' || normalizedExt === '.jsx' || normalizedExt === '.mjs' || normalizedExt === '.cjs') {
    return 'javascript'
  }

  if (normalizedExt === '.py' || normalizedExt === '.pyi') {
    return 'python'
  }

  if (normalizedExt === '.vue') {
    return 'vue'
  }

  return 'unknown'
}

export function parseSegments(src: string, ext: string, filePath: string): ParsedFile {
  const normalizedExt = normalizeExt(ext)
  logger.log(`[parser] parsing file: ${filePath} ext: "${normalizedExt}"`)

  if (unsupportedExts.has(normalizedExt)) {
    logger.log(`[parser] unsupported extension "${normalizedExt}", returning full file as-is`)
    return fullFileFallback(src)
  }

  if (normalizedExt === '.vue') {
    const vueSource = extractVueScriptSource(src)

    if (!vueSource.content.trim()) {
      logger.log('[parser] .vue file has no script content, returning full file')
      return fullFileFallback(src)
    }

    return parseSegments(vueSource.content, vueSource.ext, filePath)
  }

  if (tsExts.has(normalizedExt)) {
    return parseWithTsMorph(src, filePath)
  }

  const lang = extToLang[normalizedExt as keyof typeof extToLang]
  if (!lang) {
    logger.log(`[parser] no mapping for extension "${normalizedExt}", returning full file as-is`)
    return fullFileFallback(src)
  }

  let parser: Parser

  try {
    parser = getTreeSitterParser(lang)
  } catch (err) {
    logger.error(`[parser] failed to initialize tree-sitter-${lang}:`, err)
    return fullFileFallback(src)
  }

  const tree = parser.parse(src)
  const segments: Segment[] = []
  const dependencies: DepEdge[] = []

  const segmentKeys = new Set<string>()
  const dependencyKeys = new Set<string>()

  const pushDependency = (dep: DepEdge) => {
    const key = `${dep.type}|${dep.from}|${dep.to}|${dep.importedFrom ?? ''}`
    if (dependencyKeys.has(key)) {
      return
    }
    dependencyKeys.add(key)
    dependencies.push(dep)
  }

  const pushSegment = (node: SyntaxNode, kind: Segment['kind'], name?: string) => {
    const startLine = node.startPosition.row + 1
    const endLine = node.endPosition.row + 1
    const resolvedName = name ?? 'anonymous'

    const key = `${kind}|${resolvedName}|${startLine}|${endLine}`
    if (segmentKeys.has(key)) {
      return
    }

    segmentKeys.add(key)

    let comment = collectPrecedingComment(node)

    if (!comment && (kind === 'function' || kind === 'class' || kind === 'method')) {
      comment = readPythonDocstring(node)
    }

    segments.push({
      code: src.slice(node.startIndex, node.endIndex),
      comment: comment || undefined,
      endLine,
      kind,
      name: resolvedName,
      startLine
    })
  }

  const visit = (node: SyntaxNode) => {
    switch (node.type) {
      case 'import_statement':
      case 'import_from_statement': {
        const moduleName = extractQuotedModule(node.text)
        if (moduleName) {
          pushDependency({ from: filePath, to: moduleName, type: 'import' })
        }
        pushSegment(node, 'import')
        break
      }

      case 'lexical_declaration':
      case 'variable_declaration': {
        for (const fnVar of extractFunctionLikeVariables(node)) {
          pushSegment(fnVar.varNode, 'function', fnVar.name)
        }
        break
      }

      case 'call_expression': {
        const callName = extractTreeSitterCallName(node)
        const fromName = getEnclosingCallableName(node)

        if (callName && fromName) {
          pushDependency({
            from: fromName,
            to: callName,
            type: 'calls'
          })
        }

        // CommonJS require("module") support in JS for import graph quality.
        if (isRequireCall(node)) {
          const requiredModule = extractQuotedModule(node.text)
          if (requiredModule) {
            pushDependency({ from: filePath, to: requiredModule, type: 'import' })
          }
        }

        break
      }

      case 'function_declaration':
      case 'function_definition': {
        const kind: Segment['kind'] = isInsideClass(node) ? 'method' : 'function'
        pushSegment(node, kind, getNodeName(node))
        break
      }

      case 'method_definition':
        pushSegment(node, 'method', getNodeName(node))
        break

      case 'class_declaration':
      case 'class_definition': {
        const className = getNodeName(node)
        const superClass = node.childForFieldName?.('superclass')?.text

        if (className && superClass) {
          pushDependency({ from: className, to: superClass, type: 'extends' })
        }

        pushSegment(node, 'class', className)
        break
      }
    }

    for (const child of node.namedChildren) {
      visit(child)
    }
  }

  visit(tree.rootNode)

  if (segments.length === 0) {
    logger.log('[parser] no segments detected, returning full file')
    return {
      parsedDependencies: dependencies,
      parsedSegments: fullFileFallback(src).parsedSegments
    }
  }

  logger.log(`[parser] extracted ${segments.length} segments, ${dependencies.length} deps`)
  return { parsedDependencies: dependencies, parsedSegments: segments }
}

function parseWithTsMorph(src: string, filePath: string): ParsedFile {
  const normalizedPath = filePath || `in-memory-${Date.now()}.ts`
  const existing = tsProject.getSourceFile(normalizedPath)
  if (existing) {
    existing.replaceWithText(src)
  }

  const sourceFile = existing ?? tsProject.createSourceFile(normalizedPath, src, { overwrite: true })

  const segments: Segment[] = []
  const dependencies: DepEdge[] = []
  const segmentKeys = new Set<string>()
  const dependencyKeys = new Set<string>()

  const importMap = new Map<string, string>()

  const pushDependency = (dep: DepEdge) => {
    const key = `${dep.type}|${dep.from}|${dep.to}|${dep.importedFrom ?? ''}`
    if (dependencyKeys.has(key)) {
      return
    }
    dependencyKeys.add(key)
    dependencies.push(dep)
  }

  const pushSegment = (segment: Segment) => {
    const key = `${segment.kind}|${segment.name ?? 'anonymous'}|${segment.startLine}|${segment.endLine}`
    if (segmentKeys.has(key)) {
      return
    }
    segmentKeys.add(key)
    segments.push(segment)
  }

  for (const imp of sourceFile.getImportDeclarations()) {
    const module = imp.getModuleSpecifierValue()

    for (const named of imp.getNamedImports()) {
      importMap.set(named.getName(), module)
    }

    const def = imp.getDefaultImport()
    if (def) {
      importMap.set(def.getText(), module)
    }

    const namespace = imp.getNamespaceImport()
    if (namespace) {
      importMap.set(namespace.getText(), module)
    }

    pushDependency({ from: filePath, to: module, type: 'import' })
    pushSegment({
      code: imp.getText(),
      endLine: imp.getEndLineNumber(),
      kind: 'import',
      startLine: imp.getStartLineNumber()
    })
  }

  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName() || 'anonymous'
    const decorators = cls.getDecorators().map(d => d.getText())
    const comment = cls.getJsDocs().map(doc => doc.getCommentText()).join('\n')
    const ext = cls.getExtends()

    if (ext) {
      pushDependency({ from: className, to: ext.getText(), type: 'extends' })
    }

    pushSegment({
      code: cls.getText(),
      comment: comment || undefined,
      decorators,
      endLine: cls.getEndLineNumber(),
      kind: 'class',
      name: className,
      startLine: cls.getStartLineNumber()
    })

    for (const method of cls.getMethods()) {
      const methodName = method.getName()
      const methodComment = method.getJsDocs().map(doc => doc.getCommentText()).join('\n')
      const methodParams = method.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`)
      const methodReturns = method.getReturnType().getText()
      const methodDecorators = method.getDecorators().map(d => d.getText())

      pushSegment({
        code: method.getText(),
        comment: methodComment || undefined,
        decorators: methodDecorators,
        endLine: method.getEndLineNumber(),
        kind: 'method',
        name: `${className}.${methodName}`,
        params: methodParams,
        returnType: methodReturns,
        startLine: method.getStartLineNumber()
      })
    }
  }

  for (const intf of sourceFile.getInterfaces()) {
    const name = intf.getName()
    const comment = intf.getJsDocs().map(doc => doc.getCommentText()).join('\n')

    pushSegment({
      code: intf.getText(),
      comment: comment || undefined,
      endLine: intf.getEndLineNumber(),
      kind: 'class',
      name,
      startLine: intf.getStartLineNumber()
    })
  }

  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName()
    const comment = typeAlias.getJsDocs().map(doc => doc.getCommentText()).join('\n')

    pushSegment({
      code: typeAlias.getText(),
      comment: comment || undefined,
      endLine: typeAlias.getEndLineNumber(),
      kind: 'function',
      name,
      startLine: typeAlias.getStartLineNumber()
    })
  }

  for (const stmt of sourceFile.getVariableStatements()) {
    const comment = stmt.getJsDocs().map(doc => doc.getCommentText()).join('\n')

    for (const decl of stmt.getDeclarations()) {
      const initializer = decl.getInitializer()
      if (!initializer || !isFunctionLikeInitializer(initializer)) {
        continue
      }

      const params = readFunctionLikeParams(initializer)
      const returns = readFunctionLikeReturnType(initializer)

      pushSegment({
        code: stmt.getText(),
        comment: comment || undefined,
        endLine: stmt.getEndLineNumber(),
        kind: 'function',
        name: decl.getName(),
        params,
        returnType: returns,
        startLine: stmt.getStartLineNumber()
      })
    }
  }

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName() || 'anonymous'
    const comment = fn.getJsDocs().map(doc => doc.getCommentText()).join('\n')
    const params = fn.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`)
    const returns = fn.getReturnType().getText()

    pushSegment({
      code: fn.getText(),
      comment: comment || undefined,
      endLine: fn.getEndLineNumber(),
      kind: 'function',
      name,
      params,
      returnType: returns,
      startLine: fn.getStartLineNumber()
    })
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const fromName = getTsEnclosingCallableName(call)
    const callTarget = getCallTarget(call)
    if (!fromName || !callTarget) {
      continue
    }

    const importedFrom = importMap.get(callTarget.lookupKey)

    pushDependency({
      from: fromName,
      importedFrom,
      to: callTarget.name,
      type: 'calls'
    })
  }

  sourceFile.forget()
  return { parsedDependencies: dependencies, parsedSegments: segments }
}

function normalizeExt(ext: string): string {
  return (ext || '').trim().toLowerCase()
}

function fullFileFallback(src: string): ParsedFile {
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

function extractVueScriptSource(src: string): { content: string; ext: string } {
  type VueScriptBlock = {
    content: string
    lang?: string
  }
  type VueSfcParser = {
    parse: (source: string) => {
      descriptor: {
        script?: VueScriptBlock
        scriptSetup?: VueScriptBlock
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vueCompiler = require('@vue/compiler-sfc') as VueSfcParser
  const { descriptor } = vueCompiler.parse(src)
  const blocks = [descriptor.script, descriptor.scriptSetup].filter(Boolean)
  const content = blocks.map(block => block?.content).join('\n\n')
  const ext = blocks.some(block => block?.lang === 'ts') ? '.ts' : '.js'

  return { content, ext }
}

function getTreeSitterParser(lang: string): Parser {
  const cached = parserByLang.get(lang)
  if (cached) {
    return cached
  }

  let treeSitterLang = treeSitterLangByLang.get(lang)
  if (!treeSitterLang) {
    // eslint-disable-next-line security/detect-non-literal-require, @typescript-eslint/no-require-imports
    treeSitterLang = require(`tree-sitter-${lang}`) as Parser.Language
    treeSitterLangByLang.set(lang, treeSitterLang)
  }

  const parser = new Parser()
  parser.setLanguage(treeSitterLang)
  parserByLang.set(lang, parser)
  return parser
}

function extractQuotedModule(text: string): null | string {
  const match = /['"]([^'"]+)['"]/.exec(text)
  return match?.[1] ?? null
}

function collectPrecedingComment(node: SyntaxNode): string {
  let comment = ''
  let prev = node.previousSibling

  while (prev && (prev.type === 'comment' || prev.type === 'string_literal' || prev.type === 'doc_string')) {
    comment = `${prev.text}\n${comment}`
    prev = prev.previousSibling
  }

  return comment.trim()
}

function readPythonDocstring(node: SyntaxNode): string {
  const body = node.childForFieldName?.('body')
  if (!body || !body.firstNamedChild || body.firstNamedChild.type !== 'expression_statement') {
    return ''
  }

  const expr = body.firstNamedChild.firstNamedChild
  if (!expr || expr.type !== 'string') {
    return ''
  }

  return expr.text.trim()
}

function extractFunctionLikeVariables(node: SyntaxNode): { name: string; varNode: SyntaxNode; }[] {
  const out: { name: string; varNode: SyntaxNode; }[] = []

  for (const child of node.namedChildren) {
    if (child.type !== 'variable_declarator') {
      continue
    }

    const nameNode = child.childForFieldName?.('name')
    const valueNode = child.childForFieldName?.('value')
    if (!nameNode || !valueNode) {
      continue
    }

    const isFunctionLike = valueNode.type === 'arrow_function'
      || valueNode.type === 'function'
      || valueNode.type === 'function_definition'

    if (isFunctionLike) {
      out.push({ name: nameNode.text, varNode: child })
    }
  }

  return out
}

function getNodeName(node: SyntaxNode): string {
  return node.childForFieldName?.('name')?.text
    ?? node.namedChildren[0]?.text
    ?? 'anonymous'
}

function isInsideClass(node: SyntaxNode): boolean {
  let cursor = node.parent
  while (cursor) {
    if (cursor.type === 'class_definition' || cursor.type === 'class_declaration') {
      return true
    }
    cursor = cursor.parent
  }
  return false
}

function extractTreeSitterCallName(node: SyntaxNode): null | string {
  const fnNode = node.childForFieldName?.('function')
  if (!fnNode) {
    return null
  }

  const text = fnNode.text?.trim()
  return text || null
}

function getEnclosingCallableName(node: SyntaxNode): null | string {
  let cursor = node.parent
  while (cursor) {
    if (cursor.type === 'function_definition' || cursor.type === 'function_declaration' || cursor.type === 'method_definition') {
      return getNodeName(cursor)
    }

    if (cursor.type === 'variable_declarator') {
      const nameNode = cursor.childForFieldName?.('name')
      if (nameNode) {
        return nameNode.text
      }
    }

    cursor = cursor.parent
  }
  return null
}

function isRequireCall(node: SyntaxNode): boolean {
  if (node.type !== 'call_expression') {
    return false
  }

  const fnNode = node.childForFieldName?.('function')
  return fnNode?.text === 'require'
}

function isFunctionLikeInitializer(node: Expression): node is ArrowFunction | FunctionExpression {
  return node.getKind() === SyntaxKind.ArrowFunction || node.getKind() === SyntaxKind.FunctionExpression
}

function readFunctionLikeParams(node: ArrowFunction | FunctionExpression): string[] {
  return node.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`)
}

function readFunctionLikeReturnType(node: ArrowFunction | FunctionExpression): string {
  return node.getReturnType().getText()
}

function getTsEnclosingCallableName(node: Node): null | string {
  const functionDeclaration = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
  if (functionDeclaration?.getName()) {
    return functionDeclaration.getName()!
  }

  const methodDeclaration = node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration)
  if (methodDeclaration) {
    const classDeclaration = methodDeclaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)
    if (classDeclaration?.getName()) {
      return `${classDeclaration.getName()}.${methodDeclaration.getName()}`
    }
    return methodDeclaration.getName()
  }

  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
  if (variableDeclaration) {
    return variableDeclaration.getName()
  }

  return null
}

function getCallTarget(call: CallExpression): null | { lookupKey: string; name: string } {
  const expression = call.getExpression()

  if (expression.getKind() === SyntaxKind.Identifier) {
    const name = expression.getText()
    return { lookupKey: name, name }
  }

  if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const text = expression.getText()
    const lookupKey = text.split('.')[0]
    return {
      lookupKey,
      name: text
    }
  }

  return null
}
