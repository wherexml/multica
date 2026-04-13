CREATE TABLE runtime_executor (
    runtime_id UUID PRIMARY KEY REFERENCES agent_runtime(id) ON DELETE CASCADE,
    executor_kind TEXT NOT NULL DEFAULT 'llm_agent'
        CHECK (executor_kind IN ('llm_agent', 'sql_runner', 'python_worker', 'optimizer', 'connector_action')),
    network_zone TEXT NOT NULL DEFAULT 'default',
    credential_scope TEXT NOT NULL DEFAULT '',
    resource_quota TEXT NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(resource_quota::jsonb) = 'object'),
    allowed_actions TEXT NOT NULL DEFAULT '[]'
        CHECK (jsonb_typeof(allowed_actions::jsonb) = 'array'),
    approval_required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO runtime_executor (runtime_id)
SELECT id
FROM agent_runtime
ON CONFLICT (runtime_id) DO NOTHING;

CREATE INDEX idx_runtime_executor_kind ON runtime_executor(executor_kind);

CREATE OR REPLACE FUNCTION ensure_runtime_executor_defaults()
RETURNS trigger AS $$
BEGIN
    INSERT INTO runtime_executor (runtime_id)
    VALUES (NEW.id)
    ON CONFLICT (runtime_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_runtime_executor_defaults
AFTER INSERT ON agent_runtime
FOR EACH ROW
EXECUTE FUNCTION ensure_runtime_executor_defaults();
