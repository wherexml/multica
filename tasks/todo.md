# FE-P1-030 我的待办双栏详情与中文化修复

- [x] Locate the My Issues routing flow, locale wiring, and issue detail back-navigation touchpoints
- [x] Switch My Issues from full-page issue navigation to left-list plus right-detail behavior
- [x] Localize the screenshot-visible My Issues, sidebar, and issue status copy for zh-CN while keeping English compatibility
- [x] Rename “专题中心” entry points to “项目中心” and add a clear return action on issue detail pages
- [x] Verify the affected web tests and type checks, then record review notes

## Review

- Reworked `我的待办` to reuse the inbox-style master-detail layout: desktop now keeps the list on the left and opens issue detail on the right, while mobile keeps a simple back-to-list flow.
- Routed the affected sidebar, search, My Issues scope tabs, issue status labels, and key issue-detail labels through the existing locale cookie so zh-CN stays Chinese and en-US still renders English.
- Renamed the visible `专题中心` entry points to `项目中心` and added an explicit `返回决策单中心` action in full-page issue detail headers so users no longer need to click the workspace name to go back.
- Verified with `pnpm --filter @multica/views typecheck`, `pnpm --filter @multica/views exec vitest run ./issues/components/issues-page.test.tsx ./issues/components/issue-detail.test.tsx ./search/search-command.test.tsx ./layout/app-sidebar.test.tsx`, and `pnpm --filter @multica/core exec vitest run ./platform/lexicon.test.ts ./issues/config/index.test.ts`.

# DEP-P1-029 2220X 重部署与本地 Claude Agent 验证

- [ ] Switch the container deployment and related docs back to the required 22200 / 22201 / 22202 ports
- [ ] Redeploy the Docker stack and repoint local CLI/daemon to the 2220X URLs
- [ ] Verify the local Claude runtime is online after the redeploy
- [ ] Create a Skill and Agent in the app and bind the Agent to the local Claude runtime
- [ ] Run one module flow end to end with the new Agent and record the outcome

# DEP-P1-028 Docker 2200X 重部署与登录恢复

- [x] Confirm the active Docker deployment source, env file, and auth-related drift
- [x] Update container deployment configuration to the required 22000 / 22001 / 22002 ports
- [x] Redeploy the Docker stack with the correct env file and restart cleanly
- [x] Verify backend/frontend health and confirm password login works end to end
- [x] Record the deployment lesson and review notes

## Review

- Found the active stack was started from `docker-compose.yml` with the default `.env`, not `.env.container`, which left the app on the old `2220X` ports and mixed in `3000`-based auth origins.
- Standardized the container env, compose defaults, deploy script, and deployment docs to `22000` / `22001` / `22002`.
- Fixed the redeploy blocker where the `migrate` service inherited the image entrypoint and started the server instead of running migrations by setting the service entrypoint to `./migrate`.
- Redeployed with `./scripts/deploy-container.sh` and verified health at `http://localhost:22001/health`.
- Verified password login end to end in the browser against `http://localhost:22002/login` using `admin@local` / `admin123`, with successful redirect to `/issues`.

# BE-P1-021 Runtime 扩展为通用执行器

- [x] Inspect runtime schema, runtime queries, and runtime handler coverage
- [x] Add failing tests for runtime executor list/detail/update behavior
- [x] Add runtime executor migration and sqlc queries
- [x] Extend runtime and daemon handlers to read/write executor details
- [x] Register runtime detail/update routes under `/api/runtimes`
- [x] Verify `go build ./cmd/server` and attempt targeted runtime handler test execution

## Review

- Added a `runtime_executor` sidecar table with default backfill plus trigger-based default creation for new runtimes.
- Extended runtime list/detail/update responses to include executor data and support `executor_kind` filtering.
- Added patch support for runtime metadata and executor fields in one request, with owner/admin-or-runtime-owner permissions.
- Generated new sqlc runtime executor queries and kept daemon registration backward compatible through DB defaults.
- Verified `go build ./cmd/server` passes. Targeted runtime handler tests were prepared, but executing DB-backed tests is blocked in this sandbox because localhost database access is denied.

# BE-P1-022 控制塔告警与指标快照 API

- [x] Inspect existing decision handler, inbox queries, router wiring, and websocket event conventions
- [x] Add failing router tests for tower alert listing, alert-to-decision conversion, and metrics snapshot listing
- [x] Add sqlc queries for tower alert pagination/filtering and snapshot totals
- [x] Implement tower and metrics handlers using existing handler patterns and workspace auth
- [x] Register `/api/tower/*` and `/api/metrics/*` routes and align decision created websocket event naming
- [x] Verify targeted Go tests and `go build ./cmd/server`

## Review

- Added workspace-scoped tower alert listing with pagination plus severity/domain/risk filtering, backed by inbox data and enriched with issue status.
- Added idempotent alert-to-decision conversion that reuses the linked issue, creates one frozen decision snapshot, and broadcasts `decision:created`.
- Added metrics snapshot listing with decision-case filtering, pagination totals, and API response fields aligned to `source_type`, `source_ref`, and `metrics_json`.
- Verified `go build ./cmd/server` passes. Targeted router tests were added, but this sandbox blocks localhost PostgreSQL access, so DB-backed test execution skips before hitting the new endpoints.

# FE-P0-009 决策单八 Tab 详情

# BE-P1-020 连接器管理与 mock/sandbox

- [x] Inspect current connector schema, sqlc queries, handler patterns, and router integration points
- [x] Add connector-focused tests for mock adapter behavior and handler CRUD/test flows
- [x] Implement mock connector adapter with type-based factory and canned read/write responses
- [x] Build connector list/create/get/update/test handlers with workspace scoping and validation
- [x] Register connector routes and verify server build plus connector adapter tests

## Review

- Added workspace-scoped connector endpoints for list, create, fetch, update, and mock health testing.
- Introduced a mock adapter layer with per-type factory mapping so connector tests have a stable sandbox target.
- Mapped API fields to the current connector schema (`connector_type` -> `kind`, `capabilities` -> `capability`, `auth_config` -> `config`, `last_tested_at` -> `last_health_check`) without changing the existing migration.
- Verified with `go test ./internal/connector` and `go build ./cmd/server`; the existing `internal/handler` package still has unrelated pre-existing test compile failures in `runtime_test.go`.

- [x] Inspect current issue detail, decision data types, and test coverage
- [x] Add failing tests for tab visibility and tab switching behavior
- [x] Add decision detail client typing and API support for tab-level fetching
- [x] Build the decision tab bar and placeholder tab containers
- [x] Extract collaboration content so Overview and Collaboration can both reuse it
- [x] Integrate tabs into issue detail while keeping the existing sidebar and issue actions intact
- [x] Verify targeted issue detail tests and `@multica/web` typecheck

## Review

- Added decision detail typing plus `api.getDecision(id)` so placeholder tabs can fetch their own detail data.
- Issue detail now renders a decision-aware tab bar while keeping the resizable two-panel layout and right sidebar intact.
- Overview keeps the existing title, description, reactions, sub-issues, and collaboration behavior; Collaboration is also available as its own tab for decision issues.
- Verified with the focused `IssueDetail` test file, `@multica/views` typecheck, and the requested `@multica/web` typecheck.

# FE-P0-007 Inbox Dashboard

- [x] Inspect existing inbox, issue, and decision data flows
- [x] Add failing tests for dashboard stats and alert filtering helpers
- [x] Add decision list typing and API client support
- [x] Build dashboard sections for stats, alerts, todos, and recent activity
- [x] Rewrite inbox page to use the dashboard on the left panel and keep detail behavior on the right
- [x] Verify targeted tests and web typecheck

## Review

- Inbox left panel now renders a dashboard with stats, alerts, todos, and recent activity.
- Existing inbox read, archive, mark-all-read, archive-all-read, and archive-completed behaviors remain wired through the existing mutations.
- Added decision list typing plus a minimal API client method so dashboard counts and alert filters can use live decision data.
- Verified with a focused helper test, `@multica/views` typecheck, refreshed Next route types, and `@multica/web` typecheck.

# BE-P1-017 诊断与场景仿真编排

- [x] Inspect existing decision handler, sqlc scenario/snapshot queries, and realtime event conventions
- [x] Add failing handler tests for diagnose, run scenario, and list scenarios endpoints
- [x] Implement scenario handler responses and helper mappers in `server/internal/handler/scenario.go`
- [x] Wire diagnose and scenario run flows to update decision phase, create records, and publish realtime events
- [x] Register the new decision scenario routes in `server/cmd/server/router.go`
- [x] Verify targeted handler tests and `go build ./cmd/server`

## Review

- Added `scenario.go` with three decision-scoped endpoints for diagnose, scenario run creation, and scenario listing.
- Diagnose now flips the decision to `diagnosing`, writes a placeholder context snapshot JSON payload, and publishes `decision:updated`.
- Scenario run now flips the decision to `simulating`, creates a queued run plus three placeholder options, and publishes `scenario:created`.
- Added isolated handler tests for the new flows and verified both the focused tests and `go build ./cmd/server`.

# DEP-P1-027 Deployment Manual

- [x] Verify compose, env, migration, auth, and route sources against the current repo
- [x] Draft `docs/deployment-demo.md` with demo-focused startup, compose, database, port, walkthrough, API, and troubleshooting sections
- [x] Verify commands, paths, URLs, and caveats in the written manual
