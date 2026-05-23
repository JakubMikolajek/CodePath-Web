import { axiosClient } from './axiosClient'
import { createApiClient } from './createApiClient'

export const apiClient = createApiClient(axiosClient)
