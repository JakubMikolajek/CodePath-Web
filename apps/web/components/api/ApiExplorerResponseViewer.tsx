import type { Nullable } from '@workspace/codepath-common'
import type { RepoApiRunnerResponse } from '@workspace/codepath-common/api-explorer'

export function ApiExplorerResponseViewer({ result }: { result: Nullable<RepoApiRunnerResponse> }) {
  if (!result) return null

  const preview = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-sm">
        Status:{' '}
        <span className={result.ok ? 'text-green-600' : 'text-red-600'}>
          {result.status}
        </span>{' '}
        | Duration: {result.durationMs}ms
      </p>

      <p className="break-all font-mono text-xs text-muted-foreground">
        {result.url}
      </p>

      <details className="text-xs">
        <summary className="cursor-pointer">Response headers</summary>

        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-3">
          {JSON.stringify(result.headers, null, 2)}
        </pre>
      </details>

      <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-100">
        {preview}
      </pre>
    </div>
  )
}
