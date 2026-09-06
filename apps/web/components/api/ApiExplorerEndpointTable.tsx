import type {
  RepoApiEndpoint,
  RepoApiHttpMethod
} from '@workspace/codepath-common/api-explorer'

const methodClasses: Record<RepoApiHttpMethod, string> = {
  DELETE: 'border-red-400/40 bg-red-400/10 text-red-200',
  GET: 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200',
  HEAD: 'border-slate-300/30 bg-slate-300/10 text-slate-200',
  OPTIONS: 'border-zinc-300/30 bg-zinc-300/10 text-zinc-200',
  PATCH: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  POST: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200',
  PUT: 'border-violet-300/40 bg-violet-300/10 text-violet-200'
}

interface ApiExplorerEndpointTableProps {
  endpoints: RepoApiEndpoint[];
  onUse: (endpoint: RepoApiEndpoint) => void;
  selectedEndpointId?: string;
}

export function ApiExplorerEndpointTable({
  endpoints,
  onUse,
  selectedEndpointId
}: ApiExplorerEndpointTableProps) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/6 bg-white/[0.012]">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-white/6 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-(--nurt-t3)">
            <th className="px-4.5 py-2.75">Method</th>

            <th className="px-3 py-2.75">Path</th>

            <th className="px-3 py-2.75">Framework</th>

            <th className="px-3 py-2.75">Module</th>

            <th className="px-3 py-2.75">File</th>

            <th className="px-3 py-2.75">Params</th>

            <th className="px-3 py-2.75">Code</th>

            <th className="px-3 py-2.75">Runner</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map(endpoint => {
            const isActive = selectedEndpointId === endpoint.id

            return (
              <tr
                className={`border-t border-white/6 transition hover:bg-white/2.5 ${isActive ? 'bg-primary/10' : ''}`}
                key={endpoint.id}
              >
                <td className="px-4.5 py-2.5 align-top">
                  <span className={`rounded-[6px] border px-2.25 py-0.75 font-mono text-[10.5px] font-semibold ${methodClasses[endpoint.method]}`}>
                    {endpoint.method}
                  </span>
                </td>

                <td className="max-w-65 truncate px-3 py-2.5 align-top font-mono text-xs text-foreground">
                  {endpoint.path}
                </td>

                <td className="px-3 py-2.5 align-top font-mono text-[11.5px] text-muted-foreground">
                  {endpoint.framework}
                </td>

                <td className="px-3 py-2.5 align-top font-mono text-[11.5px] text-muted-foreground">
                  {endpoint.moduleName ?? '-'}
                </td>

                <td className="max-w-[320px] truncate px-3 py-2.5 align-top font-mono text-[11px] text-(--nurt-t3)">
                  {endpoint.filePath}
                </td>

                <td className="px-3 py-2.5 align-top text-xs">
                  {endpoint.params.length === 0 ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {endpoint.params.map(param => (
                        <span
                          className="rounded-[5px] border border-white/6 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          key={`${endpoint.id}:${param.location}:${param.name}`}
                        >
                          {param.location}:{param.name}
                          {param.required ? '*' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                <td className="px-3 py-2.5 align-top text-xs">
                  {endpoint.sourceSnippet ? (
                    <details>
                      <summary className="cursor-pointer font-mono text-[11px] text-primary">
                        Show code
                        {endpoint.sourceLineStart ? ` (L${endpoint.sourceLineStart})` : ''}
                      </summary>

                      <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                        {endpoint.sourceSnippet}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>

                <td className="px-3 py-2.5 align-top">
                  <button
                    className={`rounded-[7px] border px-2.5 py-1 text-[11px] transition ${isActive ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 bg-white/3 text-foreground hover:bg-white/5'}`}
                    onClick={() => onUse(endpoint)}
                    type="button"
                  >
                    {isActive ? 'Selected' : 'Use in runner'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
