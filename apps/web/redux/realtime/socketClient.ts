import { io, type Socket } from 'socket.io-client'

let socket: Socket | undefined

export function getRealtimeSocket(): Socket {
  if (socket) return socket

  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL

  if (!realtimeUrl) throw new Error('NEXT_PUBLIC_REALTIME_URL must be configured before connecting to realtime updates')

  socket = io(`${realtimeUrl.replace(/\/$/, '')}/realtime`, {
    autoConnect: false,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    auth: callback => {
      void fetchRealtimeToken()
        .then(token => callback({ token }))
        .catch(() => callback({}))
    }
  })

  return socket
}

async function fetchRealtimeToken(): Promise<string> {
  const response = await fetch('/api/backend/realtime-token')

  if (!response.ok) throw new Error('Unable to retrieve a realtime authentication token')

  const payload = await response.json() as { token?: unknown }

  if (typeof payload.token !== 'string' || !payload.token) throw new Error('Realtime authentication token response was invalid')

  return payload.token
}
