-- name: ListSourceToolsBySource :many
SELECT * FROM source_tool
WHERE source_id = sqlc.arg('source_id')
ORDER BY
    CASE safety
        WHEN 'read_only' THEN 0
        WHEN 'write' THEN 1
        ELSE 2
    END,
    name ASC;

-- name: UpsertSourceTool :one
INSERT INTO source_tool (
    source_id,
    workspace_id,
    name,
    title,
    description,
    safety,
    input_schema,
    annotations,
    last_seen_at
) VALUES (
    sqlc.arg('source_id'),
    sqlc.arg('workspace_id'),
    sqlc.arg('name'),
    COALESCE(sqlc.narg('title'), ''),
    COALESCE(sqlc.narg('description'), ''),
    COALESCE(sqlc.narg('safety'), 'unknown'),
    COALESCE(sqlc.narg('input_schema'), '{}'::jsonb),
    COALESCE(sqlc.narg('annotations'), '{}'::jsonb),
    COALESCE(sqlc.narg('last_seen_at'), now())
)
ON CONFLICT (source_id, name)
DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    safety = EXCLUDED.safety,
    input_schema = EXCLUDED.input_schema,
    annotations = EXCLUDED.annotations,
    last_seen_at = EXCLUDED.last_seen_at,
    updated_at = now()
RETURNING *;

-- name: DeleteSourceToolsBySource :exec
DELETE FROM source_tool
WHERE source_id = sqlc.arg('source_id');
