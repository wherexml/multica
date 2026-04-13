-- name: CreateAuditEvent :one
INSERT INTO audit_event (
    workspace_id,
    decision_case_id,
    actor_type,
    actor_id,
    action,
    target_type,
    target_id,
    old_state,
    new_state,
    metadata,
    ip_address,
    user_agent
) VALUES (
    sqlc.arg('workspace_id'),
    sqlc.arg('decision_case_id'),
    COALESCE(sqlc.narg('actor_type'), ''),
    sqlc.arg('actor_id'),
    sqlc.arg('action'),
    COALESCE(sqlc.narg('target_type'), ''),
    sqlc.arg('target_id'),
    COALESCE(sqlc.narg('old_state'), '{}'::jsonb),
    COALESCE(sqlc.narg('new_state'), '{}'::jsonb),
    COALESCE(sqlc.narg('metadata'), '{}'::jsonb),
    COALESCE(sqlc.narg('ip_address'), ''),
    COALESCE(sqlc.narg('user_agent'), '')
) RETURNING *;

-- name: GetAuditEvent :one
SELECT * FROM audit_event
WHERE id = sqlc.arg('id');

-- name: ListAuditEvents :many
SELECT * FROM audit_event
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action'))
  AND (sqlc.narg('actor_type')::text IS NULL OR actor_type = sqlc.narg('actor_type'))
  AND (sqlc.narg('actor_id')::uuid IS NULL OR actor_id = sqlc.narg('actor_id'))
  AND (sqlc.narg('target_type')::text IS NULL OR target_type = sqlc.narg('target_type'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountAuditEvents :one
SELECT COUNT(*) FROM audit_event
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action'))
  AND (sqlc.narg('actor_type')::text IS NULL OR actor_type = sqlc.narg('actor_type'))
  AND (sqlc.narg('actor_id')::uuid IS NULL OR actor_id = sqlc.narg('actor_id'))
  AND (sqlc.narg('target_type')::text IS NULL OR target_type = sqlc.narg('target_type'));
