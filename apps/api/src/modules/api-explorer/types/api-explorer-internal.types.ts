export interface ApiExplorerQuery {
  frameworks?: string
  methods?: string
  runtimeBaseUrl?: string
  search?: string
}

export interface CanonicalApiFile {
  content: string
  fileExt: string
  filePath: string
  language: string
  segmentCount: number
}

export interface ApiExplorerIngestSegmentPayload {
  content?: string
  file_ext?: string
  file_path?: string
  http_method?: string
  language?: string
  message_type?: string
  params?: string[]
  return_type?: string
  route_path?: string
  start_line?: number
  symbol_kind?: string
  symbol_name?: string
}

export interface ApiExplorerRepoOwnership {
  id: number
  name: string
}

export interface SourceContext {
  lineStart: number
  snippet: string
}
