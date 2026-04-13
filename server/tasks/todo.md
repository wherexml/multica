# GOV-P1-023 Todo

- [x] Add failing tests for audit recording, decision/workspace audit listing, and single-event lookup.
- [x] Add `audit_event` migration and sqlc queries for create/get/list/count.
- [x] Implement `internal/handler/audit.go` with audit recording helper and read endpoints.
- [x] Wire audit routes and add post-commit audit recording to decision/scenario/recommendation/action handlers.
- [ ] Run `make sqlc`, focused tests, and `go build ./cmd/server`; update this review with results.

## Review

- [x] Added integration coverage for decision/workspace audit endpoints and lifecycle audit assertions in `cmd/server/audit_integration_test.go`.
- [x] Added `046_audit_event` migration and `pkg/db/queries/audit.sql`.
- [x] Implemented `internal/handler/audit.go` and wired audit writes after successful commits across decision/scenario/recommendation/action handlers.
- [x] Wired `/api/decisions/{id}/audit-trail` and `/api/audit/events` routes.
- [ ] `make sqlc` could not run in this sandbox because the `sqlc` binary is not installed; added `pkg/db/generated/audit.sql.go` and updated `pkg/db/generated/models.go` manually to match existing generated style.
- [ ] `go test ./cmd/server -run TestAudit -count=1 -v` skipped because this sandbox cannot reach local PostgreSQL on `127.0.0.1:5432`.
- [x] `GOCACHE=/tmp/gocache go build ./cmd/server` passed.
