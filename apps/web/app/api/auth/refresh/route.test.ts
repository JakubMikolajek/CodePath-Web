import { describe, expect, it } from 'vitest'

import { getSetCookieHeaders } from './route'

describe('auth refresh route', () => {
  it('preserves separate Set-Cookie headers from NextAuth', () => {
    const headers = new Headers()

    headers.append('set-cookie', 'next-auth.session-token=first; Path=/; HttpOnly; SameSite=Lax')
    headers.append('set-cookie', '__Secure-next-auth.callback-url=second; Path=/; HttpOnly; SameSite=Lax')

    expect(getSetCookieHeaders(headers)).toEqual([
      'next-auth.session-token=first; Path=/; HttpOnly; SameSite=Lax',
      '__Secure-next-auth.callback-url=second; Path=/; HttpOnly; SameSite=Lax'
    ])
  })

  it('does not split the comma inside an Expires attribute', () => {
    const headers = new Headers({
      'set-cookie': 'next-auth.session-token=first; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, __Secure-next-auth.callback-url=second; Path=/'
    })

    expect(getSetCookieHeaders(headers)).toEqual([
      'next-auth.session-token=first; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/',
      '__Secure-next-auth.callback-url=second; Path=/'
    ])
  })
})
