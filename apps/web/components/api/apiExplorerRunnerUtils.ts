import {
  type RepoApiEndpoint,
  RepoApiHttpMethod,
  type RepoApiRunnerCollectionConfig
} from '@workspace/codepath-common/api-explorer'
import {
  RepoApiParameterLocation,
  RepoApiRunnerApiKeyPlacement,
  RepoApiRunnerAuthMode
} from '@workspace/codepath-common/api-explorer'

const methodsWithBody = new Set<RepoApiHttpMethod>([
  RepoApiHttpMethod.PATCH,
  RepoApiHttpMethod.POST,
  RepoApiHttpMethod.PUT
])

const hash = (value: string) => Math.abs([...value].reduce(
  (valueHash, character) => ((valueHash << 5) - valueHash + character.charCodeAt(0)) | 0, 0
))

const sample = (name: string, seed: string) => {
  const value = name.toLowerCase()
  const valueHash = hash(`${seed}:${value}`)

  if (value.includes('uuid')) return '550e8400-e29b-41d4-a716-446655440000'
  if (value.includes('email')) return `user${valueHash % 100}@example.com`
  if (value === 'id' || value.endsWith('id')) return (valueHash % 9000) + 1000

  return `sample-${value || 'value'}-${valueHash % 1000}`
}

export function createRunnerDefaults(endpoint: RepoApiEndpoint) {
  const pathNames = Array.from(
    new Set([...Array.from(endpoint.path.matchAll(
      /:([A-Za-z0-9_]+)|\{([A-Za-z0-9_]+)(?::[^}]*)?\}|<(?:[A-Za-z0-9_]+:)?([A-Za-z0-9_]+)>/g
    )).map(
      match => match[1] ?? match[2] ?? match[3]).filter(Boolean
    ),
    ...endpoint.params.filter(
      param => param.location === RepoApiParameterLocation.PATH
    ).map(
      param => param.name
    )])
  )

  const pathValues = Object.fromEntries(
    pathNames.map(name => [name, String(sample(name, endpoint.id))])
  )

  const query = Object.fromEntries(endpoint.params
    .filter(param => param.location === RepoApiParameterLocation.QUERY)
    .map(param => [param.name, sample(param.name, endpoint.id)])
  )

  const body = Object.fromEntries(endpoint.params
    .filter(param => param.location === RepoApiParameterLocation.BODY)
    .map(param => [
      param.name === 'body' ? 'payload' : param.name,
      sample(param.name, endpoint.id)
    ])
  )
  if (methodsWithBody.has(endpoint.method) && Object.keys(body).length === 0) body.payload = `sample-${hash(endpoint.id) % 1000}`

  return {
    bodyJson: JSON.stringify(body, null, 2),
    pathValues,
    queryJson: JSON.stringify(query, null, 2),
    headersJson: JSON.stringify(
      {
        Accept: 'application/json',
        ...(methodsWithBody.has(endpoint.method) ? { 'Content-Type': 'application/json' } : {})
      },
      null,
      2
    )
  }
}

export function buildRunnerPayload(
  endpoint: RepoApiEndpoint,
  config: {
    auth: RepoApiRunnerCollectionConfig['auth'];
    baseUrl: string;
    bodyJson: string;
    headersJson: string;
    pathValues: Record<string, string>;
    queryJson: string;
    timeoutMs: number;
  }
) {
  const parseObject = (raw: string, label: string) => {
    const value: unknown = JSON.parse(raw)

    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object`)

    return value as Record<string, unknown>
  }

  const query = parseObject(config.queryJson, 'Query JSON')
  const rawHeaders = parseObject(config.headersJson, 'Headers JSON')
  const body = JSON.parse(config.bodyJson)

  let path = endpoint.path

  Object.entries(config.pathValues).forEach(([name, value]) => {
    const encoded = encodeURIComponent(value)

    path = path.replace(
      new RegExp(`:${name}(?=/|$)|\\{${name}(?::[^}]*)?\\}|<(?:[A-Za-z0-9_]+:)?${name}>`, 'g'),
      encoded
    )
  })

  const authHeaders: Record<string, string> = {}

  if (config.auth.mode === RepoApiRunnerAuthMode.BEARER) {
    if (!config.auth.bearerToken.trim()) throw new Error('Bearer token is required')

    authHeaders.Authorization = `Bearer ${config.auth.bearerToken.trim()}`
  }

  if (config.auth.mode === RepoApiRunnerAuthMode.BASIC) {
    if (!config.auth.basicUsername.trim()) throw new Error('Basic username is required')

    authHeaders.Authorization = `Basic ${window.btoa(`${config.auth.basicUsername.trim()}:${config.auth.basicPassword}`)}`
  }

  if (config.auth.mode === RepoApiRunnerAuthMode.API_KEY) {
    if (!config.auth.apiKeyName.trim() || !config.auth.apiKeyValue.trim()) throw new Error('API key name and value are required')
    if (config.auth.apiKeyPlacement === RepoApiRunnerApiKeyPlacement.QUERY) query[config.auth.apiKeyName.trim()] = config.auth.apiKeyValue.trim()
    else authHeaders[config.auth.apiKeyName.trim()] = config.auth.apiKeyValue.trim()
  }

  const baseUrl = new URL(config.baseUrl.trim() || (() => {
    throw new Error('Base URL is required')
  })())

  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl)

  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)))

  return {
    body: methodsWithBody.has(endpoint.method) ? body : undefined,
    method: endpoint.method,
    timeoutMs: config.timeoutMs,
    url: url.toString(),
    headers: {
      ...Object.fromEntries(
        Object.entries(rawHeaders)
          .filter(([key]) => key.trim())
          .map(([key, value]) => [
            key.trim(),
            typeof value === 'string' ? value : JSON.stringify(value)
          ])
      ),
      ...authHeaders
    }
  }
}
