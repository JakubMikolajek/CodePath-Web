import { toLower, replace } from 'lodash'

export function sanitizeString(value: string): string {
  return replace(toLower(value), /[^a-z0-9]/g, '_')
}

export function cutContext(chunks: string[], maxChars = 16000) {
  const out: string[] = []
  let used = 0

  for (const txt of chunks) {
    if (used + txt.length > maxChars) {
      break
    }

    out.push(txt)
    used += txt.length
  }
  return out
}
