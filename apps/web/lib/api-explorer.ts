import type { RepoApiRunnerCollectionConfig } from '@workspace/codepath-common/api-explorer'
import { RepoApiRunnerApiKeyPlacement, RepoApiRunnerAuthMode } from '@workspace/codepath-common/api-explorer'

export function createDefaultRunnerAuthConfig(): RepoApiRunnerCollectionConfig['auth'] {
  return {
    apiKeyName: 'x-api-key',
    apiKeyPlacement: RepoApiRunnerApiKeyPlacement.HEADER,
    apiKeyValue: '',
    basicPassword: '',
    basicUsername: '',
    bearerToken: '',
    mode: RepoApiRunnerAuthMode.NONE
  }
}
