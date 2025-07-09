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
  console.log(`[parser] parsing file with extension: "${ext}"`)

  if (ext === '.vue') {
    const { parse: parseSFC } = require('@vue/compiler-sfc')
    const { descriptor } = parseSFC(src)
    const scriptBlock = descriptor.script ?? descriptor.scriptSetup
    src = scriptBlock?.content ?? ''
    ext = scriptBlock?.lang === 'ts' ? '.ts' : '.js'
    console.log(`[parser] detected .vue, switching to script block with extension: "${ext}"`)
  }

  const unsupportedExts = new Set([
    '.json', '.md', '.cjs', '', '.lock', '.env',
  ])

  if (unsupportedExts.has(ext)) {
    console.log(`[parser] unsupported extension "${ext}", returning full file as-is`)
    return [{ kind: 'file', code: src }]
  }

  const lang = extToLang[ext as keyof typeof extToLang]
  if (!lang) {
    console.log(`[parser] no mapping found for extension "${ext}", returning full file as-is`)
    return [{ kind: 'file', code: src }]
  }

  let Lang
  try {
    Lang = require(`tree-sitter-${lang}`)
    console.log(`[parser] raw Lang:`, Lang)

    if (Lang?.default) {
      Lang = Lang.default
      console.log(`[parser] using default export`)
    }

    if (lang === 'typescript' && ext === '.ts') {
      Lang = Lang.typescript
      console.log(`[parser] using Lang.typescript`)
    }

    if (lang === 'typescript' && ext === '.tsx') {
      Lang = Lang.tsx
      console.log(`[parser] using Lang.tsx`)
    }
  }
  catch (err) {
    console.error(`[parser] failed to load tree-sitter-${lang}:`, err)
    return [{ kind: 'file', code: src }]
  }

  if (!Lang || typeof Lang !== 'object' || !Lang.name) {
    console.error(`[parser] tree-sitter-${lang} is invalid or empty`)
    return [{ kind: 'file', code: src }]
  }

  const parser = new Parser()
  parser.setLanguage(Lang)
  console.log(`[parser] set language to "${lang}"`)

  const tree = parser.parse(src)
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

  if (!out.length) {
    console.log(`[parser] no segments detected, returning full file`)
    return [{ kind: 'file', code: src }]
  }

  console.log(`[parser] extracted ${out.length} segments`)
  return out
}
