-- Stores source metric snapshots captured when a decision case is created.
CREATE TABLE IF NOT EXISTS decision_context_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_case_id UUID NOT NULL REFERENCES decision_case(issue_id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,

    -- Identifies the upstream system and record that produced this snapshot.
    source TEXT NOT NULL DEFAULT '',
    source_ref TEXT NOT NULL DEFAULT '',
    metrics JSONB NOT NULL DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_decision ON decision_context_snapshot(decision_case_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_workspace ON decision_context_snapshot(workspace_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_source ON decision_context_snapshot(source);
