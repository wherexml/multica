-- name: GetRuntimeExecutorByRuntime :one
SELECT * FROM runtime_executor
WHERE runtime_id = sqlc.arg('runtime_id');

-- name: UpsertRuntimeExecutor :one
INSERT INTO runtime_executor (
    runtime_id,
    executor_kind,
    network_zone,
    credential_scope,
    resource_quota,
    allowed_actions,
    approval_required
) VALUES (
    sqlc.arg('runtime_id'),
    COALESCE(sqlc.narg('executor_kind'), 'llm_agent'),
    COALESCE(sqlc.narg('network_zone'), 'default'),
    COALESCE(sqlc.narg('credential_scope'), ''),
    COALESCE(sqlc.narg('resource_quota'), '{}'),
    COALESCE(sqlc.narg('allowed_actions'), '[]'),
    COALESCE(sqlc.narg('approval_required'), false)
)
ON CONFLICT (runtime_id)
DO UPDATE SET
    executor_kind = COALESCE(sqlc.narg('executor_kind'), runtime_executor.executor_kind),
    network_zone = COALESCE(sqlc.narg('network_zone'), runtime_executor.network_zone),
    credential_scope = COALESCE(sqlc.narg('credential_scope'), runtime_executor.credential_scope),
    resource_quota = COALESCE(sqlc.narg('resource_quota'), runtime_executor.resource_quota),
    allowed_actions = COALESCE(sqlc.narg('allowed_actions'), runtime_executor.allowed_actions),
    approval_required = COALESCE(sqlc.narg('approval_required'), runtime_executor.approval_required),
    updated_at = now()
RETURNING *;

-- name: ListRuntimeExecutors :many
SELECT re.*
FROM runtime_executor re
JOIN agent_runtime ar ON ar.id = re.runtime_id
WHERE ar.workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('executor_kind')::text IS NULL OR re.executor_kind = sqlc.narg('executor_kind'))
ORDER BY ar.created_at ASC;
