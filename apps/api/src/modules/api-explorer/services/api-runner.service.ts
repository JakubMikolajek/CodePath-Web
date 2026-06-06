import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common'
import type {
  RepoApiRunnerAuthConfig,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerRequest,
  RepoApiRunnerResponse,
  RepoApiRunnerSaveAuthPresetRequest,
  RepoApiRunnerSaveCollectionRequest
} from '@workspace/codepath-common/api-explorer'
import {
  RepoApiHttpMethod,
  RepoApiRunnerApiKeyPlacement,
  RepoApiRunnerAuthMode
} from '@workspace/codepath-common/api-explorer'
import type { AxiosInstance } from 'axios'

import { isAllowedRunnerTarget } from '../../../utils/helpers'
import { HTTP_CLIENT } from '../../http-client/http-client.tokens'
import { ApiRunnerAuthPresetsRepository } from '../repositories/api-runner-auth-presets.repository'
import { ApiRunnerCollectionsRepository } from '../repositories/api-runner-collections.repository'

const SUPPORTED_METHODS: RepoApiHttpMethod[] = [
  RepoApiHttpMethod.DELETE,
  RepoApiHttpMethod.GET,
  RepoApiHttpMethod.HEAD,
  RepoApiHttpMethod.OPTIONS,
  RepoApiHttpMethod.PATCH,
  RepoApiHttpMethod.POST,
  RepoApiHttpMethod.PUT
]

const RUNNER_DEFAULT_TIMEOUT_MS = 10_000
const RUNNER_MAX_TIMEOUT_MS = 30_000
const RUNNER_MAX_RESPONSE_BYTES = 1_000_000
const RUNNER_COLLECTION_NAME_MAX_LENGTH = 120
const RUNNER_AUTH_PRESET_NAME_MAX_LENGTH = 120
const RUNNER_AUTH_MODES: RepoApiRunnerAuthMode[] = [
  RepoApiRunnerAuthMode.NONE,
  RepoApiRunnerAuthMode.BEARER,
  RepoApiRunnerAuthMode.BASIC,
  RepoApiRunnerAuthMode.API_KEY
]

@Injectable()
export class ApiRunnerService {
  constructor(
    private readonly runnerAuthPresetsRepository: ApiRunnerAuthPresetsRepository,
    private readonly runnerCollectionsRepository: ApiRunnerCollectionsRepository,
    @Inject(HTTP_CLIENT) private readonly httpClient: AxiosInstance
  ) {}

  async deleteRunnerAuthPreset(userId: number, repoId: number, presetId: number) {
    return await this.runnerAuthPresetsRepository.delete(userId, repoId, presetId)
  }

  async deleteRunnerCollection(userId: number, repoId: number, collectionId: number) {
    return await this.runnerCollectionsRepository.delete(userId, repoId, collectionId)
  }

  async listRunnerAuthPresets(userId: number, repoId: number): Promise<RepoApiRunnerAuthPreset[]> {
    return await this.runnerAuthPresetsRepository.list(userId, repoId)
  }

  async listRunnerCollections(userId: number, repoId: number): Promise<RepoApiRunnerCollection[]> {
    return await this.runnerCollectionsRepository.list(userId, repoId)
  }

  async runApiRequest(input: RepoApiRunnerRequest): Promise<RepoApiRunnerResponse> {
    const method = this.assertMethod(input.method)
    if (!method) {
      throw new BadRequestException('Unsupported HTTP method')
    }

    const targetUrl = this.normalizeRunnerUrl(input.url)
    if (!isAllowedRunnerTarget(targetUrl)) throw new BadRequestException('Target URL must be localhost or private LAN address (10.x, 172.16-31.x, 192.168.x)')

    const timeoutMs = this.normalizeRunnerTimeout(input.timeoutMs)
    const headers = this.normalizeRunnerHeaders(input.headers)

    if ([RepoApiHttpMethod.POST, RepoApiHttpMethod.PUT, RepoApiHttpMethod.PATCH].includes(method) && !headers['content-type']) headers['content-type'] = 'application/json'
    if (!headers.accept) headers.accept = 'application/json'

    const startedAt = Date.now()

    try {
      const response = await this.httpClient.request<ArrayBuffer>({
        data: [RepoApiHttpMethod.GET, RepoApiHttpMethod.HEAD].includes(method) ? undefined : input.body,
        headers,
        maxBodyLength: RUNNER_MAX_RESPONSE_BYTES,
        maxContentLength: RUNNER_MAX_RESPONSE_BYTES,
        method,
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        url: targetUrl,
        validateStatus: () => true
      })

      const durationMs = Date.now() - startedAt
      const responseHeaders = this.toPlainHeaders(response.headers)
      const contentType = responseHeaders['content-type'] ?? ''
      const data = this.decodeRunnerResponseBody(response.data, contentType)

      return {
        data,
        durationMs,
        headers: responseHeaders,
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText ?? '',
        url: targetUrl
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadRequestException(`Runner request failed: ${message}`)
    }
  }

  async saveRunnerAuthPreset(userId: number, repoId: number, input: RepoApiRunnerSaveAuthPresetRequest): Promise<RepoApiRunnerAuthPreset> {
    const name = this.normalizeName(input.name, RUNNER_AUTH_PRESET_NAME_MAX_LENGTH, 'Auth preset name')
    const config = this.normalizeRunnerAuthConfig(input.config)

    return await this.runnerAuthPresetsRepository.save(userId, repoId, name, config)
  }

  async saveRunnerCollection(userId: number, repoId: number, input: RepoApiRunnerSaveCollectionRequest): Promise<RepoApiRunnerCollection> {
    const name = this.normalizeCollectionName(input.name)
    const config = this.normalizeCollectionConfig(input.config)

    return await this.runnerCollectionsRepository.save(userId, repoId, name, config)
  }

  private assertMethod(value: string): Nullable<RepoApiHttpMethod> {
    const method = value.trim().toUpperCase() as RepoApiHttpMethod

    if (!SUPPORTED_METHODS.includes(method)) return null

    return method
  }

  private decodeRunnerResponseBody(data: ArrayBuffer, contentType: string) {
    const buffer = Buffer.from(data)
    const normalizedContentType = contentType.toLowerCase()

    if (normalizedContentType.includes('application/json')) {
      try {
        return JSON.parse(buffer.toString('utf8'))
      } catch {
        return buffer.toString('utf8')
      }
    }

    if (
      normalizedContentType.startsWith('text/')
      || normalizedContentType.includes('xml')
      || normalizedContentType.includes('html')
      || normalizedContentType.includes('javascript')
    ) {
      return buffer.toString('utf8')
    }

    return {
      base64: buffer.toString('base64'),
      bytes: buffer.byteLength,
      contentType: contentType || 'application/octet-stream'
    }
  }

  private normalizeCollectionConfig(config: RepoApiRunnerCollectionConfig): RepoApiRunnerCollectionConfig {
    if (!config || typeof config !== 'object') throw new BadRequestException('Collection config is required')

    const timeoutMs = Number.isFinite(config.timeoutMs)
      ? Math.min(RUNNER_MAX_TIMEOUT_MS, Math.max(1_000, Math.trunc(config.timeoutMs)))
      : RUNNER_DEFAULT_TIMEOUT_MS

    return {
      auth: this.normalizeRunnerAuthConfig(config.auth),
      baseUrl: String(config.baseUrl ?? ''),
      bodyJson: String(config.bodyJson ?? '{}'),
      endpointId: config.endpointId ? String(config.endpointId) : null,
      endpointMethod: this.assertMethod(String(config.endpointMethod ?? '')) ?? null,
      endpointPath: config.endpointPath ? String(config.endpointPath) : null,
      headersJson: String(config.headersJson ?? '{}'),
      pathValues: typeof config.pathValues === 'object' && config.pathValues !== null ? Object.fromEntries(
        Object.entries(config.pathValues).map(([key, value]) => [String(key), String(value)])
      ) : {},
      queryJson: String(config.queryJson ?? '{}'),
      timeoutMs
    }
  }

  private normalizeCollectionName(name: string): string {
    return this.normalizeName(name, RUNNER_COLLECTION_NAME_MAX_LENGTH, 'Collection name')
  }

  private normalizeName(name: string, maxLength: number, label: string) {
    const normalizedName = typeof name === 'string' ? name.trim() : ''

    if (!normalizedName) throw new BadRequestException(`${label} is required`)
    if (normalizedName.length > maxLength) throw new BadRequestException(`${label} max length is ${maxLength}`)

    return normalizedName
  }

  private normalizeRunnerAuthConfig(input: unknown): RepoApiRunnerAuthConfig {
    const safeAuth = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}

    const rawMode = String(safeAuth.mode ?? '')
    const mode: RepoApiRunnerAuthMode = RUNNER_AUTH_MODES.includes(rawMode as RepoApiRunnerAuthMode)
      ? (rawMode as RepoApiRunnerAuthMode)
      : RepoApiRunnerAuthMode.NONE

    return {
      apiKeyName: String(safeAuth.apiKeyName ?? 'x-api-key'),
      apiKeyPlacement: safeAuth.apiKeyPlacement === RepoApiRunnerApiKeyPlacement.QUERY
        ? RepoApiRunnerApiKeyPlacement.QUERY
        : RepoApiRunnerApiKeyPlacement.HEADER,
      apiKeyValue: String(safeAuth.apiKeyValue ?? ''),
      basicPassword: String(safeAuth.basicPassword ?? ''),
      basicUsername: String(safeAuth.basicUsername ?? ''),
      bearerToken: String(safeAuth.bearerToken ?? ''),
      mode
    }
  }

  private normalizeRunnerHeaders(headers?: Record<string, string>) {
    const normalized: Record<string, string> = {}

    if (!headers || typeof headers !== 'object') return normalized

    for (const [rawKey, rawValue] of Object.entries(headers)) {
      const key = rawKey.trim().toLowerCase()

      if (!key || ['connection', 'content-length', 'host'].includes(key)) continue

      const value = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue)

      if (!value) continue

      normalized[key] = value
    }

    return normalized
  }

  private normalizeRunnerTimeout(timeoutMs?: number) {
    if (!Number.isFinite(timeoutMs)) return RUNNER_DEFAULT_TIMEOUT_MS

    return Math.min(RUNNER_MAX_TIMEOUT_MS, Math.max(1_000, Math.trunc(timeoutMs as number)))
  }

  private normalizeRunnerUrl(url: string) {
    if (typeof url !== 'string' || !url.trim()) throw new BadRequestException('Runner URL is required')

    try {
      return new URL(url.trim()).toString()
    } catch {
      throw new BadRequestException('Runner URL is invalid')
    }
  }

  private toPlainHeaders(headers: unknown) {
    const normalized: Record<string, string> = {}

    if (!headers || typeof headers !== 'object') return normalized

    for (const [rawKey, rawValue] of Object.entries(headers)) {
      const key = rawKey.toLowerCase()

      if (!key) continue

      if (Array.isArray(rawValue)) {
        normalized[key] = rawValue.map(value => String(value)).join(', ')
        continue
      }

      if (typeof rawValue === 'string') {
        normalized[key] = rawValue
        continue
      }

      if (rawValue === undefined || rawValue === null) continue

      normalized[key] = String(rawValue)
    }

    return normalized
  }
}
