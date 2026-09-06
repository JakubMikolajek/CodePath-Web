import type {
  RepoApiFramework,
  RepoApiHttpMethod
} from '@workspace/codepath-common/api-explorer'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Download, Filter, RefreshCw, RotateCcw, Search } from 'lucide-react'

const methodClasses: Record<RepoApiHttpMethod, string> = {
  DELETE: 'border-red-400/40 bg-red-400/10 text-red-200',
  GET: 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200',
  HEAD: 'border-slate-300/30 bg-slate-300/10 text-slate-200',
  OPTIONS: 'border-zinc-300/30 bg-zinc-300/10 text-zinc-200',
  PATCH: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  POST: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200',
  PUT: 'border-violet-300/40 bg-violet-300/10 text-violet-200'
}

interface ApiExplorerFiltersProps {
  availableFrameworks: RepoApiFramework[];
  endpointCount: number;
  exportingEndpoints: boolean;
  exportingOpenApi: boolean;
  frameworkOptions: RepoApiFramework[];
  frameworks: RepoApiFramework[];
  methodOptions: RepoApiHttpMethod[];
  methods: RepoApiHttpMethod[];
  onExportEndpoints: () => void;
  onExportOpenApi: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onRuntimeBaseUrlChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onToggleFramework: (framework: RepoApiFramework) => void;
  onToggleMethod: (method: RepoApiHttpMethod) => void;
  runtimeBaseUrl: string;
  search: string;
  segmentCount: number;
}

export function ApiExplorerFilters({
  availableFrameworks,
  endpointCount,
  exportingEndpoints,
  exportingOpenApi,
  frameworkOptions,
  frameworks,
  methodOptions,
  methods,
  onExportEndpoints,
  onExportOpenApi,
  onRefresh,
  onReset,
  onRuntimeBaseUrlChange,
  onSearchChange,
  onToggleFramework,
  onToggleMethod,
  runtimeBaseUrl,
  search,
  segmentCount
}: ApiExplorerFiltersProps) {
  return (
    <section
      aria-label="API explorer filters"
      className="nurt-panel p-[18px_20px]"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <label
          className="flex flex-col gap-2 text-sm font-medium"
          htmlFor="api-search"
        >
          <span className="nurt-label flex items-center gap-1.75 text-(--nurt-t3)">
            <Search className="size-3 text-(--nurt-t3)" />
            SEARCH
          </span>

          <Input
            id="api-search"
            onChange={event => onSearchChange(event.target.value)}
            placeholder="path, file, method, framework..."
            value={search}
          />
        </label>

        <label
          className="flex flex-col gap-2 text-sm font-medium"
          htmlFor="runtime-openapi-base-url"
        >
          <span className="text-right text-[11px] font-normal text-muted-foreground">
            Runtime OpenAPI Base URL (optional)
          </span>

          <Input
            id="runtime-openapi-base-url"
            onChange={event => onRuntimeBaseUrlChange(event.target.value)}
            placeholder="http://127.0.0.1:3001"
            value={runtimeBaseUrl}
          />

          <span className="text-right text-[10.5px] font-normal text-(--nurt-t3)">
            OpenAPI export is runtime-first from this URL, with static fallback
            from code.
          </span>
        </label>
      </div>

      <div className="mt-4 flex gap-10 max-lg:flex-col">
        <div className="space-y-2">
          <p className="nurt-label text-(--nurt-t3)">METHODS</p>

          <div className="flex flex-wrap gap-2 text-sm">
            {methodOptions.map(method => (
              <label
                className="flex cursor-pointer items-center gap-1.75 rounded-[8px] border border-white/10 px-2.5 py-1.25 transition hover:bg-white/3"
                key={method}
              >
                <input
                  checked={methods.includes(method)}
                  className="size-3.5 accent-primary"
                  onChange={() => onToggleMethod(method)}
                  type="checkbox"
                />

                <span
                  className={`rounded-[6px] border px-2 py-0.5 font-mono text-[11px] font-semibold ${methodClasses[method]}`}
                >
                  {method}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="nurt-label text-(--nurt-t3)">FRAMEWORKS</p>

          <div className="flex flex-wrap gap-2 text-sm">
            {frameworkOptions.map(framework => {
              const enabled = availableFrameworks.length === 0 || availableFrameworks.includes(framework)

              return (
                <label
                  className={`flex cursor-pointer items-center gap-1.75 rounded-[8px] border border-white/6 px-2.5 py-1.25 transition hover:bg-white/3 ${frameworks.includes(framework) ? 'text-foreground' : 'text-(--nurt-t3)'} ${enabled ? '' : 'opacity-40'}`}
                  key={framework}
                >
                  <input
                    checked={frameworks.includes(framework)}
                    className="size-3.5 accent-primary"
                    onChange={() => onToggleFramework(framework)}
                    type="checkbox"
                  />

                  <span className="font-mono text-[11px]">{framework}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button
          className="rounded-[9px] px-3.5 py-2 text-[12.5px]"
          onClick={onRefresh}
          type="button"
          variant="glow"
        >
          <Filter className="size-4" />
          Apply filters
        </Button>

        <Button
          className="rounded-[9px] px-3.25 py-2 text-[12.5px]"
          onClick={onReset}
          type="button"
          variant="glass"
        >
          <RotateCcw className="size-4" />
          Reset
        </Button>

        <Button
          className="rounded-[9px] px-3.25 py-2 text-[12.5px]"
          onClick={onRefresh}
          type="button"
          variant="glass"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>

        <Button
          className="rounded-[9px] px-3.25 py-2 text-[12.5px]"
          disabled={exportingEndpoints}
          onClick={onExportEndpoints}
          type="button"
          variant="glass"
        >
          <Download className="size-4" />
          {exportingEndpoints ? 'Exporting...' : 'Export Endpoints JSON'}
        </Button>

        <Button
          className="rounded-[9px] px-3.25 py-2 text-[12.5px]"
          disabled={exportingOpenApi}
          onClick={onExportOpenApi}
          type="button"
          variant="glass"
        >
          <Download className="size-4" />
          {exportingOpenApi ? 'Exporting...' : 'Export OpenAPI JSON'}
        </Button>

        <span className="ml-auto font-mono text-[11px] text-(--nurt-t3)">
          Endpoints: {endpointCount} | Segments scanned: {segmentCount}
        </span>
      </div>
    </section>
  )
}
