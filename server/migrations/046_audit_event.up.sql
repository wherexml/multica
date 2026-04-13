CREATE TABLE IF NOT EXISTS audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    decision_case_id UUID NOT NULL REFERENCES decision_case(issue_id) ON DELETE CASCADE,

    -- Who performed the action.
    actor_type TEXT NOT NULL DEFAULT '',
    actor_id UUID NOT NULL,

    -- What action was performed.
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target_id UUID NOT NULL,

    -- What changed.
    old_state JSONB NOT NULL DEFAULT '{}',
    new_state JSONB NOT NULL DEFAULT '{}',

    -- Context.
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',

    -- Immutable: no UPDATE or DELETE allowed.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_event_workspace ON audit_event(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_decision ON audit_event(decision_case_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_action ON audit_event(action);
CREATE INDEX IF NOT EXISTS idx_audit_event_actor ON audit_event(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_created ON audit_event(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_workspace_decision ON audit_event(workspace_id, decision_case_id);

CREATE OR REPLACE FUNCTION enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'audit_event rows are immutable: UPDATE not allowed';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_event rows are immutable: DELETE not allowed';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_event_immutable
BEFORE UPDATE OR DELETE ON audit_event
FOR EACH ROW EXECUTE FUNCTION enforce_audit_immutability();
