package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type ScenarioOptionResponse struct {
	ID               string `json:"id"`
	ScenarioRunID    string `json:"scenario_run_id"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	Metrics          any    `json:"metrics"`
	RiskAssessment   string `json:"risk_assessment"`
	FeasibilityScore any    `json:"feasibility_score"`
	IsRecommended    bool   `json:"is_recommended"`
	SortOrder        int32  `json:"sort_order"`
	CreatedAt        string `json:"created_at"`
}

type ScenarioRunResponse struct {
	ID             string                   `json:"id"`
	DecisionCaseID string                   `json:"decision_case_id"`
	WorkspaceID    string                   `json:"workspace_id"`
	SnapshotID     *string                  `json:"snapshot_id"`
	RuntimeID      *string                  `json:"runtime_id"`
	Status         string                   `json:"status"`
	Config         any                      `json:"config"`
	ResultSummary  string                   `json:"result_summary"`
	ErrorMessage   string                   `json:"error_message"`
	StartedAt      *string                  `json:"started_at"`
	CompletedAt    *string                  `json:"completed_at"`
	CreatedAt      string                   `json:"created_at"`
	UpdatedAt      string                   `json:"updated_at"`
	Options        []ScenarioOptionResponse `json:"options"`
}

type scenarioOptionSeed struct {
	Title          string
	Description    string
	Metrics        map[string]any
	RiskAssessment string
	Score          any
	Recommended    bool
	SortOrder      int32
}

func scenarioOptionToResponse(option db.ScenarioOption) ScenarioOptionResponse {
	return ScenarioOptionResponse{
		ID:               uuidToString(option.ID),
		ScenarioRunID:    uuidToString(option.ScenarioRunID),
		Title:            option.Title,
		Description:      option.Description,
		Metrics:          jsonBytesToValue(option.Metrics, map[string]any{}),
		RiskAssessment:   option.RiskAssessment,
		FeasibilityScore: numericToValue(option.FeasibilityScore),
		IsRecommended:    option.IsRecommended,
		SortOrder:        option.SortOrder,
		CreatedAt:        timestampToString(option.CreatedAt),
	}
}

func scenarioRunToResponse(run db.ScenarioRun, options []db.ScenarioOption) ScenarioRunResponse {
	resp := ScenarioRunResponse{
		ID:             uuidToString(run.ID),
		DecisionCaseID: uuidToString(run.DecisionCaseID),
		WorkspaceID:    uuidToString(run.WorkspaceID),
		SnapshotID:     uuidToPtr(run.SnapshotID),
		RuntimeID:      uuidToPtr(run.RuntimeID),
		Status:         run.Status,
		Config:         jsonBytesToValue(run.Config, map[string]any{}),
		ResultSummary:  run.ResultSummary,
		ErrorMessage:   run.ErrorMessage,
		StartedAt:      timestampToPtr(run.StartedAt),
		CompletedAt:    timestampToPtr(run.CompletedAt),
		CreatedAt:      timestampToString(run.CreatedAt),
		UpdatedAt:      timestampToString(run.UpdatedAt),
		Options:        make([]ScenarioOptionResponse, len(options)),
	}

	for i, option := range options {
		resp.Options[i] = scenarioOptionToResponse(option)
	}

	return resp
}

func jsonBytesToValue(raw []byte, fallback any) any {
	if len(raw) == 0 {
		return fallback
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil || value == nil {
		return fallback
	}

	return value
}

func numericToValue(value pgtype.Numeric) any {
	if !value.Valid {
		return nil
	}

	raw, err := value.MarshalJSON()
	if err != nil {
		return nil
	}

	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return string(raw)
	}

	return decoded
}

func (h *Handler) getDecisionIssueAndCase(r *http.Request, decisionID, workspaceID string) (db.Issue, db.DecisionCase, bool) {
	issue, err := h.Queries.GetIssueInWorkspace(r.Context(), db.GetIssueInWorkspaceParams{
		ID:          parseUUID(decisionID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		return db.Issue{}, db.DecisionCase{}, false
	}

	decision, err := h.Queries.GetDecisionCaseInWorkspace(r.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     parseUUID(decisionID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		return db.Issue{}, db.DecisionCase{}, false
	}

	return issue, decision, true
}

func (h *Handler) DiagnoseDecision(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	issue, decision, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID)
	if !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to diagnose decision")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	updatedDecision, err := updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:   decision.IssueID,
		Phase:     strToText("diagnosing"),
		ProjectID: decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to diagnose decision")
		return
	}

	metrics, err := json.Marshal(map[string]any{
		"decision_id":     decisionID,
		"decision_type":   decision.DecisionType,
		"objective":       decision.Objective,
		"constraints":     decision.Constraints,
		"risk_level":      decision.RiskLevel,
		"execution_mode":  decision.ExecutionMode,
		"decision_phase":  updatedDecision.Phase,
		"issue_status":    issue.Status,
		"issue_priority":  issue.Priority,
		"captured_source": "diagnose",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to diagnose decision")
		return
	}

	snapshot, err := qtx.CreateDecisionContextSnapshot(r.Context(), db.CreateDecisionContextSnapshotParams{
		DecisionCaseID: decision.IssueID,
		WorkspaceID:    parseUUID(workspaceID),
		Source:         "diagnose",
		SourceRef:      decisionID,
		Metrics:        metrics,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to diagnose decision")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to diagnose decision")
		return
	}

	resp := decisionSnapshotToSummary(snapshot)
	oldState := decisionToResponse(issue, decision)
	newState := map[string]any{
		"decision": decisionToResponse(issue, updatedDecision),
		"snapshot": resp,
	}
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: decisionID,
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "decision.diagnosed",
		TargetType:     "decision",
		TargetID:       decisionID,
		OldState:       oldState,
		NewState:       newState,
		Metadata: map[string]any{
			"snapshot_id": uuidToString(snapshot.ID),
			"source":      snapshot.Source,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionUpdated, workspaceID, actorType, actorID, map[string]any{
		"decision": decisionToResponse(issue, updatedDecision),
		"snapshot": resp,
	})

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) RunScenario(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	issue, decision, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID)
	if !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to run scenario")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	updatedDecision, err := updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:   decision.IssueID,
		Phase:     strToText("simulating"),
		ProjectID: decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to run scenario")
		return
	}

	snapshots, err := qtx.ListDecisionContextSnapshots(r.Context(), db.ListDecisionContextSnapshotsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decision.IssueID,
		OffsetCount:    0,
		LimitCount:     1,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to run scenario")
		return
	}

	var snapshotID pgtype.UUID
	if len(snapshots) > 0 {
		snapshotID = snapshots[0].ID
	}

	config, err := json.Marshal(map[string]any{
		"source":      "api",
		"mode":        "placeholder",
		"decision_id": decisionID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to run scenario")
		return
	}

	run, err := qtx.CreateScenarioRun(r.Context(), db.CreateScenarioRunParams{
		DecisionCaseID: decision.IssueID,
		WorkspaceID:    parseUUID(workspaceID),
		SnapshotID:     snapshotID,
		Status:         "queued",
		Config:         config,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to run scenario")
		return
	}

	seeds := []scenarioOptionSeed{
		{
			Title:          "conservative",
			Description:    "Favor risk reduction and minimal operational disruption.",
			Metrics:        map[string]any{"impact": "low", "cost": "low", "speed": "slow"},
			RiskAssessment: "Lowest execution risk with the smallest upside.",
			Score:          90,
			Recommended:    false,
			SortOrder:      1,
		},
		{
			Title:          "moderate",
			Description:    "Balance cost, speed, and operational risk.",
			Metrics:        map[string]any{"impact": "medium", "cost": "medium", "speed": "medium"},
			RiskAssessment: "Balanced trade-off between upside and execution confidence.",
			Score:          75,
			Recommended:    true,
			SortOrder:      2,
		},
		{
			Title:          "aggressive",
			Description:    "Maximize upside and speed with higher operational exposure.",
			Metrics:        map[string]any{"impact": "high", "cost": "high", "speed": "fast"},
			RiskAssessment: "Highest upside with the greatest execution risk.",
			Score:          55,
			Recommended:    false,
			SortOrder:      3,
		},
	}

	options := make([]db.ScenarioOption, 0, len(seeds))
	for _, seed := range seeds {
		metrics, err := json.Marshal(seed.Metrics)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to run scenario")
			return
		}

		option, err := qtx.CreateScenarioOption(r.Context(), db.CreateScenarioOptionParams{
			ScenarioRunID:    run.ID,
			Title:            seed.Title,
			Description:      seed.Description,
			Metrics:          metrics,
			RiskAssessment:   seed.RiskAssessment,
			FeasibilityScore: seed.Score,
			IsRecommended:    seed.Recommended,
			SortOrder:        seed.SortOrder,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to run scenario")
			return
		}
		options = append(options, option)
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to run scenario")
		return
	}

	resp := scenarioRunToResponse(run, options)
	oldState := decisionToResponse(issue, decision)
	newState := map[string]any{
		"decision": decisionToResponse(issue, updatedDecision),
		"scenario": resp,
	}
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: decisionID,
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "scenario.created",
		TargetType:     "scenario",
		TargetID:       resp.ID,
		OldState:       oldState,
		NewState:       newState,
		Metadata: map[string]any{
			"option_count": len(resp.Options),
			"status":       resp.Status,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventScenarioCreated, workspaceID, actorType, actorID, map[string]any{
		"decision": decisionToResponse(issue, updatedDecision),
		"scenario": resp,
	})

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListScenarios(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	if _, _, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID); !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	runs, err := h.Queries.ListScenarioRuns(r.Context(), db.ListScenarioRunsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionID),
		OffsetCount:    0,
		LimitCount:     100,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list scenarios")
		return
	}

	resp := make([]ScenarioRunResponse, 0, len(runs))
	for _, run := range runs {
		options, err := h.Queries.ListScenarioOptions(r.Context(), run.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list scenarios")
			return
		}
		resp = append(resp, scenarioRunToResponse(run, options))
	}

	writeJSON(w, http.StatusOK, resp)
}
