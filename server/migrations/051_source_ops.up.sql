CREATE TABLE IF NOT EXISTS source_secret (
    source_id UUID PRIMARY KEY REFERENCES source(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    auth_type TEXT NOT NULL DEFAULT 'none'
        CHECK (auth_type IN ('none', 'bearer', 'oauth')),
    secret_ciphertext BYTEA NOT NULL,
    secret_nonce BYTEA NOT NULL,
    secret_preview TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_secret_workspace ON source_secret(workspace_id);

CREATE TABLE IF NOT EXISTS source_tool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    safety TEXT NOT NULL DEFAULT 'unknown'
        CHECK (safety IN ('read_only', 'write', 'unknown')),
    input_schema JSONB NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(input_schema) = 'object'),
    annotations JSONB NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(annotations) = 'object'),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_id, name)
);

CREATE INDEX IF NOT EXISTS idx_source_tool_source ON source_tool(source_id);
CREATE INDEX IF NOT EXISTS idx_source_tool_workspace ON source_tool(workspace_id);

CREATE TABLE IF NOT EXISTS source_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    runtime_id UUID NOT NULL REFERENCES agent_runtime(id) ON DELETE CASCADE,
    run_type TEXT NOT NULL
        CHECK (run_type IN ('test', 'discover_tools', 'call_tool')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'blocked')),
    tool_name TEXT NOT NULL DEFAULT '',
    request_payload JSONB NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(request_payload) = 'object'),
    result_payload JSONB NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(result_payload) = 'object'),
    summary TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_run_source ON source_run(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_run_runtime_status ON source_run(runtime_id, status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_source_run_workspace ON source_run(workspace_id, created_at DESC);
