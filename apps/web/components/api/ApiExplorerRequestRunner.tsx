import type { Nullable } from '@workspace/codepath-common'
import type {
  RepoApiEndpoint,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerResponse
} from '@workspace/codepath-common/api-explorer'
import {
  RepoApiRunnerApiKeyPlacement,
  RepoApiRunnerAuthMode
} from '@workspace/codepath-common/api-explorer'
import { Button } from '@workspace/ui/components/button'
import { Textarea } from '@workspace/ui/components/textarea'
import type { ReactNode } from 'react'

import { ApiExplorerResponseViewer } from './ApiExplorerResponseViewer'

interface ApiExplorerRequestRunnerProps {
  auth: RepoApiRunnerCollectionConfig['auth']
  baseUrl: string
  bodyJson: string
  children: ReactNode
  headersJson: string
  isRunning: boolean
  onAuthChange: (auth: RepoApiRunnerCollectionConfig['auth']) => void
  onBaseUrlChange: (value: string) => void
  onBodyJsonChange: (value: string) => void
  onHeadersJsonChange: (value: string) => void
  onPathValuesChange: (values: Record<string, string>) => void
  onQueryJsonChange: (value: string) => void
  onRegenerate: () => void
  onRun: () => void
  onTimeoutChange: (value: number) => void
  pathValues: Record<string, string>
  queryJson: string
  result: Nullable<RepoApiRunnerResponse>
  runnerError: Nullable<string>
  selectedEndpoint: Nullable<RepoApiEndpoint>
  timeoutMs: number
}

const fieldClassName = 'h-11 rounded-[9px] border border-white/10 bg-input px-3 font-mono text-xs text-foreground shadow-none transition-[border-color,box-shadow,background,color] focus-visible:border-primary/40 focus-visible:bg-input focus-visible:ring-[2px] focus-visible:ring-primary/20'

export function ApiExplorerRequestRunner({
  auth,
  baseUrl,
  bodyJson,
  children,
  headersJson,
  isRunning,
  onAuthChange,
  onBaseUrlChange,
  onBodyJsonChange,
  onHeadersJsonChange,
  onPathValuesChange,
  onQueryJsonChange,
  onRegenerate,
  onRun,
  onTimeoutChange,
  pathValues,
  queryJson,
  result,
  runnerError,
  selectedEndpoint,
  timeoutMs
}: ApiExplorerRequestRunnerProps) {
  const updateAuth = (values: Partial<RepoApiRunnerCollectionConfig['auth']>) => onAuthChange({ ...auth, ...values })

  return (
    <section
      aria-label="API runner"
      className="nurt-panel space-y-3 p-[18px_20px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-foreground">
          API Runner (MVP)
        </h2>

        {selectedEndpoint && (
          <p className="font-mono text-xs text-muted-foreground">
            Selected: {selectedEndpoint.method} {selectedEndpoint.path}
          </p>
        )}
      </div>

      {selectedEndpoint?.sourceSnippet && (
        <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs">
          <summary className="cursor-pointer text-primary">
            Source fragment
            {selectedEndpoint.sourceLineStart ? ` (L${selectedEndpoint.sourceLineStart})` : ''}
          </summary>

          <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
            {selectedEndpoint.sourceSnippet}
          </pre>
        </details>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[11px] text-muted-foreground">Base URL</span>

          <input
            className={fieldClassName}
            onChange={event => onBaseUrlChange(event.target.value)}
            placeholder="http://127.0.0.1:3000"
            value={baseUrl}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[11px] text-muted-foreground">
            Timeout (ms)
          </span>

          <input
            className={fieldClassName}
            min={1000}
            onChange={event => onTimeoutChange(Number(event.target.value))}
            type="number"
            value={timeoutMs}
          />
        </label>
      </div>
      <div className="space-y-3 rounded-[11px] border border-white/6 bg-white/[0.012] p-3.5">
        <p className="nurt-label text-(--nurt-t3)">AUTH PRESET</p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[11px] text-muted-foreground">Mode</span>

          <select
            className={fieldClassName}
            onChange={event =>
              updateAuth({ mode: event.target.value as RepoApiRunnerAuthMode })
            }
            value={auth.mode}
          >
            <option value={RepoApiRunnerAuthMode.NONE}>None</option>
            <option value={RepoApiRunnerAuthMode.BEARER}>Bearer token</option>
            <option value={RepoApiRunnerAuthMode.BASIC}>Basic auth</option>
            <option value={RepoApiRunnerAuthMode.API_KEY}>API key</option>
          </select>
        </label>

        {auth.mode === RepoApiRunnerAuthMode.BEARER && (
          <label className="flex flex-col gap-1 text-sm">
            <span>Bearer token</span>

            <input
              className={fieldClassName}
              onChange={event => updateAuth({ bearerToken: event.target.value })}
              placeholder="eyJhbGciOi..."
              value={auth.bearerToken}
            />
          </label>
        )}

        {auth.mode === RepoApiRunnerAuthMode.BASIC && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Username</span>
              <input
                className={fieldClassName}
                onChange={event =>
                  updateAuth({ basicUsername: event.target.value })
                }
                value={auth.basicUsername}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Password</span>

              <input
                className={fieldClassName}
                onChange={event => updateAuth({ basicPassword: event.target.value })}
                type="password"
                value={auth.basicPassword}
              />
            </label>
          </div>
        )}

        {auth.mode === RepoApiRunnerAuthMode.API_KEY && (
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Key name</span>

              <input
                className={fieldClassName}
                onChange={event => updateAuth({ apiKeyName: event.target.value })}
                value={auth.apiKeyName}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Key value</span>
              <input
                className={fieldClassName}
                onChange={event => updateAuth({ apiKeyValue: event.target.value })}
                type="password"
                value={auth.apiKeyValue}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Placement</span>

              <select
                className={fieldClassName}
                onChange={event => updateAuth({ apiKeyPlacement: event.target.value as RepoApiRunnerApiKeyPlacement })}
                value={auth.apiKeyPlacement}
              >
                <option value={RepoApiRunnerApiKeyPlacement.HEADER}>
                  Header
                </option>

                <option value={RepoApiRunnerApiKeyPlacement.QUERY}>
                  Query
                </option>
              </select>
            </label>
          </div>
        )}
      </div>

      {children}

      {selectedEndpoint ? (
        <>
          <>
            {Object.keys(pathValues).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Path Params
                </p>

                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(pathValues).map(([name, value]) => (
                    <label className="flex flex-col gap-1 text-sm" key={name}>
                      <span>{name}</span>

                      <input
                        className={fieldClassName}
                        onChange={event => onPathValuesChange({ ...pathValues, [name]: event.target.value })}
                        value={value}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Query JSON</span>

              <Textarea
                className="h-40 font-mono text-xs"
                onChange={event => onQueryJsonChange(event.target.value)}
                value={queryJson}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Body JSON</span>

              <Textarea
                className="h-40 font-mono text-xs"
                onChange={event => onBodyJsonChange(event.target.value)}
                value={bodyJson}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Headers JSON</span>

              <Textarea
                className="h-40 font-mono text-xs"
                onChange={event => onHeadersJsonChange(event.target.value)}
                value={headersJson}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onRegenerate} type="button" variant="glass">
              Regenerate test payload
            </Button>

            <Button
              disabled={isRunning}
              onClick={onRun}
              type="button"
              variant="glow"
            >
              {isRunning ? 'Sending...' : 'Send request'}
            </Button>
          </div>

          {runnerError && <p className="text-sm text-red-500">{runnerError}</p>}

          <ApiExplorerResponseViewer result={result} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick endpoint from the table using "Use in runner".
        </p>
      )}
    </section>
  )
}
