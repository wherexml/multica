-- name: CreateDecisionCase :one
INSERT INTO decision_case (
    issue_id, workspace_id, project_id, domain, decision_type,
    object_type, object_id, objective, constraints,
    risk_level, execution_mode, phase, approval_status, execution_status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
) RETURNING *;

-- name: GetDecisionCase :one
SELECT * FROM decision_case WHERE issue_id = $1;

-- name: GetDecisionCaseInWorkspace :one
SELECT * FROM decision_case WHERE issue_id = $1 AND workspace_id = $2;

-- name: ListDecisionCases :many
SELECT * FROM decision_case
WHERE workspace_id = $1
AND ($2::text = '' OR phase = $2)
AND ($3::text = '' OR risk_level = $3)
AND ($4::text = '' OR execution_mode = $4)
AND ($5::text = '' OR decision_type = $5)
AND ($6::text = '' OR object_type = $6)
AND ($7::uuid IS NULL OR project_id = $7)
ORDER BY updated_at DESC
LIMIT $8 OFFSET $9;

-- name: UpdateDecisionCase :one
UPDATE decision_case SET
    domain = COALESCE($2, domain),
    decision_type = COALESCE($3, decision_type),
    object_type = COALESCE($4, object_type),
    object_id = COALESCE($5, object_id),
    objective = COALESCE($6, objective),
    constraints = COALESCE($7, constraints),
    risk_level = COALESCE($8, risk_level),
    execution_mode = COALESCE($9, execution_mode),
    phase = COALESCE($10, phase),
    approval_status = COALESCE($11, approval_status),
    execution_status = COALESCE($12, execution_status),
    project_id = COALESCE($13, project_id),
    updated_at = NOW()
WHERE issue_id = $1
RETURNING *;

-- name: DeleteDecisionCase :exec
DELETE FROM decision_case WHERE issue_id = $1;

-- name: CountDecisionCasesByPhase :many
SELECT phase, COUNT(*) as count FROM decision_case
WHERE workspace_id = $1
GROUP BY phase;

-- name: CountDecisionCasesByRisk :many
SELECT risk_level, COUNT(*) as count FROM decision_case
WHERE workspace_id = $1
GROUP BY risk_level;
