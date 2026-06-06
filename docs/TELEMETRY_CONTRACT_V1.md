# Telemetry Contract v1 (`codepath.telemetry.v1`)

Canonical source in code: `../packages/codepath-common/src/telemetry.ts`.

## Required fields

- `schema`: `codepath.telemetry.v1`
- `timestamp`: ISO-8601 string
- `service`: `web-api | ai-worker | desktop`
- `runtimeFamily`: `pipeline | semantic`
- `component`: string
- `event`: string
- `level`: `info | warn | error`

## Optional fields

- `status`: `ok | retry | dlq | timeout | error`
- `queueName`: string
- `repoId`: number
- `correlationId`: string
- `durationMs`: number
- `details`: object with primitive values only (`string | number | boolean | null`)

## Compatibility notes

- Field names are camelCase.
- Producers must not emit snake_case variants (`queue_name`, `runtime_family`, etc.).
- Unknown enum values should be normalized to safe defaults by emitters.
