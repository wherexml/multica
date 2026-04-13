package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func approveDecisionForActionTest(t *testing.T) DecisionResponse {
	t.Helper()

	decision := createDecisionReadyForRecommendation(t)
	approval := submitApprovalForTest(t, decision.ID)

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/approvals/"+approval.ID+"/approve", map[string]any{
		"comment": "Ready to execute",
	})
	req = withURLParam(req, "approvalId", approval.ID)
	testHandler.ApproveDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveDecision for action test: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var approved struct {
		Decision DecisionResponse `json:"decision"`
	}
	if err := json.NewDecoder(w.Body).Decode(&approved); err != nil {
		t.Fatalf("ApproveDecision for action test: decode response: %v", err)
	}
	if approved.Decision.Phase != "approved" {
		t.Fatalf("ApproveDecision for action test: expected phase %q, got %q", "approved", approved.Decision.Phase)
	}

	return approved.Decision
}

func TestActionWorkflow(t *testing.T) {
	decision := approveDecisionForActionTest(t)

	executeRecorder := httptest.NewRecorder()
	executeReq := newRequest("POST", "/api/decisions/"+decision.ID+"/execute", map[string]any{
		"idempotency_key": "action-workflow-key",
		"action_type":     "inventory.transfer",
		"request_payload": map[string]any{
			"from": "north",
			"to":   "east",
			"sku":  "SKU-ACTION-1",
		},
	})
	executeReq = withURLParam(executeReq, "id", decision.ID)
	testHandler.ExecuteAction(executeRecorder, executeReq)
	if executeRecorder.Code != http.StatusOK {
		t.Fatalf("ExecuteAction: expected 200, got %d: %s", executeRecorder.Code, executeRecorder.Body.String())
	}

	var executed struct {
		Action   ActionRunResponse `json:"action"`
		Decision DecisionResponse  `json:"decision"`
	}
	if err := json.NewDecoder(executeRecorder.Body).Decode(&executed); err != nil {
		t.Fatalf("ExecuteAction: decode response: %v", err)
	}
	if executed.Action.Status != "completed" {
		t.Fatalf("ExecuteAction: expected status %q, got %q", "completed", executed.Action.Status)
	}
	if executed.Action.CompletedAt == nil {
		t.Fatalf("ExecuteAction: expected completed_at to be set")
	}
	if executed.Decision.Phase != "executing" {
		t.Fatalf("ExecuteAction: expected phase %q, got %q", "executing", executed.Decision.Phase)
	}
	if executed.Decision.ExecutionStatus != "completed" {
		t.Fatalf("ExecuteAction: expected execution_status %q, got %q", "completed", executed.Decision.ExecutionStatus)
	}

	getRecorder := httptest.NewRecorder()
	getReq := newRequest("GET", "/api/actions/"+executed.Action.ID, nil)
	getReq = withURLParam(getReq, "actionId", executed.Action.ID)
	testHandler.GetAction(getRecorder, getReq)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("GetAction: expected 200, got %d: %s", getRecorder.Code, getRecorder.Body.String())
	}

	var fetched ActionRunResponse
	if err := json.NewDecoder(getRecorder.Body).Decode(&fetched); err != nil {
		t.Fatalf("GetAction: decode response: %v", err)
	}
	if fetched.ID != executed.Action.ID {
		t.Fatalf("GetAction: expected id %q, got %q", executed.Action.ID, fetched.ID)
	}

	listRecorder := httptest.NewRecorder()
	listReq := newRequest("GET", "/api/decisions/"+decision.ID+"/actions?action_type=inventory.transfer&status=completed", nil)
	listReq = withURLParam(listReq, "id", decision.ID)
	testHandler.ListActions(listRecorder, listReq)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("ListActions: expected 200, got %d: %s", listRecorder.Code, listRecorder.Body.String())
	}

	var listed struct {
		Actions []ActionRunResponse `json:"actions"`
	}
	if err := json.NewDecoder(listRecorder.Body).Decode(&listed); err != nil {
		t.Fatalf("ListActions: decode response: %v", err)
	}
	if len(listed.Actions) != 1 {
		t.Fatalf("ListActions: expected 1 action, got %d", len(listed.Actions))
	}
	if listed.Actions[0].ID != executed.Action.ID {
		t.Fatalf("ListActions: expected action id %q, got %q", executed.Action.ID, listed.Actions[0].ID)
	}

	rollbackRecorder := httptest.NewRecorder()
	rollbackReq := newRequest("POST", "/api/actions/"+executed.Action.ID+"/rollback", map[string]any{
		"rollback_payload": map[string]any{
			"reason": "operator requested rollback",
		},
	})
	rollbackReq = withURLParam(rollbackReq, "actionId", executed.Action.ID)
	testHandler.RollbackAction(rollbackRecorder, rollbackReq)
	if rollbackRecorder.Code != http.StatusOK {
		t.Fatalf("RollbackAction: expected 200, got %d: %s", rollbackRecorder.Code, rollbackRecorder.Body.String())
	}

	var rolledBack struct {
		Action   ActionRunResponse `json:"action"`
		Decision DecisionResponse  `json:"decision"`
	}
	if err := json.NewDecoder(rollbackRecorder.Body).Decode(&rolledBack); err != nil {
		t.Fatalf("RollbackAction: decode response: %v", err)
	}
	if rolledBack.Action.Status != "rolled_back" {
		t.Fatalf("RollbackAction: expected status %q, got %q", "rolled_back", rolledBack.Action.Status)
	}
	if rolledBack.Decision.ExecutionStatus != "rolled_back" {
		t.Fatalf("RollbackAction: expected execution_status %q, got %q", "rolled_back", rolledBack.Decision.ExecutionStatus)
	}
}

func TestExecuteActionIdempotency(t *testing.T) {
	decision := approveDecisionForActionTest(t)

	firstRecorder := httptest.NewRecorder()
	firstReq := newRequest("POST", "/api/decisions/"+decision.ID+"/execute", map[string]any{
		"idempotency_key": "action-idempotency-key",
		"action_type":     "inventory.transfer",
	})
	firstReq = withURLParam(firstReq, "id", decision.ID)
	testHandler.ExecuteAction(firstRecorder, firstReq)
	if firstRecorder.Code != http.StatusOK {
		t.Fatalf("ExecuteAction first attempt: expected 200, got %d: %s", firstRecorder.Code, firstRecorder.Body.String())
	}

	var first struct {
		Action ActionRunResponse `json:"action"`
	}
	if err := json.NewDecoder(firstRecorder.Body).Decode(&first); err != nil {
		t.Fatalf("ExecuteAction first attempt: decode response: %v", err)
	}

	secondRecorder := httptest.NewRecorder()
	secondReq := newRequest("POST", "/api/decisions/"+decision.ID+"/execute", map[string]any{
		"idempotency_key": "action-idempotency-key",
		"action_type":     "inventory.transfer",
	})
	secondReq = withURLParam(secondReq, "id", decision.ID)
	testHandler.ExecuteAction(secondRecorder, secondReq)
	if secondRecorder.Code != http.StatusOK {
		t.Fatalf("ExecuteAction second attempt: expected 200, got %d: %s", secondRecorder.Code, secondRecorder.Body.String())
	}

	var second struct {
		Action ActionRunResponse `json:"action"`
	}
	if err := json.NewDecoder(secondRecorder.Body).Decode(&second); err != nil {
		t.Fatalf("ExecuteAction second attempt: decode response: %v", err)
	}

	if second.Action.ID != first.Action.ID {
		t.Fatalf("ExecuteAction second attempt: expected action id %q, got %q", first.Action.ID, second.Action.ID)
	}
}
