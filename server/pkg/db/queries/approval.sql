-- name: CreateDecisionApproval :one
INSERT INTO decision_approval (
    decision_case_id,
    workspace_id,
    approver_type,
    approver_id,
    status,
    comment,
    sort_order
) VALUES (
    sqlc.arg('decision_case_id'),
    sqlc.arg('workspace_id'),
    COALESCE(sqlc.narg('approver_type'), 'user'),
    sqlc.arg('approver_id'),
    COALESCE(sqlc.narg('status'), 'pending'),
    COALESCE(sqlc.narg('comment'), ''),
    COALESCE(sqlc.narg('sort_order'), 0)
) RETURNING *;

-- name: GetDecisionApproval :one
SELECT * FROM decision_approval
WHERE id = sqlc.arg('id');

-- name: GetDecisionApprovalInWorkspace :one
SELECT * FROM decision_approval
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: ListDecisionApprovals :many
SELECT * FROM decision_approval
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('approver_type')::text IS NULL OR approver_type = sqlc.narg('approver_type'))
  AND (sqlc.narg('approver_id')::uuid IS NULL OR approver_id = sqlc.narg('approver_id'))
ORDER BY sort_order ASC, created_at ASC;

-- name: UpdateDecisionApproval :one
UPDATE decision_approval
SET approver_type = COALESCE(sqlc.narg('approver_type'), approver_type),
    approver_id = COALESCE(sqlc.narg('approver_id'), approver_id),
    status = COALESCE(sqlc.narg('status'), status),
    comment = COALESCE(sqlc.narg('comment'), comment),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDecisionApproval :exec
DELETE FROM decision_approval
WHERE id = sqlc.arg('id');
