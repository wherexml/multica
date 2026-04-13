-- Decision case sidecar: extends issue with supply chain decision semantics.
CREATE TABLE IF NOT EXISTS decision_case (
    issue_id UUID PRIMARY KEY REFERENCES issue(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id UUID REFERENCES project(id) ON DELETE SET NULL,

    -- Domain and classification fields.
    domain TEXT NOT NULL DEFAULT '',
    decision_type TEXT NOT NULL DEFAULT '',
    object_type TEXT NOT NULL DEFAULT '',
    object_id TEXT NOT NULL DEFAULT '',

    -- Objective and constraint fields.
    objective TEXT NOT NULL DEFAULT '',
    constraints TEXT NOT NULL DEFAULT '',

    -- Status fields.
    risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    execution_mode TEXT NOT NULL DEFAULT 'manual' CHECK (execution_mode IN ('manual', 'semi_auto', 'auto')),
    phase TEXT NOT NULL DEFAULT 'identified' CHECK (phase IN (
        'identified', 'diagnosing', 'simulating', 'recommending',
        'awaiting_approval', 'approved', 'executing', 'monitoring', 'closed'
    )),
    approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN (
        'draft', 'pending', 'approved', 'rejected', 'cancelled'
    )),
    execution_status TEXT NOT NULL DEFAULT 'pending' CHECK (execution_status IN (
        'pending', 'running', 'completed', 'failed', 'rolled_back'
    )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common decision case query patterns.
CREATE INDEX IF NOT EXISTS idx_decision_case_workspace ON decision_case(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_case_project ON decision_case(project_id);
CREATE INDEX IF NOT EXISTS idx_decision_case_phase ON decision_case(phase);
CREATE INDEX IF NOT EXISTS idx_decision_case_risk ON decision_case(risk_level);
CREATE INDEX IF NOT EXISTS idx_decision_case_decision_type ON decision_case(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_case_workspace_phase ON decision_case(workspace_id, phase);
CREATE INDEX IF NOT EXISTS idx_decision_case_workspace_risk ON decision_case(workspace_id, risk_level);
