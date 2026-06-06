export class GraphNoiseFilter {
  isNodeModulesFilePath(filePath: string): boolean {
    return filePath.toLowerCase().includes('/node_modules/')
  }

  isNodeModuleSpecifier(specifier: string, language: string, fileExt: string): boolean {
    const normalizedSpecifier = specifier.trim().replaceAll('\\', '/')

    if (!normalizedSpecifier) return false

    const lowerLanguage = language.trim().toLowerCase()
    const lowerExt = fileExt.trim().toLowerCase()
    const isNodeJsLikeSource = (lowerLanguage === 'javascript' || lowerLanguage === 'typescript' || ['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx'].includes(lowerExt))

    if (!isNodeJsLikeSource) return false
    if (normalizedSpecifier.includes('/node_modules/')) return true
    if (normalizedSpecifier.startsWith('node:') || normalizedSpecifier.startsWith('npm:')) return true
    if (
      normalizedSpecifier.startsWith('.')
      || normalizedSpecifier.startsWith('/')
      || normalizedSpecifier.startsWith('http://')
      || normalizedSpecifier.startsWith('https://')
    ) return false

    return true
  }
}
