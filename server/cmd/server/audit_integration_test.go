package main

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
)

type auditEventIntegrationResponse struct {
	ID             string `json:"id"`
	WorkspaceID    string `json:"workspace_id"`
	DecisionCaseID string `json:"decision_case_id"`
	Action         string `json:"action"`
	TargetType     string `json:"target_type"`
	TargetID       string `json:"target_id"`
}

type auditEventIntegrationList struct {
	Events []auditEventIntegrationResponse `json:"events"`
}

type auditStateEventRow struct {
	TargetType string
	TargetID   string
	OldState   map[string]any
	NewState   map[string]any
	IPAddress  string
	UserAgent  string
}

func loadAuditActionsForDecision(t *testing.T, decisionID string) []string {
	t.Helper()

	rows, err := testPool.Query(t.Context(), `
		SELECT action
		FROM audit_event
		WHERE workspace_id = $1
		  AND decision_case_id = $2
		ORDER BY created_at ASC, id ASC
	`, testWorkspaceID, decisionID)
	if err != nil {
		t.Fatalf("query audit actions: %v", err)
	}
	defer rows.Close()

	actions := make([]string, 0)
	for rows.Next() {
		var action string
		if err := rows.Scan(&action); err != nil {
			t.Fatalf("scan audit action: %v", err)
		}
		actions = append(actions, action)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate audit actions: %v", err)
	}

	return actions
}

func loadAuditEventByAction(t *testing.T, decisionID, action string) auditStateEventRow {
	t.Helper()

	var (
		row           auditStateEventRow
		oldStateBytes []byte
		newStateBytes []byte
	)

	err := testPool.QueryRow(t.Context(), `
		SELECT
			target_type,
			target_id::text,
			old_state,
			new_state,
			ip_address,
			user_agent
		FROM audit_event
		WHERE workspace_id = $1
		  AND decision_case_id = $2
		  AND action = $3
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`, testWorkspaceID, decisionID, action).Scan(
		&row.TargetType,
		&row.TargetID,
		&oldStateBytes,
		&newStateBytes,
		&row.IPAddress,
		&row.UserAgent,
	)
	if err != nil {
		t.Fatalf("query audit event %q: %v", action, err)
	}

	if err := json.Unmarshal(oldStateBytes, &row.OldState); err != nil {
		t.Fatalf("decode old_state for %q: %v", action, err)
	}
	if err := json.Unmarshal(newStateBytes, &row.NewState); err != nil {
		t.Fatalf("decode new_state for %q: %v", action, err)
	}

	return row
}

func TestAuditRoutesExposeDecisionAndWorkspaceTrail(t *testing.T) {
	createResp := authRequest(t, "POST", "/api/decisions", map[string]any{
		"title":          "Integration audit decision",
		"priority":       "medium",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-AUDIT-INTEGRATION-1",
		"objective":      "Protect service level",
		"constraints":    "Keep transfer cost low",
		"risk_level":     "medium",
		"execution_mode": "manual",
	})
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("CreateDecision: expected 201, got %d", createResp.StatusCode)
	}

	var created struct {
		ID string `json:"id"`
	}
	readJSON(t, createResp, &created)

	decisionTrailResp := authRequest(t, "GET", "/api/decisions/"+created.ID+"/audit-trail?page=1&page_size=10", nil)
	if decisionTrailResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/decisions/{id}/audit-trail: expected 200, got %d", decisionTrailResp.StatusCode)
	}

	var trail auditEventIntegrationList
	readJSON(t, decisionTrailResp, &trail)
	if len(trail.Events) == 0 {
		t.Fatalf("GET /api/decisions/{id}/audit-trail: expected at least 1 event")
	}

	workspaceResp := authRequest(t, "GET", "/api/audit/events?decision_case_id="+created.ID+"&page=1&page_size=10", nil)
	if workspaceResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/audit/events: expected 200, got %d", workspaceResp.StatusCode)
	}
	if workspaceResp.Header.Get("X-Total-Count") == "" {
		t.Fatalf("GET /api/audit/events: expected X-Total-Count header")
	}

	var workspaceEvents auditEventIntegrationList
	readJSON(t, workspaceResp, &workspaceEvents)
	if len(workspaceEvents.Events) == 0 {
		t.Fatalf("GET /api/audit/events: expected at least 1 event")
	}

	eventResp := authRequest(t, "GET", "/api/audit/events/"+workspaceEvents.Events[0].ID, nil)
	if eventResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/audit/events/{eventId}: expected 200, got %d", eventResp.StatusCode)
	}

	var event auditEventIntegrationResponse
	readJSON(t, eventResp, &event)
	if event.ID != workspaceEvents.Events[0].ID {
		t.Fatalf("GET /api/audit/events/{eventId}: expected id %q, got %q", workspaceEvents.Events[0].ID, event.ID)
	}
	if event.DecisionCaseID != created.ID {
		t.Fatalf("GET /api/audit/events/{eventId}: expected decision_case_id %q, got %q", created.ID, event.DecisionCaseID)
	}
}

func TestAuditRouteFilterByAction(t *testing.T) {
	createResp := authRequest(t, "POST", "/api/decisions", map[string]any{
		"title":          "Integration audit filter decision",
		"priority":       "high",
		"domain":         "finance",
		"decision_type":  "budget_hold",
		"object_type":    "vendor",
		"object_id":      "VENDOR-AUDIT-INTEGRATION-1",
		"objective":      "Reduce spend variance",
		"constraints":    "Keep supply continuity",
		"risk_level":     "high",
		"execution_mode": "manual",
	})
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("CreateDecision: expected 201, got %d", createResp.StatusCode)
	}

	var created struct {
		ID string `json:"id"`
	}
	readJSON(t, createResp, &created)

	updateResp := authRequest(t, "PATCH", "/api/decisions/"+created.ID, map[string]any{
		"risk_level": "critical",
	})
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("UpdateDecision: expected 200, got %d", updateResp.StatusCode)
	}
	updateResp.Body.Close()

	listResp := authRequest(t, "GET", "/api/audit/events?decision_case_id="+created.ID+"&action=decision.updated&page=1&page_size=10", nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/audit/events?action=decision.updated: expected 200, got %d", listResp.StatusCode)
	}

	var listed auditEventIntegrationList
	readJSON(t, listResp, &listed)
	if len(listed.Events) != 1 {
		payload, _ := json.Marshal(listed)
		t.Fatalf("GET /api/audit/events?action=decision.updated: expected 1 event, got %d (%s)", len(listed.Events), string(payload))
	}
	if listed.Events[0].Action != "decision.updated" {
		t.Fatalf("GET /api/audit/events?action=decision.updated: expected action %q, got %q", "decision.updated", listed.Events[0].Action)
	}
}

func TestAuditLifecycleRecordsImmutableTrail(t *testing.T) {
	createResp := authRequest(t, "POST", "/api/decisions", map[string]any{
		"title":          "Integration audit lifecycle decision",
		"priority":       "high",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-AUDIT-LIFECYCLE-2",
		"objective":      "Keep transfer plan within budget",
		"constraints":    "No extra headcount",
		"risk_level":     "high",
		"execution_mode": "manual",
	})
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("CreateDecision: expected 201, got %d", createResp.StatusCode)
	}

	var created struct {
		ID string `json:"id"`
	}
	readJSON(t, createResp, &created)

	updateReq := authRequest(t, "PATCH", "/api/decisions/"+created.ID, map[string]any{
		"objective": "Minimize late purchase orders",
	})
	if updateReq.StatusCode != http.StatusOK {
		t.Fatalf("UpdateDecision: expected 200, got %d", updateReq.StatusCode)
	}
	updateReq.Body.Close()

	diagnoseResp := authRequest(t, "POST", "/api/decisions/"+created.ID+"/diagnose", nil)
	if diagnoseResp.StatusCode != http.StatusOK {
		t.Fatalf("DiagnoseDecision: expected 200, got %d", diagnoseResp.StatusCode)
	}
	diagnoseResp.Body.Close()

	runResp := authRequest(t, "POST", "/api/decisions/"+created.ID+"/scenarios/run", nil)
	if runResp.StatusCode != http.StatusOK {
		t.Fatalf("RunScenario: expected 200, got %d", runResp.StatusCode)
	}
	runResp.Body.Close()

	recommendResp := authRequest(t, "POST", "/api/decisions/"+created.ID+"/recommend", map[string]any{
		"title":            "Shift inventory from north to east",
		"rationale":        "East warehouse demand is exceeding forecast",
		"expected_impact":  "Reduce stockout risk this week",
		"confidence_score": 0.82,
	})
	if recommendResp.StatusCode != http.StatusOK {
		t.Fatalf("RecommendDecision: expected 200, got %d", recommendResp.StatusCode)
	}
	recommendResp.Body.Close()

	submitResp := authRequest(t, "POST", "/api/decisions/"+created.ID+"/submit-approval", map[string]any{
		"approvers": []map[string]any{
			{"type": "member", "id": testUserID},
		},
	})
	if submitResp.StatusCode != http.StatusOK {
		t.Fatalf("SubmitForApproval: expected 200, got %d", submitResp.StatusCode)
	}

	var submitted struct {
		Approvals []struct {
			ID string `json:"id"`
		} `json:"approvals"`
	}
	readJSON(t, submitResp, &submitted)
	if len(submitted.Approvals) != 1 {
		t.Fatalf("SubmitForApproval: expected 1 approval, got %d", len(submitted.Approvals))
	}

	approveResp := authRequest(t, "POST", "/api/approvals/"+submitted.Approvals[0].ID+"/approve", map[string]any{
		"comment": "Proceed with the transfer plan",
	})
	if approveResp.StatusCode != http.StatusOK {
		t.Fatalf("ApproveDecision: expected 200, got %d", approveResp.StatusCode)
	}
	approveResp.Body.Close()

	executeResp := authRequest(t, "POST", "/api/decisions/"+created.ID+"/execute", map[string]any{
		"idempotency_key": "audit-lifecycle-action-key-integration",
		"action_type":     "inventory.transfer",
		"request_payload": map[string]any{
			"from": "north",
			"to":   "east",
			"sku":  "SKU-AUDIT-LIFECYCLE-2",
		},
	})
	if executeResp.StatusCode != http.StatusOK {
		t.Fatalf("ExecuteAction: expected 200, got %d", executeResp.StatusCode)
	}

	var executed struct {
		Action struct {
			ID string `json:"id"`
		} `json:"action"`
	}
	readJSON(t, executeResp, &executed)

	rollbackResp := authRequest(t, "POST", "/api/actions/"+executed.Action.ID+"/rollback", map[string]any{
		"rollback_payload": map[string]any{
			"reason": "operator requested rollback",
		},
	})
	if rollbackResp.StatusCode != http.StatusOK {
		t.Fatalf("RollbackAction: expected 200, got %d", rollbackResp.StatusCode)
	}
	rollbackResp.Body.Close()

	actions := loadAuditActionsForDecision(t, created.ID)
	expectedActions := []string{
		"decision.created",
		"decision.updated",
		"decision.diagnosed",
		"scenario.created",
		"decision.recommended",
		"approval.submitted",
		"approval.approved",
		"action.executed",
		"action.rolled_back",
	}
	if !reflect.DeepEqual(actions, expectedActions) {
		t.Fatalf("audit actions: expected %v, got %v", expectedActions, actions)
	}

	updatedEvent := loadAuditEventByAction(t, created.ID, "decision.updated")
	if updatedEvent.TargetType != "decision" {
		t.Fatalf("decision.updated target_type: expected %q, got %q", "decision", updatedEvent.TargetType)
	}
	if updatedEvent.TargetID != created.ID {
		t.Fatalf("decision.updated target_id: expected %q, got %q", created.ID, updatedEvent.TargetID)
	}
	if updatedEvent.OldState["objective"] != "Keep transfer plan within budget" {
		t.Fatalf("decision.updated old_state.objective: expected %q, got %#v", "Keep transfer plan within budget", updatedEvent.OldState["objective"])
	}
	if updatedEvent.NewState["objective"] != "Minimize late purchase orders" {
		t.Fatalf("decision.updated new_state.objective: expected %q, got %#v", "Minimize late purchase orders", updatedEvent.NewState["objective"])
	}
}
