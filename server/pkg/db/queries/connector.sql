-- name: CreateConnector :one
INSERT INTO connector (
    workspace_id,
    name,
    kind,
    base_url,
    capability,
    config,
    allowed_actions,
    health_status,
    last_health_check
) VALUES (
    sqlc.arg('workspace_id'),
    sqlc.arg('name'),
    COALESCE(sqlc.narg('kind'), 'erp'),
    COALESCE(sqlc.narg('base_url'), ''),
    COALESCE(sqlc.narg('capability'), 'read'),
    COALESCE(sqlc.narg('config'), '{}'::jsonb),
    COALESCE(sqlc.narg('allowed_actions')::text[], ARRAY[]::text[]),
    COALESCE(sqlc.narg('health_status'), 'unknown'),
    sqlc.narg('last_health_check')
) RETURNING *;

-- name: GetConnector :one
SELECT * FROM connector
WHERE id = sqlc.arg('id');

-- name: GetConnectorInWorkspace :one
SELECT * FROM connector
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: ListConnectors :many
SELECT * FROM connector
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('kind')::text IS NULL OR kind = sqlc.narg('kind'))
  AND (sqlc.narg('capability')::text IS NULL OR capability = sqlc.narg('capability'))
  AND (sqlc.narg('health_status')::text IS NULL OR health_status = sqlc.narg('health_status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: UpdateConnector :one
UPDATE connector
SET name = COALESCE(sqlc.narg('name'), name),
    kind = COALESCE(sqlc.narg('kind'), kind),
    base_url = COALESCE(sqlc.narg('base_url'), base_url),
    capability = COALESCE(sqlc.narg('capability'), capability),
    config = COALESCE(sqlc.narg('config'), config),
    allowed_actions = COALESCE(sqlc.narg('allowed_actions')::text[], allowed_actions),
    health_status = COALESCE(sqlc.narg('health_status'), health_status),
    last_health_check = COALESCE(sqlc.narg('last_health_check'), last_health_check),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteConnector :exec
DELETE FROM connector
WHERE id = sqlc.arg('id');

-- name: RecordConnectorHealthCheck :one
UPDATE connector
SET health_status = sqlc.arg('health_status'),
    last_health_check = COALESCE(sqlc.narg('last_health_check'), now()),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;
