package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/multica-ai/multica/server/internal/events"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type diagnoseDecisionAPI interface {
	DiagnoseDecision(http.ResponseWriter, *http.Request)
}

type runScenarioAPI interface {
	RunScenario(http.ResponseWriter, *http.Request)
}

type listScenariosAPI interface {
	ListScenarios(http.ResponseWriter, *http.Request)
}

type scenarioOptionResponse struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	IsRecommended bool   `json:"is_recommended"`
	SortOrder     int32  `json:"sort_order"`
}

type scenarioRunResponse struct {
	ID      string                   `json:"id"`
	Status  string                   `json:"status"`
	Options []scenarioOptionResponse `json:"options"`
}

func TestDiagnoseDecisionCreatesSnapshotAndPublishesEvent(t *testing.T) {
	ensureScenarioTestFixture(t)

	created := createScenarioDecisionForTest(t, map[string]any{
		"title":          "Decision diagnose case",
		"priority":       "high",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-DIAGNOSE-1",
		"objective":      "Protect service level",
		"constraints":    "Do not exceed transfer budget",
		"risk_level":     "high",
		"execution_mode": "manual",
	})

	api, ok := any(scenarioHandler).(diagnoseDecisionAPI)
	if !ok {
		t.Fatalf("Handler is missing DiagnoseDecision")
	}

	var published []events.Event
	scenarioHandler.Bus.Subscribe("decision:updated", func(e events.Event) {
		published = append(published, e)
	})

	w := httptest.NewRecorder()
	req := scenarioNewRequest("POST", "/api/decisions/"+created.ID+"/diagnose", nil)
	req = withScenarioURLParam(req, "id", created.ID)
	api.DiagnoseDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("DiagnoseDecision: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var snapshot DecisionSnapshotSummary
	if err := json.NewDecoder(w.Body).Decode(&snapshot); err != nil {
		t.Fatalf("DiagnoseDecision: decode response: %v", err)
	}
	if snapshot.ID == "" {
		t.Fatalf("DiagnoseDecision: expected snapshot id")
	}
	if snapshot.Source != "diagnose" {
		t.Fatalf("DiagnoseDecision: expected source %q, got %q", "diagnose", snapshot.Source)
	}

	decision, err := scenarioHandler.Queries.GetDecisionCaseInWorkspace(t.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     parseUUID(created.ID),
		WorkspaceID: parseUUID(scenarioWorkspaceID),
	})
	if err != nil {
		t.Fatalf("DiagnoseDecision: load decision: %v", err)
	}
	if decision.Phase != "diagnosing" {
		t.Fatalf("DiagnoseDecision: expected phase %q, got %q", "diagnosing", decision.Phase)
	}

	snapshots, err := scenarioHandler.Queries.ListDecisionContextSnapshots(t.Context(), db.ListDecisionContextSnapshotsParams{
		WorkspaceID:    parseUUID(scenarioWorkspaceID),
		DecisionCaseID: parseUUID(created.ID),
		OffsetCount:    0,
		LimitCount:     10,
	})
	if err != nil {
		t.Fatalf("DiagnoseDecision: list snapshots: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("DiagnoseDecision: expected 1 snapshot, got %d", len(snapshots))
	}

	if len(published) != 1 {
		t.Fatalf("DiagnoseDecision: expected 1 published event, got %d", len(published))
	}
	if published[0].WorkspaceID != scenarioWorkspaceID {
		t.Fatalf("DiagnoseDecision: expected workspace event %q, got %q", scenarioWorkspaceID, published[0].WorkspaceID)
	}
}

func TestRunScenarioCreatesQueuedRunWithPlaceholderOptions(t *testing.T) {
	ensureScenarioTestFixture(t)

	created := createScenarioDecisionForTest(t, map[string]any{
		"title":          "Decision scenario run case",
		"priority":       "medium",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-SCENARIO-1",
		"objective":      "Protect margin and service level",
		"constraints":    "No extra warehouse capacity",
		"risk_level":     "medium",
		"execution_mode": "manual",
	})

	_, err := scenarioHandler.Queries.CreateDecisionContextSnapshot(t.Context(), db.CreateDecisionContextSnapshotParams{
		DecisionCaseID: parseUUID(created.ID),
		WorkspaceID:    parseUUID(scenarioWorkspaceID),
		Source:         "diagnose",
		SourceRef:      created.ID,
		Metrics:        []byte(`{"coverage_days":3.1}`),
	})
	if err != nil {
		t.Fatalf("RunScenario setup: create snapshot: %v", err)
	}

	api, ok := any(scenarioHandler).(runScenarioAPI)
	if !ok {
		t.Fatalf("Handler is missing RunScenario")
	}

	var published []events.Event
	scenarioHandler.Bus.Subscribe("scenario:created", func(e events.Event) {
		published = append(published, e)
	})

	w := httptest.NewRecorder()
	req := scenarioNewRequest("POST", "/api/decisions/"+created.ID+"/scenarios/run", nil)
	req = withScenarioURLParam(req, "id", created.ID)
	api.RunScenario(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("RunScenario: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var run scenarioRunResponse
	if err := json.NewDecoder(w.Body).Decode(&run); err != nil {
		t.Fatalf("RunScenario: decode response: %v", err)
	}
	if run.ID == "" {
		t.Fatalf("RunScenario: expected scenario run id")
	}
	if run.Status != "queued" {
		t.Fatalf("RunScenario: expected status %q, got %q", "queued", run.Status)
	}
	if len(run.Options) != 3 {
		t.Fatalf("RunScenario: expected 3 options, got %d", len(run.Options))
	}
	if run.Options[0].Title != "conservative" || run.Options[1].Title != "moderate" || run.Options[2].Title != "aggressive" {
		t.Fatalf("RunScenario: expected placeholder options in order, got %+v", run.Options)
	}
	if !run.Options[1].IsRecommended {
		t.Fatalf("RunScenario: expected moderate option to be recommended")
	}

	decision, err := scenarioHandler.Queries.GetDecisionCaseInWorkspace(t.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     parseUUID(created.ID),
		WorkspaceID: parseUUID(scenarioWorkspaceID),
	})
	if err != nil {
		t.Fatalf("RunScenario: load decision: %v", err)
	}
	if decision.Phase != "simulating" {
		t.Fatalf("RunScenario: expected phase %q, got %q", "simulating", decision.Phase)
	}

	runs, err := scenarioHandler.Queries.ListScenarioRuns(t.Context(), db.ListScenarioRunsParams{
		WorkspaceID:    parseUUID(scenarioWorkspaceID),
		DecisionCaseID: parseUUID(created.ID),
		OffsetCount:    0,
		LimitCount:     10,
	})
	if err != nil {
		t.Fatalf("RunScenario: list scenario runs: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("RunScenario: expected 1 scenario run, got %d", len(runs))
	}

	options, err := scenarioHandler.Queries.ListScenarioOptions(t.Context(), runs[0].ID)
	if err != nil {
		t.Fatalf("RunScenario: list scenario options: %v", err)
	}
	if len(options) != 3 {
		t.Fatalf("RunScenario: expected 3 persisted options, got %d", len(options))
	}

	if len(published) != 1 {
		t.Fatalf("RunScenario: expected 1 published event, got %d", len(published))
	}
	if published[0].WorkspaceID != scenarioWorkspaceID {
		t.Fatalf("RunScenario: expected workspace event %q, got %q", scenarioWorkspaceID, published[0].WorkspaceID)
	}
}

func TestListScenariosReturnsRunsWithOptions(t *testing.T) {
	ensureScenarioTestFixture(t)

	created := createScenarioDecisionForTest(t, map[string]any{
		"title":          "Decision scenario list case",
		"priority":       "low",
		"domain":         "finance",
		"decision_type":  "budget_hold",
		"object_type":    "vendor",
		"object_id":      "VENDOR-SCENARIO-1",
		"objective":      "Reduce spend variance",
		"constraints":    "Keep supply continuity",
		"risk_level":     "medium",
		"execution_mode": "manual",
	})

	_, err := scenarioHandler.Queries.CreateDecisionContextSnapshot(t.Context(), db.CreateDecisionContextSnapshotParams{
		DecisionCaseID: parseUUID(created.ID),
		WorkspaceID:    parseUUID(scenarioWorkspaceID),
		Source:         "diagnose",
		SourceRef:      created.ID,
		Metrics:        []byte(`{"variance":12}`),
	})
	if err != nil {
		t.Fatalf("ListScenarios setup: create snapshot: %v", err)
	}

	runAPI, ok := any(scenarioHandler).(runScenarioAPI)
	if !ok {
		t.Fatalf("Handler is missing RunScenario")
	}
	listAPI, ok := any(scenarioHandler).(listScenariosAPI)
	if !ok {
		t.Fatalf("Handler is missing ListScenarios")
	}

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := scenarioNewRequest("POST", "/api/decisions/"+created.ID+"/scenarios/run", nil)
		req = withScenarioURLParam(req, "id", created.ID)
		runAPI.RunScenario(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("ListScenarios setup run %d: expected 200, got %d: %s", i+1, w.Code, w.Body.String())
		}
	}

	w := httptest.NewRecorder()
	req := scenarioNewRequest("GET", "/api/decisions/"+created.ID+"/scenarios", nil)
	req = withScenarioURLParam(req, "id", created.ID)
	listAPI.ListScenarios(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListScenarios: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var runs []scenarioRunResponse
	if err := json.NewDecoder(w.Body).Decode(&runs); err != nil {
		t.Fatalf("ListScenarios: decode response: %v", err)
	}
	if len(runs) != 2 {
		t.Fatalf("ListScenarios: expected 2 scenario runs, got %d", len(runs))
	}
	for _, run := range runs {
		if run.Status != "queued" {
			t.Fatalf("ListScenarios: expected queued status, got %q", run.Status)
		}
		if len(run.Options) != 3 {
			t.Fatalf("ListScenarios: expected 3 options for run %q, got %d", run.ID, len(run.Options))
		}
	}
}
