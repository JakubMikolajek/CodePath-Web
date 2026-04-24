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
  language?: string
  message_type?: string
}

export interface ApiExplorerRepoOwnership {
  id: number
  name: string
}

export interface SourceContext {
  lineStart: number
  snippet: string
}
