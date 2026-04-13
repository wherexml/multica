-- Stores recommendations generated for a decision case.
CREATE TABLE IF NOT EXISTS decision_recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_case_id UUID NOT NULL REFERENCES decision_case(issue_id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    scenario_option_id UUID REFERENCES scenario_option(id) ON DELETE SET NULL,

    title TEXT NOT NULL DEFAULT '',
    rationale TEXT NOT NULL DEFAULT '',
    expected_impact TEXT NOT NULL DEFAULT '',
    confidence_score NUMERIC(5,2) DEFAULT 0,
    model_version TEXT NOT NULL DEFAULT '',
    skill_version TEXT NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores ordered approvals for a decision case.
CREATE TABLE IF NOT EXISTS decision_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_case_id UUID NOT NULL REFERENCES decision_case(issue_id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,

    approver_type TEXT NOT NULL DEFAULT 'user' CHECK (approver_type IN ('user', 'member', 'agent')),
    approver_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    comment TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores executable actions linked to a decision case.
CREATE TABLE IF NOT EXISTS action_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_case_id UUID NOT NULL REFERENCES decision_case(issue_id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,

    idempotency_key TEXT NOT NULL,
    connector_id UUID,
    action_type TEXT NOT NULL DEFAULT '',
    request_payload JSONB NOT NULL DEFAULT '{}',
    external_ref TEXT NOT NULL DEFAULT '',
    rollback_payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
    runtime_id UUID,
    error_message TEXT NOT NULL DEFAULT '',

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT idx_action_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_recommendation_decision ON decision_recommendation(decision_case_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_workspace ON decision_recommendation(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approval_decision ON decision_approval(decision_case_id);
CREATE INDEX IF NOT EXISTS idx_approval_workspace ON decision_approval(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON decision_approval(status);
CREATE INDEX IF NOT EXISTS idx_action_decision ON action_run(decision_case_id);
CREATE INDEX IF NOT EXISTS idx_action_workspace ON action_run(workspace_id);
CREATE INDEX IF NOT EXISTS idx_action_status ON action_run(status);
