import axios from 'axios'

export const createAxiosServer = (cookie: string) =>
  axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
    headers: {
      Cookie: cookie,
    },
  })
