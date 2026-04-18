-- name: GetSourceSecret :one
SELECT * FROM source_secret
WHERE source_id = sqlc.arg('source_id');

-- name: UpsertSourceSecret :one
INSERT INTO source_secret (
    source_id,
    workspace_id,
    auth_type,
    secret_ciphertext,
    secret_nonce,
    secret_preview
) VALUES (
    sqlc.arg('source_id'),
    sqlc.arg('workspace_id'),
    sqlc.arg('auth_type'),
    sqlc.arg('secret_ciphertext'),
    sqlc.arg('secret_nonce'),
    COALESCE(sqlc.narg('secret_preview'), '')
)
ON CONFLICT (source_id)
DO UPDATE SET
    workspace_id = EXCLUDED.workspace_id,
    auth_type = EXCLUDED.auth_type,
    secret_ciphertext = EXCLUDED.secret_ciphertext,
    secret_nonce = EXCLUDED.secret_nonce,
    secret_preview = EXCLUDED.secret_preview,
    updated_at = now()
RETURNING *;

-- name: DeleteSourceSecret :exec
DELETE FROM source_secret
WHERE source_id = sqlc.arg('source_id');
