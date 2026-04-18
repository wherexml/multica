# FE-BE-P2-034 MCP 数据源第二期（Sources 真实 MCP 读链路）

- [x] Fix the `/sources` list cache shape so create/update mutations no longer treat `{ sources, total }` as an array
- [x] Add `source_secret`, `source_tool`, and `source_run` persistence plus sqlc queries for auth state, tool snapshots, and source-op runs
- [x] Add `/api/sources/:id/auth`, `/tools`, `/tools/refresh`, `/tools/:toolName/call`, and `/runs/:runId` plus daemon claim/complete/fail endpoints
- [x] Connect `Source -> Runtime -> MCP` through the daemon using the official Go SDK for streamable HTTP, SSE, and stdio transports
- [x] Restrict tool execution to `read_only` MCP tools while surfacing `write` and `unknown` tools as visible-but-blocked
- [x] Extend the Sources detail page with auth management, real tool list rendering, read-only tool run dialog, and latest run/result display
- [x] Verify targeted Go tests/builds plus focused `@multica/core` / `@multica/views` type checks and Vitest coverage for the new Sources flow
- [x] Run browser-visible verification for the full local `/sources` flow after redeploy, then record screenshots / notes
- [ ] Decide and implement how `Source` write-capable MCP tools should map into existing connector/action governance

## Review

- Fixed the cache-shape bug behind `e.some is not a function` by keeping the sources query cache in the server response shape and updating mutations against that same shape.
- Sources now persist masked auth state, discovered tool snapshots, and queued/completed source-op runs without leaking bearer or OAuth secrets back to the browser.
- The daemon now claims source runs and performs real MCP test/discovery/tool-call work over HTTP, SSE, and stdio using the official Go SDK.
- The UI now exposes auth update/clear actions, a real tool list, visible safety labels, a guarded run flow for read-only tools, and the latest run/result panel.
- Browser-visible local verification passed on `http://localhost:22202/sources`: create no longer crashes, auth-save/test/tool-refresh/tool-call all work, and the tool list now auto-syncs after discovery without a manual refresh click.
- Write-capable or safety-unknown MCP tools are intentionally blocked in this phase; governance for external-system writes is still a follow-up item.

# FE-BE-P1-033 MCP 数据源第一期（Sources + MCP UI 壳子）

- [x] Add the new `source` table migration and sqlc queries for workspace-scoped source CRUD and test-result persistence
- [x] Add `/api/sources` list/create/get/update/delete/test handlers and wire them into the protected router
- [x] Add the new `Source` / `McpSourceConfig` frontend types, API client methods, and React Query hooks
- [x] Build the `/sources` product layer with list, detail, create/edit dialog, auto-test flow, and status display
- [x] Add sidebar, search, web route, desktop route, and runtime-page entry wiring for the new Sources layer
- [x] Verify targeted `@multica/core` / `@multica/views` / `@multica/web` / `@multica/desktop` type checks plus focused Vitest coverage and `go test ./internal/source`
- [ ] Replace the current config-only MCP test with real runtime-side MCP connection attempts for HTTP / SSE / stdio transports
- [ ] Add source tool discovery APIs and UI so the detail page can show real MCP tools instead of the current placeholder block
- [ ] Add source auth completion flows for OAuth/Bearer secrets storage instead of only returning `needs_auth`
- [ ] Connect `Source -> Runtime -> MCP` into real query/execution orchestration so sources can do more than save config and test shape
- [ ] Decide and implement how `Source` should map to existing `connector` / action-run governance for write actions
- [ ] Run browser-visible verification for `/sources` and the runtime-page “连接执行环境” entry, then record screenshots / review notes
- [ ] Update the deeper product docs (`ARCHITECTURE.md`, `frontend.md`, `backend.md`, `database.md`, `api_contract.md`) to reflect the new Sources layer

## Review

- Added a first-class `Sources` layer for MCP configuration and testing, separate from `Runtimes`.
- A source now stores runtime binding, MCP transport/auth config, connection status, error text, and last test result.
- The current backend test path only validates config shape plus runtime-online state; it does **not** open a real MCP connection yet.
- The current detail page intentionally keeps tools/permissions as a placeholder to avoid faking capabilities that are not wired end to end.
- Verified with `pnpm --filter @multica/core typecheck`, `pnpm --filter @multica/views typecheck`, `pnpm --filter @multica/web typecheck`, `pnpm --filter @multica/desktop typecheck`, `pnpm --filter @multica/views exec vitest run ./sources/components/source-panels.test.tsx ./layout/app-sidebar.test.tsx ./search/search-command.test.tsx ./runtimes/components/runtime-panels.test.tsx`, `pnpm --filter @multica/core exec vitest run ./platform/lexicon.test.ts`, `cd server && go test ./internal/source`, and `cd server && go build ./cmd/server`.

# FE-P1-032 登录注册页中文化与 OptiOne 品牌统一

- [x] Inspect the localized auth copy requirements and current login/register coverage
- [x] Add failing auth page tests for the new Chinese copy and OptiOne branding
- [x] Update the login and register pages to use the approved Chinese text
- [x] Verify the targeted auth tests and browser-visible login/register pages, then record review notes

## Review

- Replaced the login page header with `OptiONE Platform` and converted the login card copy, labels, placeholders, validation messages, and footer link text to Chinese.
- Converted the register page to Chinese, removed the visible `Multica` wording in favor of `OptiOne`, and localized the name/email/password/confirm-password flow plus the footer link text.
- Added a shared auth error localizer so common password-auth API errors no longer surface in English on these two pages.
- Wired the register footer submit button back to the form so the localized register CTA still submits correctly after the copy update.
- Verified with `pnpm --filter @multica/web exec vitest run app/(auth)/login/page.test.tsx app/(auth)/register/page.test.tsx`, `pnpm --filter @multica/web typecheck`, and live browser checks on `http://localhost:22202/login` and `http://localhost:22202/register`.

# FE-P1-031 任务术语统一与页面易懂化修复

- [x] Remove the non-functional Skills recommendation template block from the settings panel
- [x] Rename the control-tower agent label and related helper copy to the approved exception-handling wording
- [x] Fix legacy project icon token rendering so old token values no longer appear as overlapping text
- [x] Rename “我的 Agent” and clarify it as the user-owned digital-employee scope
- [x] Replace all user-facing “决策单” labels with “任务”, including “决策单中心” to “所有任务”
- [x] Localize the issue-center scope tabs from All / Members / Agents to 全部 / 成员 / 数字员工
- [x] Verify the affected tests, type checks, and browser-visible flows, then record review notes

## Review

- Removed the non-clickable Skills recommendation template block so the settings panel no longer shows a fake action area.
- Unified the visible issue terminology to `任务`, renamed `决策单中心` to `所有任务`, and localized the issue-center scope tabs plus My Issues agent scope to clearer Chinese wording.
- Renamed the alert-focused agent presentation from `控制塔` to `异常处理`, added a migration to fix the legacy demo agent record in the database, and confirmed the agents page now shows `异常处理Agent` without leftover `控制塔 Agent` or `决策单`.
- Added a project icon normalizer so legacy token values like `package` render as real icons instead of overlapping raw text in project lists and search.
- Verified with `pnpm --filter @multica/core exec vitest run ./platform/lexicon.test.ts`, `pnpm --filter @multica/views exec vitest run ./issues/components/issues-page.test.tsx ./agents/components/agent-list-item.test.ts ./layout/app-sidebar.test.tsx ./projects/components/project-icon.test.ts ./search/search-command.test.tsx`, `pnpm --filter @multica/views typecheck`, `docker compose --profile migrate run --rm --build migrate`, and browser checks on `/issues`, `/my-issues`, `/skills`, `/agents`, and `/projects`.

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

- [x] Switch the container deployment and related docs back to the required 22200 / 22201 / 22202 ports
- [x] Redeploy the Docker stack and repoint local CLI/daemon to the 2220X URLs
- [x] Verify the local Claude runtime is online after the redeploy
- [ ] Create a Skill and Agent in the app and bind the Agent to the local Claude runtime
- [ ] Run one module flow end to end with the new Agent and record the outcome

## Review

- Standardized the active local defaults back to PostgreSQL `22200`, backend `22201`, and frontend `22202` across the self-hosted stack, CLI local setup defaults, desktop/web fallback URLs, scripts, and the main self-hosting docs.
- Rebuilt and restarted the local daemon against the `22201` backend, then verified the daemon health endpoint and `/api/runtimes` both report the local Claude runtime online on the restored 2220X setup.
- Found and fixed a daemon-source drift where rebuilding from current source dropped `Gemini` from the detected local runtimes; the daemon now detects and serves `Claude`, `Codex`, `Hermes`, and `Gemini` again after rebuild.
- Verified with `pnpm --filter @multica/web exec vitest run next.config.test.ts`, `cd server && go test ./internal/daemon ./pkg/agent ./cmd/multica`, `cd server && go build -o bin/server ./cmd/server && go build -o bin/migrate ./cmd/migrate && go build -o bin/multica ./cmd/multica`, `curl http://localhost:22201/health`, `curl http://127.0.0.1:19514/health`, and `curl http://localhost:22201/api/runtimes` using the local CLI token/workspace headers.

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
