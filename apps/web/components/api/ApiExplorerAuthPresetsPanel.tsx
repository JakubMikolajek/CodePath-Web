import type { RepoApiRunnerAuthPreset } from '@workspace/codepath-common/api-explorer'

interface ApiExplorerAuthPresetsPanelProps {
  name: string;
  onDelete: (id: number) => void;
  onLoad: (preset: RepoApiRunnerAuthPreset) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  presets: RepoApiRunnerAuthPreset[];
}

export function ApiExplorerAuthPresetsPanel({ name, onDelete, onLoad, onNameChange, onSave, presets }: ApiExplorerAuthPresetsPanelProps) {
  return (
    <div className="space-y-3 rounded-[11px] border border-white/6 bg-white/[0.012] p-3.5">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        Auth presets (workspace-shared)
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          className="h-11 min-w-55 flex-1 rounded-[9px] border border-white/10 bg-input px-3 font-mono text-xs text-foreground"
          onChange={event => onNameChange(event.target.value)}
          placeholder="Auth preset name"
          value={name}
        />

        <button
          className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-white"
          onClick={onSave}
          type="button"
        >
          Save current auth
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No saved auth presets for this repo yet.
        </p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-auto">
          {presets.map(preset => (
            <div
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"
              key={preset.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{preset.name}</p>

                <p className="truncate text-xs text-muted-foreground">
                  mode: {preset.config.mode}
                </p>
              </div>

              <div className="flex gap-1">
                <button
                  className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-white"
                  onClick={() => onLoad(preset)}
                  type="button"
                >
                  Load
                </button>

                <button
                  className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-white"
                  onClick={() => onDelete(preset.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
