package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func createDecisionForTest(t *testing.T, body map[string]any) DecisionResponse {
	t.Helper()

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/decisions", body)
	testHandler.CreateDecision(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateDecision: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created DecisionResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("CreateDecision: decode response: %v", err)
	}
	return created
}

func TestDecisionCRUD(t *testing.T) {
	created := createDecisionForTest(t, map[string]any{
		"title":          "Decision test case",
		"description":    "Check aggregated decision CRUD flow",
		"priority":       "high",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-DECISION-CRUD",
		"objective":      "Keep service level above 98%",
		"constraints":    "Do not exceed transfer budget",
		"risk_level":     "high",
		"execution_mode": "manual",
	})

	if created.Title != "Decision test case" {
		t.Fatalf("CreateDecision: expected title %q, got %q", "Decision test case", created.Title)
	}
	if created.Status != "todo" {
		t.Fatalf("CreateDecision: expected status %q, got %q", "todo", created.Status)
	}
	if created.Phase != "identified" {
		t.Fatalf("CreateDecision: expected phase %q, got %q", "identified", created.Phase)
	}
	if created.ApprovalStatus != "draft" {
		t.Fatalf("CreateDecision: expected approval_status %q, got %q", "draft", created.ApprovalStatus)
	}

	_, err := testHandler.Queries.CreateDecisionContextSnapshot(t.Context(), db.CreateDecisionContextSnapshotParams{
		DecisionCaseID: parseUUID(created.ID),
		WorkspaceID:    parseUUID(testWorkspaceID),
		Source:         "tower",
		SourceRef:      "alert-1",
		Metrics:        []byte(`{"coverage_days":2.3}`),
	})
	if err != nil {
		t.Fatalf("CreateDecisionContextSnapshot: %v", err)
	}

	_, err = testHandler.Queries.CreateDecisionRecommendation(t.Context(), db.CreateDecisionRecommendationParams{
		DecisionCaseID: parseUUID(created.ID),
		WorkspaceID:    parseUUID(testWorkspaceID),
		Title:          "Transfer inventory from north to east",
		ExpectedImpact: "Avoid stockout this week",
	})
	if err != nil {
		t.Fatalf("CreateDecisionRecommendation: %v", err)
	}

	_, err = testHandler.Queries.CreateDecisionApproval(t.Context(), db.CreateDecisionApprovalParams{
		DecisionCaseID: parseUUID(created.ID),
		WorkspaceID:    parseUUID(testWorkspaceID),
		ApproverType:   "member",
		ApproverID:     parseUUID(testUserID),
		Status:         "pending",
		Comment:        "Waiting for review",
		SortOrder:      1,
	})
	if err != nil {
		t.Fatalf("CreateDecisionApproval: %v", err)
	}

	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/decisions/"+created.ID, nil)
	req = withURLParam(req, "id", created.ID)
	testHandler.GetDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetDecision: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var detail DecisionDetailResponse
	if err := json.NewDecoder(w.Body).Decode(&detail); err != nil {
		t.Fatalf("GetDecision: decode response: %v", err)
	}
	if detail.ID != created.ID {
		t.Fatalf("GetDecision: expected id %q, got %q", created.ID, detail.ID)
	}
	if detail.LatestSnapshot == nil || detail.LatestSnapshot.Source != "tower" {
		t.Fatalf("GetDecision: expected latest snapshot source %q", "tower")
	}
	if detail.LatestRecommendation == nil || detail.LatestRecommendation.Title != "Transfer inventory from north to east" {
		t.Fatalf("GetDecision: expected latest recommendation title %q", "Transfer inventory from north to east")
	}
	if detail.LatestApproval == nil || detail.LatestApproval.Status != "pending" {
		t.Fatalf("GetDecision: expected latest approval status %q", "pending")
	}

	w = httptest.NewRecorder()
	req = newRequest("PATCH", "/api/decisions/"+created.ID, map[string]any{
		"phase":            "approved",
		"approval_status":  "approved",
		"execution_status": "running",
		"objective":        "Keep service level above 99%",
	})
	req = withURLParam(req, "id", created.ID)
	testHandler.UpdateDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateDecision: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var updated DecisionResponse
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("UpdateDecision: decode response: %v", err)
	}
	if updated.Phase != "approved" {
		t.Fatalf("UpdateDecision: expected phase %q, got %q", "approved", updated.Phase)
	}
	if updated.ApprovalStatus != "approved" {
		t.Fatalf("UpdateDecision: expected approval_status %q, got %q", "approved", updated.ApprovalStatus)
	}
	if updated.ExecutionStatus != "running" {
		t.Fatalf("UpdateDecision: expected execution_status %q, got %q", "running", updated.ExecutionStatus)
	}
	if updated.Title != created.Title {
		t.Fatalf("UpdateDecision: expected title to remain %q, got %q", created.Title, updated.Title)
	}
}

func TestListDecisionsPaginationAndFilters(t *testing.T) {
	first := createDecisionForTest(t, map[string]any{
		"title":          "Decision list first",
		"priority":       "medium",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-LIST-1",
		"objective":      "Move stock before weekend",
		"constraints":    "Keep transfer cost low",
		"risk_level":     "medium",
		"execution_mode": "manual",
	})
	second := createDecisionForTest(t, map[string]any{
		"title":          "Decision list second",
		"priority":       "low",
		"domain":         "finance",
		"decision_type":  "budget_hold",
		"object_type":    "vendor",
		"object_id":      "VENDOR-LIST-2",
		"objective":      "Reduce spend variance",
		"constraints":    "Preserve supply continuity",
		"risk_level":     "critical",
		"execution_mode": "auto",
	})

	w := httptest.NewRecorder()
	req := newRequest("PATCH", "/api/decisions/"+second.ID, map[string]any{
		"phase": "approved",
	})
	req = withURLParam(req, "id", second.ID)
	testHandler.UpdateDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateDecision phase: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/decisions?page=1&page_size=1", nil)
	testHandler.ListDecisions(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListDecisions: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var paged struct {
		Decisions []DecisionResponse `json:"decisions"`
		Total     int64              `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&paged); err != nil {
		t.Fatalf("ListDecisions: decode response: %v", err)
	}
	if len(paged.Decisions) != 1 {
		t.Fatalf("ListDecisions: expected 1 decision on first page, got %d", len(paged.Decisions))
	}
	if paged.Total < 2 {
		t.Fatalf("ListDecisions: expected total >= 2, got %d", paged.Total)
	}

	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/decisions?phase=approved&page=1&page_size=10", nil)
	testHandler.ListDecisions(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListDecisions phase filter: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var filtered struct {
		Decisions []DecisionResponse `json:"decisions"`
		Total     int64              `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&filtered); err != nil {
		t.Fatalf("ListDecisions phase filter: decode response: %v", err)
	}
	if filtered.Total < 1 {
		t.Fatalf("ListDecisions phase filter: expected total >= 1, got %d", filtered.Total)
	}

	foundApproved := false
	for _, decision := range filtered.Decisions {
		if decision.ID == second.ID {
			foundApproved = true
			if decision.Phase != "approved" {
				t.Fatalf("ListDecisions phase filter: expected phase %q, got %q", "approved", decision.Phase)
			}
		}
		if decision.ID == first.ID {
			t.Fatalf("ListDecisions phase filter: unexpected decision %q in approved results", first.ID)
		}
	}
	if !foundApproved {
		t.Fatalf("ListDecisions phase filter: expected to find decision %q", second.ID)
	}

	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/decisions?risk=critical&execution_mode=auto&page=1&page_size=10", nil)
	testHandler.ListDecisions(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListDecisions risk/mode filter: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if totalHeader := w.Header().Get("X-Total-Count"); totalHeader != "" {
		totalValue, err := strconv.ParseInt(totalHeader, 10, 64)
		if err != nil {
			t.Fatalf("ListDecisions risk/mode filter: invalid X-Total-Count header %q", totalHeader)
		}
		if totalValue < 1 {
			t.Fatalf("ListDecisions risk/mode filter: expected X-Total-Count >= 1, got %d", totalValue)
		}
	}
}
