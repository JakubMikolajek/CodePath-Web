import { toLower, replace } from 'lodash'

export function sanitizeString(value: string): string {
  return replace(toLower(value), /[^a-z0-9]/g, '_')
}
