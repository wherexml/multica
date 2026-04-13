-- Stores external system connectors for a workspace.
CREATE TABLE IF NOT EXISTS connector (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'erp' CHECK (kind IN ('erp', 'oms', 'wms', 'dwh', 'bi', 'other')),
    base_url TEXT NOT NULL DEFAULT '',
    capability TEXT NOT NULL DEFAULT 'read' CHECK (capability IN ('read', 'write', 'webhook', 'read_write')),
    config JSONB NOT NULL DEFAULT '{}',
    allowed_actions TEXT[] NOT NULL DEFAULT '{}',
    health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'down')),
    last_health_check TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_workspace ON connector(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connector_kind ON connector(kind);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'action_run_connector_id_fkey'
    ) THEN
        ALTER TABLE action_run
        ADD CONSTRAINT action_run_connector_id_fkey
        FOREIGN KEY (connector_id) REFERENCES connector(id) ON DELETE SET NULL;
    END IF;
END $$;
