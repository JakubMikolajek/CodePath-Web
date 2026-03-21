# Live Smoke Runbook (Non-Clean RabbitMQ)

Date: 2026-03-21  
Scope: close final manual runtime item for `X-005` / `WEB-010` on real broker state.

## Goal

Validate in runtime environment (non-clean RabbitMQ):
- topology migration/verify works end-to-end (Web + Orchestrator),
- retry TTL path works,
- DLQ path works after max retries,
- telemetry/metrics expose expected signals.

## Exit Criteria

- `rabbit:migrate` + `rabbit:verify` (Web) pass.
- `rabbitmq migrate` + `rabbitmq verify` (Orchestrator) pass.
- Poison message appears in `docs.dlq` after retries.
- AI metrics include:
  - `codepath_queue_retry_total{queue="docs",...}`
  - `codepath_queue_dlq_total{queue="docs",...}`
  - `codepath_queue_lag_messages{queue="docs",lane="dlq",...}`
- No `PRECONDITION_FAILED` during startup/verify.

## Prerequisites

- RabbitMQ reachable on `amqp://admin:admin@127.0.0.1:5672/` (or your target URL).
- Services configured with same Rabbit creds:
  - `CodePath-Web` (`RABBIT_URL`)
  - `CodePath-Orchestrator` (`RABBIT_URL`/`RABBITMQ_URL`)
  - `CodePath-AI` (`RABBIT_HOST`/`RABBIT_USER`/`RABBIT_PASSWORD`/`RABBIT_VHOST`)
- `CodePath-AI` workers running (at least `docs` worker).

## 0) Prepare Evidence Folder

```bash
RUN_ID="$(date +%Y%m%d-%H%M%S)"
EVIDENCE_DIR="$HOME/codepath-smoke-$RUN_ID"
mkdir -p "$EVIDENCE_DIR"
echo "$EVIDENCE_DIR"
```

Use `tee -a "$EVIDENCE_DIR/<file>.log"` on all commands below.

## 1) Snapshot Queue State Before Migration

### Option A: local RabbitMQ (docker)

```bash
docker exec -it rabbitmq rabbitmqctl list_queues name messages consumers \
  | tee -a "$EVIDENCE_DIR/01-before-queues.log"
```

### Option B: k8s RabbitMQ

```bash
RABBIT_POD="$(kubectl -n codepath get pod -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')"
kubectl -n codepath exec "$RABBIT_POD" -- rabbitmqctl list_queues name messages consumers \
  | tee -a "$EVIDENCE_DIR/01-before-queues.log"
```

## 2) Apply and Verify Topology (Web + Orchestrator)

### Web

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-Web/apps/api
bun run rabbit:migrate | tee -a "$EVIDENCE_DIR/02-web-migrate.log"
bun run rabbit:verify | tee -a "$EVIDENCE_DIR/03-web-verify.log"
```

### Orchestrator

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-Orchestrator
cargo run -- rabbitmq migrate | tee -a "$EVIDENCE_DIR/04-orchestrator-migrate.log"
cargo run -- rabbitmq verify | tee -a "$EVIDENCE_DIR/05-orchestrator-verify.log"
```

## 3) Start Runtime Services (if not already running)

### Orchestrator

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-Orchestrator
cargo run | tee -a "$EVIDENCE_DIR/06-orchestrator-runtime.log"
```

### Web API

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-Web/apps/api
bun run dev | tee -a "$EVIDENCE_DIR/07-web-runtime.log"
```

### AI workers

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-AI
poetry run python runner.py | tee -a "$EVIDENCE_DIR/08-ai-runtime.log"
```

## 4) Inject Poison Message (deterministic retry + DLQ)

Use invalid JSON payload on `docs` queue:

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-AI
poetry run python -c "import pika; c=pika.BlockingConnection(pika.ConnectionParameters(host='127.0.0.1',port=5672,virtual_host='/',credentials=pika.PlainCredentials('admin','admin'))); ch=c.channel(); ch.basic_publish(exchange='', routing_key='docs', body=b'{bad-json', properties=pika.BasicProperties(content_type='application/json', delivery_mode=2)); c.close(); print('poison message published to docs')"
```

Then wait at least `RABBIT_MAX_RETRY_ATTEMPTS * RABBIT_RETRY_DELAY_MS`  
Default: `3 * 5000ms = 15s` (recommend wait 30s).

## 5) Validate Queue Transitions

Repeat twice with 10-15s interval:

### Option A: local RabbitMQ (docker)

```bash
docker exec -it rabbitmq rabbitmqctl list_queues name messages consumers \
  | tee -a "$EVIDENCE_DIR/09-after-queues.log"
```

### Option B: k8s RabbitMQ

```bash
kubectl -n codepath exec "$RABBIT_POD" -- rabbitmqctl list_queues name messages consumers \
  | tee -a "$EVIDENCE_DIR/09-after-queues.log"
```

Expected:
- transient increase on `docs.retry`,
- final increase on `docs.dlq`,
- `docs` main queue does not keep growing indefinitely.

## 6) Validate Metrics and Telemetry

### AI metrics (`docs` worker default `:9102`)

```bash
curl -s http://127.0.0.1:9102/metrics | rg "codepath_queue_(retry_total|dlq_total|lag_messages).*docs" \
  | tee -a "$EVIDENCE_DIR/10-ai-metrics.log"
```

Expected samples:
- `codepath_queue_retry_total{queue="docs",service="ai-worker"}`
- `codepath_queue_dlq_total{queue="docs",service="ai-worker"}`
- `codepath_queue_lag_messages{lane="dlq",queue="docs",service="ai-worker"}`

### Runtime logs

Check AI logs for:
- `queue_retry_scheduled`
- `queue_message_moved_to_dlq`

Check Web/Orchestrator logs for absence of:
- `PRECONDITION_FAILED`
- `RabbitMQ topology mismatch`

## 7) Recovery / Cleanup

If you want to clear only smoke artifact messages:

### Option A: local RabbitMQ (docker)

```bash
docker exec -it rabbitmq rabbitmqctl purge_queue docs.retry
docker exec -it rabbitmq rabbitmqctl purge_queue docs.dlq
```

### Option B: k8s RabbitMQ

```bash
kubectl -n codepath exec "$RABBIT_POD" -- rabbitmqctl purge_queue docs.retry
kubectl -n codepath exec "$RABBIT_POD" -- rabbitmqctl purge_queue docs.dlq
```

Re-run verify:

```bash
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-Web/apps/api && bun run rabbit:verify
cd /Users/jakubmikolajek/Desktop/WŁASNE/CodePath/CodePath-Orchestrator && cargo run -- rabbitmq verify
```

## 8) Attach Evidence to Ticket

Attach:
- `01-before-queues.log`
- `02-web-migrate.log`
- `03-web-verify.log`
- `04-orchestrator-migrate.log`
- `05-orchestrator-verify.log`
- `09-after-queues.log`
- `10-ai-metrics.log`
- short note with absolute run timestamp and environment.
