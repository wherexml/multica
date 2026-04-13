-- name: CreateDecisionRecommendation :one
INSERT INTO decision_recommendation (
    decision_case_id,
    workspace_id,
    scenario_option_id,
    title,
    rationale,
    expected_impact,
    confidence_score,
    model_version,
    skill_version
) VALUES (
    sqlc.arg('decision_case_id'),
    sqlc.arg('workspace_id'),
    sqlc.narg('scenario_option_id'),
    COALESCE(sqlc.narg('title'), ''),
    COALESCE(sqlc.narg('rationale'), ''),
    COALESCE(sqlc.narg('expected_impact'), ''),
    COALESCE(sqlc.narg('confidence_score'), 0::numeric),
    COALESCE(sqlc.narg('model_version'), ''),
    COALESCE(sqlc.narg('skill_version'), '')
) RETURNING *;

-- name: GetDecisionRecommendation :one
SELECT * FROM decision_recommendation
WHERE id = sqlc.arg('id');

-- name: GetDecisionRecommendationInWorkspace :one
SELECT * FROM decision_recommendation
WHERE id = sqlc.arg('id')
  AND workspace_id = sqlc.arg('workspace_id');

-- name: ListDecisionRecommendations :many
SELECT * FROM decision_recommendation
WHERE workspace_id = sqlc.arg('workspace_id')
  AND (sqlc.narg('decision_case_id')::uuid IS NULL OR decision_case_id = sqlc.narg('decision_case_id'))
  AND (sqlc.narg('scenario_option_id')::uuid IS NULL OR scenario_option_id = sqlc.narg('scenario_option_id'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: UpdateDecisionRecommendation :one
UPDATE decision_recommendation
SET scenario_option_id = COALESCE(sqlc.narg('scenario_option_id'), scenario_option_id),
    title = COALESCE(sqlc.narg('title'), title),
    rationale = COALESCE(sqlc.narg('rationale'), rationale),
    expected_impact = COALESCE(sqlc.narg('expected_impact'), expected_impact),
    confidence_score = COALESCE(sqlc.narg('confidence_score'), confidence_score),
    model_version = COALESCE(sqlc.narg('model_version'), model_version),
    skill_version = COALESCE(sqlc.narg('skill_version'), skill_version)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDecisionRecommendation :exec
DELETE FROM decision_recommendation
WHERE id = sqlc.arg('id');
