# WEB-010 Smoke Evidence (2026-03-21)

Scope:
- `X-005`: API integration tests for retry/DLQ flow
- `WEB-010`: retry TTL + DLQ integration behavior

Repository:
- `CodePath-Web` (`apps/api`)

## Commands Executed

### 1) Integration suite (topology + RPC + orchestrator client + telemetry contract)

```bash
cd apps/api
bun run test -- --watchman=false \
  src/modules/rabbitmq/topology.integration.spec.ts \
  src/modules/chat/chat.rpc.integration.spec.ts \
  src/lib/orchestrator-client.spec.ts \
  src/lib/telemetry.spec.ts
```

Result:
- `PASS src/modules/rabbitmq/topology.integration.spec.ts`
- `PASS src/modules/chat/chat.rpc.integration.spec.ts`
- `PASS src/lib/orchestrator-client.spec.ts`
- `PASS src/lib/telemetry.spec.ts`
- Summary: `Test Suites: 4 passed, 4 total`, `Tests: 12 passed, 12 total`

### 2) Build validation

```bash
cd apps/api
bun run build
```

Result:
- `nest build` finished successfully.

## Evidence Notes

- Topology integration confirms main/retry/dlq structure and migration path behavior.
- Chat RPC integration confirms correlation handling and timeout/error telemetry path.
- Orchestrator client tests confirm retry and timeout handling to orchestrator endpoints.
- Telemetry contract test confirms payload keys and enum set for `codepath.telemetry.v1`.

## Smoke Checklist

- [x] Retry/DLQ topology assertions pass in integration tests.
- [x] RPC timeout/correlation path assertions pass.
- [x] API build succeeds after test changes.
- [ ] Live RabbitMQ smoke replay on a non-clean broker (manual runtime environment).

## Manual Runtime Follow-up (non-clean RabbitMQ)

Detailed runbook:
- `docs/LIVE_SMOKE_RUNBOOK_NON_CLEAN_RABBIT_2026-03-21.md`

Quick command subset:

```bash
# Web topology command
cd apps/api
bun run rabbit:migrate
bun run rabbit:verify

# Orchestrator topology command
cd ../../CodePath-Orchestrator
cargo run -- rabbitmq migrate
cargo run -- rabbitmq verify
```
