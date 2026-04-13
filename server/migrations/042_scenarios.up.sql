-- Stores simulation runs for a decision case.
CREATE TABLE IF NOT EXISTS scenario_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_case_id UUID NOT NULL REFERENCES decision_case(issue_id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES decision_context_snapshot(id) ON DELETE SET NULL,

    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    runtime_id UUID,
    config JSONB NOT NULL DEFAULT '{}',
    result_summary TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores candidate options produced by a scenario run.
CREATE TABLE IF NOT EXISTS scenario_option (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_run_id UUID NOT NULL REFERENCES scenario_run(id) ON DELETE CASCADE,

    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    metrics JSONB NOT NULL DEFAULT '{}',
    risk_assessment TEXT NOT NULL DEFAULT '',
    feasibility_score NUMERIC(5,2) DEFAULT 0,
    is_recommended BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_run_decision ON scenario_run(decision_case_id);
CREATE INDEX IF NOT EXISTS idx_scenario_run_workspace ON scenario_run(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scenario_run_status ON scenario_run(status);
CREATE INDEX IF NOT EXISTS idx_scenario_option_run ON scenario_option(scenario_run_id);
