import type { Nullable } from '@workspace/codepath-common'

interface ApiExplorerStatusProps {
  error: Nullable<string>;
  hasEndpoints: boolean;
  isError: boolean;
  isLoading: boolean;
}

export function ApiExplorerStatus({ error, hasEndpoints, isError, isLoading }: ApiExplorerStatusProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading interactive API...
      </p>
    )
  }

  if (error ?? isError) {
    return (
      <p className="text-sm text-red-500">
        {error ?? 'Unable to load interactive API.'}
      </p>
    )
  }

  if (!hasEndpoints) {
    return (
      <p className="text-sm text-muted-foreground">
        No API endpoints detected with current filters.
      </p>
    )
  }

  return null
}
