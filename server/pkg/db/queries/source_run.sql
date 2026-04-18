-- name: CreateSourceRun :one
INSERT INTO source_run (
    source_id,
    workspace_id,
    runtime_id,
    run_type,
    status,
    tool_name,
    request_payload,
    result_payload,
    summary,
    error_message,
    started_at,
    completed_at
) VALUES (
    sqlc.arg('source_id'),
    sqlc.arg('workspace_id'),
    sqlc.arg('runtime_id'),
    sqlc.arg('run_type'),
    COALESCE(sqlc.narg('status'), 'pending'),
    COALESCE(sqlc.narg('tool_name'), ''),
    COALESCE(sqlc.narg('request_payload'), '{}'::jsonb),
    COALESCE(sqlc.narg('result_payload'), '{}'::jsonb),
    COALESCE(sqlc.narg('summary'), ''),
    COALESCE(sqlc.narg('error_message'), ''),
    sqlc.narg('started_at'),
    sqlc.narg('completed_at')
) RETURNING *;

-- name: GetSourceRun :one
SELECT * FROM source_run
WHERE id = sqlc.arg('id');

-- name: GetSourceRunInWorkspace :one
SELECT * FROM source_run
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: GetLatestSourceRunBySource :one
SELECT * FROM source_run
WHERE source_id = sqlc.arg('source_id')
ORDER BY created_at DESC
LIMIT 1;

-- name: ListSourceRunsBySource :many
SELECT * FROM source_run
WHERE source_id = sqlc.arg('source_id')
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count');

-- name: ClaimNextSourceRunByRuntime :one
WITH next_run AS (
    SELECT id
    FROM source_run srq
    WHERE srq.runtime_id = sqlc.arg('runtime_id')
      AND srq.status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE source_run sr
SET status = 'running',
    started_at = now(),
    updated_at = now()
FROM next_run
WHERE sr.id = next_run.id
RETURNING sr.*;

-- name: CompleteSourceRun :one
UPDATE source_run
SET status = COALESCE(sqlc.narg('status'), 'completed'),
    result_payload = COALESCE(sqlc.narg('result_payload'), result_payload),
    summary = COALESCE(sqlc.narg('summary'), summary),
    error_message = COALESCE(sqlc.narg('error_message'), error_message),
    completed_at = COALESCE(sqlc.narg('completed_at'), now()),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: FailSourceRun :one
UPDATE source_run
SET status = COALESCE(sqlc.narg('status'), 'failed'),
    result_payload = COALESCE(sqlc.narg('result_payload'), result_payload),
    summary = COALESCE(sqlc.narg('summary'), summary),
    error_message = COALESCE(sqlc.narg('error_message'), error_message),
    completed_at = COALESCE(sqlc.narg('completed_at'), now()),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;
