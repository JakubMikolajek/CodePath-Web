import { NotFoundException } from '@nestjs/common'
import type { RepoApiEndpointParameter } from '@workspace/codepath-common'
import { and, eq } from 'drizzle-orm'
import { replace, toLower } from 'lodash'

import type {
  ApiExplorerRepoOwnership as RepoOwnership
} from '../modules/api-explorer/types/api-explorer-internal.types'
import { repos } from '../modules/db/schema'
import type { DbService } from '../modules/db/services/db.service'

export function sanitizeString(value: string): string {
  return replace(toLower(value), /[^a-z0-9]/g, '_')
}

export function normalizeHttpPath(path: string) {
  const trimmed = path.trim()
  if (!trimmed || trimmed === '.') {
    return '/'
  }

  let normalized = trimmed
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\/+/, '')

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

export function uniqueParams(params: RepoApiEndpointParameter[]) {
  const unique = new Map<string, RepoApiEndpointParameter>()

  for (const param of params) {
    unique.set(`${param.location}:${param.name}`, param)
  }

  return [...unique.values()].sort((a, b) => {
    const byLocation = a.location.localeCompare(b.location)

    if (byLocation !== 0) return byLocation

    return a.name.localeCompare(b.name)
  })
}

export function isPrivateIpv4Host(hostname: string) {
  const octets = hostname.split('.').map(value => Number.parseInt(value, 10))

  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false

  const [first, second] = octets

  if (first === 10) return true
  if (first === 192 && second === 168) return true
  if (first === 172 && second >= 16 && second <= 31) return true

  return false
}

export function isAllowedRunnerTarget(urlString: string) {
  let parsed: URL

  try {
    parsed = new URL(urlString)
  } catch {
    return false
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return false

  const hostname = parsed.hostname.toLowerCase()

  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return true
  if (hostname.endsWith('.local') || hostname.endsWith('.lan')) return true

  if (!hostname.includes('.')) {
    // Single-label hostnames on local network (for example: raspberrypi).
    return true
  }

  return isPrivateIpv4Host(hostname)
}

export async function assertRepoOwnership(dbService: DbService, userId: number, repoId: number): Promise<RepoOwnership> {
  const [repo] = await dbService.dbClient.select({ id: repos.id, name: repos.name })
    .from(repos)
    .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
    .limit(1)

  if (!repo) throw new NotFoundException('Repository not found')

  return repo
}
