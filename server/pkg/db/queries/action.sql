-- name: CreateActionRun :one
INSERT INTO action_run (
    decision_case_id,
    workspace_id,
    idempotency_key,
    connector_id,
    action_type,
    request_payload,
    external_ref,
    rollback_payload,
    status,
    runtime_id,
    error_message,
    started_at,
    completed_at
) VALUES (
    sqlc.arg('decision_case_id'),
    sqlc.arg('workspace_id'),
    sqlc.arg('idempotency_key'),
    sqlc.narg('connector_id'),
    COALESCE(sqlc.narg('action_type'), ''),
    COALESCE(sqlc.narg('request_payload'), '{}'::jsonb),
    COALESCE(sqlc.narg('external_ref'), ''),
    COALESCE(sqlc.narg('rollback_payload'), '{}'::jsonb),
    COALESCE(sqlc.narg('status'), 'pending'),
    sqlc.narg('runtime_id'),
    COALESCE(sqlc.narg('error_message'), ''),
    sqlc.narg('started_at'),
    sqlc.narg('completed_at')
) RETURNING *;

-- name: GetActionRun :one
SELECT * FROM action_run
WHERE id = sqlc.arg('id');

-- name: GetActionRunInWorkspace :one
SELECT * FROM action_run
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: GetActionByIdempotencyKey :one
SELECT * FROM action_run
WHERE workspace_id = sqlc.arg('workspace_id')
  AND idempotency_key = sqlc.arg('idempotency_key');

-- name: ListActionRuns :many
SELECT * FROM action_run
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('connector_id')::uuid IS NULL OR connector_id = sqlc.narg('connector_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('action_type')::text IS NULL OR action_type = sqlc.narg('action_type'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: UpdateActionRun :one
UPDATE action_run
SET connector_id = COALESCE(sqlc.narg('connector_id'), connector_id),
    action_type = COALESCE(sqlc.narg('action_type'), action_type),
    request_payload = COALESCE(sqlc.narg('request_payload'), request_payload),
    external_ref = COALESCE(sqlc.narg('external_ref'), external_ref),
    rollback_payload = COALESCE(sqlc.narg('rollback_payload'), rollback_payload),
    status = COALESCE(sqlc.narg('status'), status),
    runtime_id = COALESCE(sqlc.narg('runtime_id'), runtime_id),
    error_message = COALESCE(sqlc.narg('error_message'), error_message),
    started_at = COALESCE(sqlc.narg('started_at'), started_at),
    completed_at = COALESCE(sqlc.narg('completed_at'), completed_at),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteActionRun :exec
DELETE FROM action_run
WHERE id = sqlc.arg('id');
