-- name: CreateSource :one
INSERT INTO source (
    workspace_id,
    runtime_id,
    name,
    source_type,
    config,
    connection_status,
    connection_error,
    last_test_message,
    last_tested_at
) VALUES (
    sqlc.arg('workspace_id'),
    sqlc.arg('runtime_id'),
    sqlc.arg('name'),
    COALESCE(sqlc.narg('source_type'), 'mcp'),
    COALESCE(sqlc.narg('config'), '{}'::jsonb),
    COALESCE(sqlc.narg('connection_status'), 'untested'),
    COALESCE(sqlc.narg('connection_error'), ''),
    COALESCE(sqlc.narg('last_test_message'), ''),
    sqlc.narg('last_tested_at')
) RETURNING *;

-- name: GetSource :one
SELECT * FROM source
WHERE id = sqlc.arg('id');

-- name: GetSourceInWorkspace :one
SELECT * FROM source
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: ListSources :many
SELECT * FROM source
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('source_type')::text IS NULL OR source_type = sqlc.narg('source_type'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: UpdateSource :one
UPDATE source
SET runtime_id = COALESCE(sqlc.narg('runtime_id'), runtime_id),
    name = COALESCE(sqlc.narg('name'), name),
    source_type = COALESCE(sqlc.narg('source_type'), source_type),
    config = COALESCE(sqlc.narg('config'), config),
    connection_status = COALESCE(sqlc.narg('connection_status'), connection_status),
    connection_error = COALESCE(sqlc.narg('connection_error'), connection_error),
    last_test_message = COALESCE(sqlc.narg('last_test_message'), last_test_message),
    last_tested_at = COALESCE(sqlc.narg('last_tested_at'), last_tested_at),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteSource :exec
DELETE FROM source
WHERE id = sqlc.arg('id');

-- name: RecordSourceTestResult :one
UPDATE source
SET connection_status = sqlc.arg('connection_status'),
    connection_error = COALESCE(sqlc.narg('connection_error'), ''),
    last_test_message = COALESCE(sqlc.narg('last_test_message'), last_test_message),
    last_tested_at = COALESCE(sqlc.narg('last_tested_at'), now()),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;
