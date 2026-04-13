-- name: CreateDecisionContextSnapshot :one
INSERT INTO decision_context_snapshot (
    decision_case_id,
    workspace_id,
    source,
    source_ref,
    metrics,
    captured_at
) VALUES (
    sqlc.arg('decision_case_id'),
    sqlc.arg('workspace_id'),
    COALESCE(sqlc.narg('source'), ''),
    COALESCE(sqlc.narg('source_ref'), ''),
    COALESCE(sqlc.narg('metrics'), '{}'::jsonb),
    COALESCE(sqlc.narg('captured_at'), now())
) RETURNING *;

-- name: GetDecisionContextSnapshot :one
SELECT * FROM decision_context_snapshot
WHERE id = sqlc.arg('id');

-- name: GetDecisionContextSnapshotInWorkspace :one
SELECT * FROM decision_context_snapshot
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: ListDecisionContextSnapshots :many
SELECT * FROM decision_context_snapshot
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('source')::text IS NULL OR source = sqlc.narg('source'))
ORDER BY captured_at DESC, created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountDecisionContextSnapshots :one
SELECT COUNT(*) FROM decision_context_snapshot
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('source')::text IS NULL OR source = sqlc.narg('source'));

-- name: UpdateDecisionContextSnapshot :one
UPDATE decision_context_snapshot
SET source = COALESCE(sqlc.narg('source'), source),
    source_ref = COALESCE(sqlc.narg('source_ref'), source_ref),
    metrics = COALESCE(sqlc.narg('metrics'), metrics),
    captured_at = COALESCE(sqlc.narg('captured_at'), captured_at)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDecisionContextSnapshot :exec
DELETE FROM decision_context_snapshot
WHERE id = sqlc.arg('id');
