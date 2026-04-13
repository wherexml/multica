-- name: CreateScenarioRun :one
INSERT INTO scenario_run (
    decision_case_id,
    workspace_id,
    snapshot_id,
    status,
    runtime_id,
    config,
    result_summary,
    error_message,
    started_at,
    completed_at
) VALUES (
    sqlc.arg('decision_case_id'),
    sqlc.arg('workspace_id'),
    sqlc.narg('snapshot_id'),
    COALESCE(sqlc.narg('status'), 'queued'),
    sqlc.narg('runtime_id'),
    COALESCE(sqlc.narg('config'), '{}'::jsonb),
    COALESCE(sqlc.narg('result_summary'), ''),
    COALESCE(sqlc.narg('error_message'), ''),
    sqlc.narg('started_at'),
    sqlc.narg('completed_at')
) RETURNING *;

-- name: GetScenarioRun :one
SELECT * FROM scenario_run
WHERE id = sqlc.arg('id');

-- name: GetScenarioRunInWorkspace :one
SELECT * FROM scenario_run
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: ListScenarioRuns :many
SELECT * FROM scenario_run
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: UpdateScenarioRun :one
UPDATE scenario_run
SET snapshot_id = COALESCE(sqlc.narg('snapshot_id'), snapshot_id),
    status = COALESCE(sqlc.narg('status'), status),
    runtime_id = COALESCE(sqlc.narg('runtime_id'), runtime_id),
    config = COALESCE(sqlc.narg('config'), config),
    result_summary = COALESCE(sqlc.narg('result_summary'), result_summary),
    error_message = COALESCE(sqlc.narg('error_message'), error_message),
    started_at = COALESCE(sqlc.narg('started_at'), started_at),
    completed_at = COALESCE(sqlc.narg('completed_at'), completed_at),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteScenarioRun :exec
DELETE FROM scenario_run
WHERE id = sqlc.arg('id');

-- name: CreateScenarioOption :one
INSERT INTO scenario_option (
    scenario_run_id,
    title,
    description,
    metrics,
    risk_assessment,
    feasibility_score,
    is_recommended,
    sort_order
) VALUES (
    sqlc.arg('scenario_run_id'),
    COALESCE(sqlc.narg('title'), ''),
    COALESCE(sqlc.narg('description'), ''),
    COALESCE(sqlc.narg('metrics'), '{}'::jsonb),
    COALESCE(sqlc.narg('risk_assessment'), ''),
    COALESCE(sqlc.narg('feasibility_score'), 0::numeric),
    COALESCE(sqlc.narg('is_recommended'), false),
    COALESCE(sqlc.narg('sort_order'), 0)
) RETURNING *;

-- name: GetScenarioOption :one
SELECT * FROM scenario_option
WHERE id = sqlc.arg('id');

-- name: ListScenarioOptions :many
SELECT * FROM scenario_option
WHERE scenario_run_id = sqlc.arg('scenario_run_id')
ORDER BY sort_order ASC, created_at ASC;

-- name: UpdateScenarioOption :one
UPDATE scenario_option
SET title = COALESCE(sqlc.narg('title'), title),
    description = COALESCE(sqlc.narg('description'), description),
    metrics = COALESCE(sqlc.narg('metrics'), metrics),
    risk_assessment = COALESCE(sqlc.narg('risk_assessment'), risk_assessment),
    feasibility_score = COALESCE(sqlc.narg('feasibility_score'), feasibility_score),
    is_recommended = COALESCE(sqlc.narg('is_recommended'), is_recommended),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteScenarioOption :exec
DELETE FROM scenario_option
WHERE id = sqlc.arg('id');
