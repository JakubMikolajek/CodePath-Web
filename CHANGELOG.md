# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-07-26

<!-- Retroactive summary of the feature set as it existed before this CHANGELOG
     started tracking changes. Drafted from git history + the codebase — please
     correct/expand anything inaccurate or missing, this is a first pass. -->

### Added

- Repository ingest pipeline control plane: repo registration, MinIO snapshot storage, ingest job submission through the Orchestrator
- `ingest.v2` segment contract (`packages/codepath-common/src/ingest.ts`), consumed by `CodePath-Ingest` and `CodePath-AI`
- Evaluation module: `evaluationRuns`/`evaluationMetrics` schema, NestJS API, dashboard UI (Redux, Recharts) — Precision/Recall/MRR/BLEU/ROUGE/faithfulness surfaced from the Evaluation Worker (Faza 2b)
- Delta ingest: `changedFilePaths`/`deletedFilePaths` in `ingest.v2`, diffing by `files.hash` instead of full re-ingest on every push (Faza 4a)
- `docs_summary_cache` table, keyed by `sha256(digest + DOCS_PROMPT_VERSION + model)`, backing the two-level docs cache shared with `CodePath-AI` (Faza 4b)
- Chat streaming: NestJS `@Sse()` endpoint on Fastify, frontend `fetch`+`ReadableStream` consumer (not `EventSource`) — token-by-token responses instead of blocking on the full reply (Faza 5)
- Dependency graph: interactive graph API (`GET /dependencies/:repoId/interactive`) built live, on-demand from Qdrant segment payloads — no persisted graph tables
- `callTargets`/`extendsTargets` added to the `ingest.v2` segment contract; new `EXTENDS` edge type; `dependency-graph.builder.ts` prefers AST-derived symbol-to-symbol `CALLS` edges over the regex/file-level fallback whenever a file's segments carry AST call data (Faza 6)
- Keycloak/OIDC authentication support
- Nurt Cloud UI theme system (Aqua/Tide/Aurora family, shared with Desktop's Nurt theme)

### Known issues

- `GET /dependencies/:repoId` (non-interactive) still reads from the `dependencies` Postgres table, which has zero writers — this endpoint returns stale/empty results and is a candidate for removal or migration to the live-graph path.
- Plain `bun run lint` is blocked by unresolved `@workspace/eslint-config` → `eslint-config-prettier` workspace resolution (unrelated to any single feature above).

## [0.0.1] - placeholder

Initial `package.json` version before this changelog existed. Superseded by 1.0.0 above.
