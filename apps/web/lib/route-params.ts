import type { Undefinable } from '@workspace/codepath-common'

export function getFirstRouteParam(param: string | string[] | undefined): Undefinable<string> {
  return Array.isArray(param) ? param[0] : param
}
