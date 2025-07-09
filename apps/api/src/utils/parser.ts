import Parser from 'tree-sitter'

const extToLang = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.vue': 'vue',
  '.py': 'python',
} as const

type Segment = {
  kind: 'import' | 'function' | 'class' | 'file'
  name?: string
  code: string
}

export function parseSegments(src: string, ext: string): Segment[] {
  if (ext === '.vue') {
    const { parse: parseSFC } = require('@vue/compiler-sfc')
    const { descriptor } = parseSFC(src)
    const scriptBlock = descriptor.script ?? descriptor.scriptSetup
    src = scriptBlock?.content ?? ''
    ext = scriptBlock?.lang === 'ts' ? '.ts' : '.js'
  }

  const lang = extToLang[ext as keyof typeof extToLang]
  if (!lang) return [{ kind: 'file', code: src }]

  const Lang = require(`tree-sitter-${lang}`)
  const parser = new Parser()
  parser.setLanguage(Lang)

  const tree = parser.parse(src)
  const cursor = tree.walk()
  const out: Segment[] = []

  function visit(node: Parser.SyntaxNode) {
    switch (node.type) {
      case 'import_statement':
      case 'import_from_statement':
        push(node, 'import')
        break

      case 'function_declaration':
      case 'method_definition':
      case 'function_definition':
        push(node, 'function', getName(node))
        break

      case 'class_declaration':
      case 'class_definition':
        push(node, 'class', getName(node))
        break
    }
    for (const child of node.namedChildren) visit(child)
  }

  function getName(node: Parser.SyntaxNode) {
    return node.childForFieldName?.('name')?.text
      ?? node.namedChildren[0]?.text
  }

  function push(n: Parser.SyntaxNode, kind: Segment['kind'], name?: string) {
    out.push({ kind, name, code: src.slice(n.startIndex, n.endIndex) })
  }

  visit(tree.rootNode)

  return out.length ? out : [{ kind: 'file', code: src }]
}
