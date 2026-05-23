import { createAxiosServer } from './axiosServer'
import { createApiClient } from './createApiClient'

export const apiServer = async () => {
  const client = await createAxiosServer()
  return createApiClient(client)
}
