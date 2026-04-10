import { posix as pathPosix } from 'node:path'

export type RepoTopologyMode = 'package-json' | 'path' | 'workspace'

export type RepoImportResolutionKind = 'alias' | 'package' | 'relative'

export interface RepoTopologyFileInput {
  content: string
  fileExt: string
  filePath: string
  language: string
}

export interface RepoTopologyResolutionStats {
  aliasResolved: number
  packageResolved: number
  relativeResolved: number
  resolved: number
  total: number
}

export interface RepoTopologyImportResolution {
  kind: RepoImportResolutionKind | null
  resolvedPath: string | null
}

export interface RepoTopologyContext {
  moduleIdByFilePath: Map<string, string>
  moduleLabelByFilePath: Map<string, string>
  topologyMode: RepoTopologyMode
  getResolutionStats: () => RepoTopologyResolutionStats
  resolveImport: (
    sourceFilePath: string,
    specifier: string,
    knownFilePaths: Set<string>
  ) => RepoTopologyImportResolution
}

interface CandidateBoundary {
  dir: string
  label: string
  moduleId: string
  packageName?: string
  source: 'package' | 'workspace' | 'path'
  workspaceRootDir?: string
}

interface PackageManifest {
  content: Record<string, unknown>
  dir: string
  filePath: string
  isWorkspaceRoot: boolean
  name?: string
  workspacePatterns: string[]
}

interface TsConfigScope {
  baseUrl: string
  dir: string
  filePath: string
  paths: Array<{ pattern: string, targets: string[] }>
}

interface WorkspaceRoot {
  dir: string
  patterns: string[]
}

interface PackageRegistryEntry {
  dir: string
  filePath: string
  manifest: Record<string, unknown>
  name: string
}

const DEFAULT_CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.d.ts',
  '.json',
  '.py',
  '.java',
  '.kt',
  '.go',
  '.rs',
  '.cs',
  '.php',
  '.rb',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.vue',
  '.svelte'
]

export class RepoTopologyDetector {
  detect(files: Map<string, RepoTopologyFileInput>): RepoTopologyContext {
    const normalizedFiles = new Map<string, RepoTopologyFileInput>()
    for (const [filePath, file] of files.entries()) {
      const normalizedPath = this.normalizePath(filePath)
      if (!normalizedPath) {
        continue
      }

      normalizedFiles.set(normalizedPath, {
        ...file,
        filePath: normalizedPath
      })
    }

    const packageManifests = this.parsePackageManifests(normalizedFiles)
    const workspaceRoots = this.detectWorkspaceRoots(packageManifests, normalizedFiles)
    const tsConfigScopes = this.parseTsConfigScopes(normalizedFiles)
    const packageRegistry = this.buildPackageRegistry(packageManifests)
    const boundaries = this.detectBoundaries(normalizedFiles, packageManifests, workspaceRoots)
    const moduleIdByFilePath = new Map<string, string>()
    const moduleLabelByFilePath = new Map<string, string>()
    const topologyMode: RepoTopologyMode = workspaceRoots.length > 0
      ? 'workspace'
      : packageManifests.length > 0
        ? 'package-json'
        : 'path'

    for (const filePath of normalizedFiles.keys()) {
      const boundary = this.findBoundaryForFile(filePath, boundaries)
      if (boundary) {
        moduleIdByFilePath.set(filePath, boundary.moduleId)
        moduleLabelByFilePath.set(filePath, boundary.label)
        continue
      }

      const fallbackGroup = this.fallbackPathGroup(filePath)
      moduleIdByFilePath.set(filePath, `path:${fallbackGroup}`)
      moduleLabelByFilePath.set(filePath, fallbackGroup)
    }

    const stats: RepoTopologyResolutionStats = {
      aliasResolved: 0,
      packageResolved: 0,
      relativeResolved: 0,
      resolved: 0,
      total: 0
    }

    return {
      getResolutionStats: () => ({ ...stats }),
      moduleIdByFilePath,
      moduleLabelByFilePath,
      resolveImport: (sourceFilePath, specifier, knownFilePaths) => {
        stats.total += 1

        const relativeResolution = this.resolveRelativeImport(sourceFilePath, specifier, knownFilePaths)
        if (relativeResolution.resolvedPath) {
          stats.resolved += 1
          stats.relativeResolved += 1
          return relativeResolution
        }

        const aliasResolution = this.resolveAliasImport(sourceFilePath, specifier, knownFilePaths, tsConfigScopes)
        if (aliasResolution.resolvedPath) {
          stats.resolved += 1
          stats.aliasResolved += 1
          return aliasResolution
        }

        const packageResolution = this.resolvePackageImport(specifier, knownFilePaths, packageRegistry)
        if (packageResolution.resolvedPath) {
          stats.resolved += 1
          stats.packageResolved += 1
          return packageResolution
        }

        return {
          kind: null,
          resolvedPath: null
        }
      },
      topologyMode
    }
  }

  private buildPackageRegistry(packageManifests: PackageManifest[]) {
    return packageManifests
      .filter(manifest => manifest.name)
      .map<PackageRegistryEntry>(manifest => ({
        dir: manifest.dir,
        filePath: manifest.filePath,
        manifest: manifest.content,
        name: manifest.name as string
      }))
      .sort((left, right) => right.name.length - left.name.length)
  }

  private detectBoundaries(
    files: Map<string, RepoTopologyFileInput>,
    packageManifests: PackageManifest[],
    workspaceRoots: WorkspaceRoot[]
  ) {
    const boundaries = new Map<string, CandidateBoundary>()

    for (const manifest of packageManifests) {
      boundaries.set(manifest.dir, {
        dir: manifest.dir,
        label: manifest.name ?? this.displayDir(manifest.dir),
        moduleId: manifest.name
          ? `package:${manifest.name}`
          : `package:${this.displayDir(manifest.dir)}`,
        packageName: manifest.name,
        source: manifest.isWorkspaceRoot ? 'workspace' : 'package',
        workspaceRootDir: manifest.isWorkspaceRoot ? manifest.dir : undefined
      })
    }

    const candidateDirectories = this.collectCandidateDirectories(files.keys())
    for (const workspaceRoot of workspaceRoots) {
      for (const candidateDir of candidateDirectories) {
        if (candidateDir === workspaceRoot.dir) {
          continue
        }

        if (!this.isAncestorPath(workspaceRoot.dir, candidateDir)) {
          continue
        }

        const relativeDir = this.relativeToAncestor(workspaceRoot.dir, candidateDir)
        if (!relativeDir) {
          continue
        }

        if (!this.matchesAnyWorkspacePattern(relativeDir, workspaceRoot.patterns)) {
          continue
        }

        if (boundaries.has(candidateDir)) {
          continue
        }

        boundaries.set(candidateDir, {
          dir: candidateDir,
          label: this.displayDir(candidateDir),
          moduleId: `workspace:${this.displayDir(candidateDir)}`,
          source: 'workspace',
          workspaceRootDir: workspaceRoot.dir
        })
      }
    }

    return [...boundaries.values()].sort((left, right) => right.dir.length - left.dir.length)
  }

  private detectWorkspaceRoots(packageManifests: PackageManifest[], files: Map<string, RepoTopologyFileInput>) {
    const roots: WorkspaceRoot[] = []
    const workspaceYamlDirs = new Set<string>()

    for (const filePath of files.keys()) {
      if (pathPosix.basename(filePath) === 'pnpm-workspace.yaml') {
        workspaceYamlDirs.add(pathPosix.dirname(filePath))
      }
    }

    for (const manifest of packageManifests) {
      if (manifest.isWorkspaceRoot) {
        roots.push({
          dir: manifest.dir,
          patterns: manifest.workspacePatterns
        })
      }
    }

    for (const dir of workspaceYamlDirs) {
      if (!roots.some(root => root.dir === dir)) {
        roots.push({
          dir,
          patterns: this.parsePnpmWorkspacePatterns(files.get(pathPosix.join(dir, 'pnpm-workspace.yaml'))?.content ?? '')
        })
      }
    }

    return roots
  }

  private findBoundaryForFile(filePath: string, boundaries: CandidateBoundary[]) {
    for (const boundary of boundaries) {
      if (boundary.dir === filePath) {
        return boundary
      }

      if (this.isAncestorPath(boundary.dir, filePath)) {
        return boundary
      }
    }

    return null
  }

  private fallbackPathGroup(filePath: string) {
    const segments = filePath.split('/').filter(Boolean)
    if (segments.length <= 1) {
      return segments[0] ?? 'root'
    }

    const first = segments[0] ?? 'root'
    const second = segments[1]

    if (first === 'apps' || first === 'packages' || first === 'services' || first === 'libs' || first === 'modules') {
      return second ? `${first}/${second}` : first
    }

    if (first === 'src' || first === 'app' || first === 'lib' || first === 'components' || first === 'features') {
      return second ? `${first}/${second}` : first
    }

    return second ? `${first}/${second}` : first
  }

  private parsePackageManifests(files: Map<string, RepoTopologyFileInput>) {
    const manifests: PackageManifest[] = []

    for (const [filePath, file] of files.entries()) {
      if (pathPosix.basename(filePath) !== 'package.json') {
        continue
      }

      const content = this.safeJsonParse(file.content)
      if (!content) {
        continue
      }

      const dir = pathPosix.dirname(filePath)
      const workspacePatterns = this.extractWorkspacePatterns(content, files, dir)
      manifests.push({
        content,
        dir,
        filePath,
        isWorkspaceRoot: workspacePatterns.length > 0,
        name: typeof content.name === 'string' ? content.name.trim() : undefined,
        workspacePatterns
      })
    }

    return manifests
  }

  private parseTsConfigScopes(files: Map<string, RepoTopologyFileInput>) {
    const scopes: TsConfigScope[] = []

    for (const [filePath, file] of files.entries()) {
      const baseName = pathPosix.basename(filePath)
      if (!baseName.startsWith('tsconfig') && !baseName.startsWith('jsconfig')) {
        continue
      }

      const parsedScopes = this.resolveTsConfigChain(filePath, files, new Set<string>())
      scopes.push(...parsedScopes)
    }

    return scopes
  }

  private resolveTsConfigChain(
    filePath: string,
    files: Map<string, RepoTopologyFileInput>,
    visited: Set<string>
  ): TsConfigScope[] {
    const normalizedPath = this.normalizePath(filePath)
    if (!normalizedPath || visited.has(normalizedPath)) {
      return []
    }

    visited.add(normalizedPath)
    const file = files.get(normalizedPath)
    if (!file) {
      return []
    }

    const content = this.safeJsonParse(file.content)
    if (!content) {
      return []
    }

    const parentScopes = typeof content.extends === 'string' && this.isLocalConfigExtends(normalizedPath, content.extends)
      ? this.resolveTsConfigChain(this.resolveConfigExtendsPath(normalizedPath, content.extends), files, visited)
      : []

    const compilerOptions = this.normalizeCompilerOptions(content.compilerOptions)
    const scope: TsConfigScope = {
      baseUrl: compilerOptions.baseUrl ?? pathPosix.dirname(normalizedPath),
      dir: pathPosix.dirname(normalizedPath),
      filePath: normalizedPath,
      paths: compilerOptions.paths
    }

    return [...parentScopes, scope]
  }

  private normalizeCompilerOptions(compilerOptions: unknown) {
    if (!compilerOptions || typeof compilerOptions !== 'object') {
      return {
        paths: [] as Array<{ pattern: string, targets: string[] }>,
        baseUrl: null as null | string
      }
    }

    const typedOptions = compilerOptions as Record<string, unknown>
    const baseUrl = typeof typedOptions.baseUrl === 'string' && typedOptions.baseUrl.trim().length > 0
      ? typedOptions.baseUrl.trim()
      : null

    const paths: Array<{ pattern: string, targets: string[] }> = []
    const rawPaths = typedOptions.paths
    if (rawPaths && typeof rawPaths === 'object' && !Array.isArray(rawPaths)) {
      for (const [pattern, value] of Object.entries(rawPaths as Record<string, unknown>)) {
        if (!Array.isArray(value)) {
          continue
        }

        const targets = value
          .filter((entry): entry is string => typeof entry === 'string')
          .map(entry => entry.trim())
          .filter(Boolean)

        if (pattern.trim().length > 0 && targets.length > 0) {
          paths.push({
            pattern: pattern.trim(),
            targets
          })
        }
      }
    }

    return {
      baseUrl,
      paths
    }
  }

  private resolveRelativeImport(
    sourceFilePath: string,
    specifier: string,
    knownFilePaths: Set<string>
  ): RepoTopologyImportResolution {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')
    if (!isRelative) {
      return {
        kind: null,
        resolvedPath: null
      }
    }

    const baseDir = pathPosix.dirname(sourceFilePath)
    const resolvedPath = specifier.startsWith('/')
      ? pathPosix.normalize(specifier.slice(1))
      : pathPosix.normalize(pathPosix.join(baseDir, specifier))

    const resolved = this.resolveKnownPathCandidate(resolvedPath, knownFilePaths)
    if (resolved) {
      return {
        kind: 'relative',
        resolvedPath: resolved
      }
    }

    return {
      kind: null,
      resolvedPath: null
    }
  }

  private resolveAliasImport(
    sourceFilePath: string,
    specifier: string,
    knownFilePaths: Set<string>,
    scopes: TsConfigScope[]
  ): RepoTopologyImportResolution {
    if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
      return {
        kind: null,
        resolvedPath: null
      }
    }

    const orderedScopes = scopes
      .filter(scope => this.isAncestorPath(scope.dir, sourceFilePath))
      .sort((left, right) => right.dir.length - left.dir.length)
    const fallbackScopes = [...scopes].sort((left, right) => right.dir.length - left.dir.length)

    for (const scope of orderedScopes.length > 0 ? orderedScopes : fallbackScopes) {
      for (const alias of scope.paths) {
        const matches = this.matchAliasPattern(alias.pattern, specifier)
        if (!matches) {
          continue
        }

        for (const target of alias.targets) {
          const substitutedTarget = this.applyAliasCapture(target, matches.capture)
          const baseDir = pathPosix.normalize(pathPosix.join(scope.dir, scope.baseUrl))
          const candidate = this.resolveCandidateFromBase(baseDir, substitutedTarget, knownFilePaths)
          if (candidate) {
            return {
              kind: 'alias',
              resolvedPath: candidate
            }
          }
        }
      }
    }

    return {
      kind: null,
      resolvedPath: null
    }
  }

  private resolvePackageImport(
    specifier: string,
    knownFilePaths: Set<string>,
    packageRegistry: PackageRegistryEntry[]
  ): RepoTopologyImportResolution {
    const exactMatch = packageRegistry.find(entry => specifier === entry.name)
    const prefixMatch = packageRegistry.find(entry => specifier.startsWith(`${entry.name}/`))
    const packageEntry = exactMatch ?? prefixMatch
    if (!packageEntry) {
      return {
        kind: null,
        resolvedPath: null
      }
    }

    const subpath = specifier === packageEntry.name
      ? ''
      : specifier.slice(packageEntry.name.length + 1)

    const candidatePaths: string[] = []
    if (subpath.length > 0) {
      candidatePaths.push(pathPosix.join(packageEntry.dir, subpath))
      candidatePaths.push(pathPosix.join(packageEntry.dir, 'src', subpath))
      candidatePaths.push(pathPosix.join(packageEntry.dir, 'lib', subpath))
    } else {
      candidatePaths.push(...this.packageEntryCandidates(packageEntry))
    }

    const resolved = this.resolveCandidates(candidatePaths, knownFilePaths)
    if (resolved) {
      return {
        kind: 'package',
        resolvedPath: resolved
      }
    }

    return {
      kind: null,
      resolvedPath: null
    }
  }

  private packageEntryCandidates(packageEntry: PackageRegistryEntry) {
    const candidates: string[] = []
    const exportsField = packageEntry.manifest.exports
    const packageMain = this.readStringManifestField(packageEntry.manifest, ['main', 'module', 'source', 'types'])

    const exactExportTargets = this.extractExportTargets(exportsField, '.')
    candidates.push(...exactExportTargets.map(target => pathPosix.join(packageEntry.dir, target)))

    if (packageMain) {
      candidates.push(pathPosix.join(packageEntry.dir, packageMain))
    }

    candidates.push(
      pathPosix.join(packageEntry.dir, 'index'),
      pathPosix.join(packageEntry.dir, 'src', 'index'),
      pathPosix.join(packageEntry.dir, 'src', 'main'),
      pathPosix.join(packageEntry.dir, 'src', 'index.ts'),
      pathPosix.join(packageEntry.dir, 'src', 'index.tsx')
    )

    return candidates
  }

  private extractExportTargets(exportsField: unknown, requestedSubpath: string) {
    const targets: string[] = []
    if (!exportsField) {
      return targets
    }

    const visit = (value: unknown) => {
      if (typeof value === 'string') {
        if (value.trim().startsWith('.')) {
          targets.push(value.trim())
        }
        return
      }

      if (!value || typeof value !== 'object') {
        return
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          visit(entry)
        }
        return
      }

      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (key === requestedSubpath || (requestedSubpath !== '.' && key.startsWith('./') && this.exportPatternMatches(key, requestedSubpath))) {
          visit(nestedValue)
        }
      }
    }

    if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
      visit(exportsField)
      return targets
    }

    if (typeof exportsField === 'object') {
      const record = exportsField as Record<string, unknown>
      if (Object.prototype.hasOwnProperty.call(record, requestedSubpath)) {
        visit(record[requestedSubpath])
      }

      for (const [key, value] of Object.entries(record)) {
        if (this.exportPatternMatches(key, requestedSubpath)) {
          visit(value)
        }
      }
    }

    return targets
  }

  private exportPatternMatches(pattern: string, requestedSubpath: string) {
    if (!pattern.includes('*')) {
      return pattern === requestedSubpath || pattern === `./${requestedSubpath}`
    }

    const regex = new RegExp(`^${this.escapeRegex(pattern).replace(/\\\*/g, '(.*)')}$`)
    return regex.test(requestedSubpath) || regex.test(`./${requestedSubpath}`)
  }

  private resolveCandidateFromBase(
    baseDir: string,
    relativeCandidate: string,
    knownFilePaths: Set<string>
  ) {
    const normalized = pathPosix.normalize(pathPosix.join(baseDir, relativeCandidate))
    return this.resolveKnownPathCandidate(normalized, knownFilePaths)
  }

  private resolveKnownPathCandidate(candidatePath: string, knownFilePaths: Set<string>) {
    if (knownFilePaths.has(candidatePath)) {
      return candidatePath
    }

    const hasExtension = pathPosix.extname(candidatePath) !== ''
    const extensions = hasExtension
      ? ['']
      : DEFAULT_CODE_EXTENSIONS

    for (const extension of extensions) {
      const withExtension = `${candidatePath}${extension}`
      if (knownFilePaths.has(withExtension)) {
        return withExtension
      }

      const indexFile = pathPosix.join(candidatePath, `index${extension}`)
      if (knownFilePaths.has(indexFile)) {
        return indexFile
      }
    }

    return null
  }

  private resolveCandidates(candidatePaths: string[], knownFilePaths: Set<string>) {
    for (const candidatePath of candidatePaths) {
      const resolved = this.resolveKnownPathCandidate(candidatePath, knownFilePaths)
      if (resolved) {
        return resolved
      }
    }

    return null
  }

  private matchAliasPattern(pattern: string, specifier: string) {
    if (!pattern.includes('*')) {
      return pattern === specifier
        ? { capture: '' }
        : null
    }

    const regex = new RegExp(`^${this.escapeRegex(pattern).replace(/\\\*/g, '(.*)')}$`)
    const match = specifier.match(regex)
    if (!match) {
      return null
    }

    return {
      capture: match[1] ?? ''
    }
  }

  private applyAliasCapture(target: string, capture: string) {
    if (!target.includes('*')) {
      return target
    }

    return target.replace(/\*/g, capture)
  }

  private extractWorkspacePatterns(
    content: Record<string, unknown>,
    files: Map<string, RepoTopologyFileInput>,
    dir: string
  ) {
    const workspaces = content.workspaces
    if (Array.isArray(workspaces)) {
      return workspaces.filter((entry): entry is string => typeof entry === 'string')
    }

    if (workspaces && typeof workspaces === 'object') {
      const workspaceRecord = workspaces as Record<string, unknown>
      const packages = workspaceRecord.packages
      if (Array.isArray(packages)) {
        return packages.filter((entry): entry is string => typeof entry === 'string')
      }
    }

    const pnpmWorkspace = files.get(pathPosix.join(dir, 'pnpm-workspace.yaml'))
    if (pnpmWorkspace) {
      return this.parsePnpmWorkspacePatterns(pnpmWorkspace.content)
    }

    return []
  }

  private parsePnpmWorkspacePatterns(content: string) {
    const patterns: string[] = []
    const lines = content.split(/\r?\n/)
    let insidePackages = false

    for (const rawLine of lines) {
      const line = rawLine.replace(/#.*$/, '').trim()
      if (!line) {
        continue
      }

      if (line.startsWith('packages:')) {
        insidePackages = true
        continue
      }

      if (!insidePackages) {
        continue
      }

      const match = line.match(/^-+\s*["']?([^"']+)["']?$/)
      if (match?.[1]) {
        patterns.push(match[1].trim())
      }
    }

    return patterns
  }

  private collectCandidateDirectories(filePaths: Iterable<string>) {
    const directories = new Set<string>()
    for (const filePath of filePaths) {
      let currentDir = pathPosix.dirname(filePath)
      while (currentDir && currentDir !== '.') {
        directories.add(currentDir)
        const nextDir = pathPosix.dirname(currentDir)
        if (nextDir === currentDir) {
          break
        }
        currentDir = nextDir
      }
    }

    return [...directories].sort((left, right) => right.length - left.length)
  }

  private matchesAnyWorkspacePattern(relativeDir: string, patterns: string[]) {
    for (const pattern of patterns) {
      if (this.workspacePatternToRegExp(pattern).test(relativeDir)) {
        return true
      }
    }

    return false
  }

  private workspacePatternToRegExp(pattern: string) {
    const normalized = pattern.trim().replace(/^\.\//, '')
    const escaped = this.escapeRegex(normalized)
      .replace(/\\\*\\\*/g, '.*')
      .replace(/\\\*/g, '[^/]+')
    return new RegExp(`^${escaped}$`)
  }

  private readStringManifestField(manifest: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = manifest[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim()
      }
    }

    return null
  }

  private isLocalConfigExtends(configPath: string, extendsValue: string) {
    if (!extendsValue.startsWith('.')) {
      return false
    }

    const resolved = this.resolveConfigExtendsPath(configPath, extendsValue)
    return resolved.length > 0
  }

  private resolveConfigExtendsPath(configPath: string, extendsValue: string) {
    const resolved = pathPosix.normalize(pathPosix.join(pathPosix.dirname(configPath), extendsValue))
    if (pathPosix.extname(resolved) !== '.json') {
      return `${resolved}.json`
    }

    return resolved
  }

  private safeJsonParse(content: string) {
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }

    return null
  }

  private normalizePath(value: string) {
    const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/{2,}/g, '/')
    return normalized.length > 0 ? normalized : null
  }

  private isAncestorPath(ancestor: string, descendant: string) {
    if (ancestor === '.') {
      return true
    }

    return descendant === ancestor || descendant.startsWith(`${ancestor}/`)
  }

  private relativeToAncestor(ancestor: string, descendant: string) {
    if (!this.isAncestorPath(ancestor, descendant)) {
      return null
    }

    if (ancestor === '.') {
      return descendant
    }

    const relative = descendant.slice(ancestor.length).replace(/^\/+/, '')
    return relative.length > 0 ? relative : null
  }

  private displayDir(dir: string) {
    return dir === '.' ? 'root' : dir
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private normalizePathSeparatorForMatch(value: string) {
    return value.replaceAll('\\', '/')
  }
}
