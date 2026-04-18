-- Stores MCP/API/local sources bound to a runtime in a workspace.
CREATE TABLE IF NOT EXISTS source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    runtime_id UUID NOT NULL REFERENCES agent_runtime(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'mcp'
        CHECK (source_type IN ('mcp', 'api', 'local')),
    config JSONB NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(config) = 'object'),
    connection_status TEXT NOT NULL DEFAULT 'untested'
        CHECK (connection_status IN ('connected', 'needs_auth', 'failed', 'untested')),
    connection_error TEXT NOT NULL DEFAULT '',
    last_test_message TEXT NOT NULL DEFAULT '',
    last_tested_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_workspace ON source(workspace_id);
CREATE INDEX IF NOT EXISTS idx_source_runtime ON source(runtime_id);
CREATE INDEX IF NOT EXISTS idx_source_type ON source(source_type);
