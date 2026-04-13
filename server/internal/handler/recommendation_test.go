package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func moveDecisionToPhaseForTest(t *testing.T, decisionID, phase string) DecisionResponse {
	t.Helper()

	w := httptest.NewRecorder()
	req := newRequest("PATCH", "/api/decisions/"+decisionID, map[string]any{
		"phase": phase,
	})
	req = withURLParam(req, "id", decisionID)
	testHandler.UpdateDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateDecision phase %q: expected 200, got %d: %s", phase, w.Code, w.Body.String())
	}

	var updated DecisionResponse
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("UpdateDecision phase %q: decode response: %v", phase, err)
	}
	return updated
}

func createDecisionReadyForRecommendation(t *testing.T) DecisionResponse {
	t.Helper()

	created := createDecisionForTest(t, map[string]any{
		"title":          "Recommendation workflow decision",
		"priority":       "high",
		"domain":         "supply_chain",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      "SKU-RECOMMEND-1",
		"objective":      "Prevent stockout during promotion",
		"constraints":    "Do not exceed transfer budget",
		"risk_level":     "high",
		"execution_mode": "manual",
	})

	return moveDecisionToPhaseForTest(t, created.ID, "simulating")
}

func submitApprovalForTest(t *testing.T, decisionID string) DecisionApprovalResponse {
	t.Helper()

	recommendRecorder := httptest.NewRecorder()
	recommendReq := newRequest("POST", "/api/decisions/"+decisionID+"/recommend", map[string]any{
		"title":            "Shift inventory from north to east",
		"rationale":        "East warehouse demand is exceeding forecast",
		"expected_impact":  "Reduce stockout risk this week",
		"confidence_score": 0.82,
	})
	recommendReq = withURLParam(recommendReq, "id", decisionID)
	testHandler.RecommendDecision(recommendRecorder, recommendReq)
	if recommendRecorder.Code != http.StatusOK {
		t.Fatalf("RecommendDecision: expected 200, got %d: %s", recommendRecorder.Code, recommendRecorder.Body.String())
	}

	approvalRecorder := httptest.NewRecorder()
	approvalReq := newRequest("POST", "/api/decisions/"+decisionID+"/submit-approval", map[string]any{
		"approvers": []map[string]any{
			{"type": "member", "id": testUserID},
		},
	})
	approvalReq = withURLParam(approvalReq, "id", decisionID)
	testHandler.SubmitForApproval(approvalRecorder, approvalReq)
	if approvalRecorder.Code != http.StatusOK {
		t.Fatalf("SubmitForApproval: expected 200, got %d: %s", approvalRecorder.Code, approvalRecorder.Body.String())
	}

	var submitted struct {
		Approvals []DecisionApprovalResponse `json:"approvals"`
		Decision  DecisionResponse           `json:"decision"`
	}
	if err := json.NewDecoder(approvalRecorder.Body).Decode(&submitted); err != nil {
		t.Fatalf("SubmitForApproval: decode response: %v", err)
	}
	if len(submitted.Approvals) != 1 {
		t.Fatalf("SubmitForApproval: expected 1 approval, got %d", len(submitted.Approvals))
	}
	return submitted.Approvals[0]
}

func TestRecommendationWorkflow(t *testing.T) {
	decision := createDecisionReadyForRecommendation(t)

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/decisions/"+decision.ID+"/recommend", map[string]any{
		"title":            "Shift inventory from north to east",
		"rationale":        "East warehouse demand is exceeding forecast",
		"expected_impact":  "Reduce stockout risk this week",
		"confidence_score": 0.82,
	})
	req = withURLParam(req, "id", decision.ID)
	testHandler.RecommendDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("RecommendDecision: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var recommended struct {
		Recommendation DecisionRecommendationResponse `json:"recommendation"`
		Decision       DecisionResponse               `json:"decision"`
	}
	if err := json.NewDecoder(w.Body).Decode(&recommended); err != nil {
		t.Fatalf("RecommendDecision: decode response: %v", err)
	}
	if recommended.Recommendation.Title != "Shift inventory from north to east" {
		t.Fatalf("RecommendDecision: expected title %q, got %q", "Shift inventory from north to east", recommended.Recommendation.Title)
	}
	if recommended.Decision.Phase != "recommending" {
		t.Fatalf("RecommendDecision: expected phase %q, got %q", "recommending", recommended.Decision.Phase)
	}
	if recommended.Decision.ApprovalStatus != "draft" {
		t.Fatalf("RecommendDecision: expected approval_status %q, got %q", "draft", recommended.Decision.ApprovalStatus)
	}

	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/decisions/"+decision.ID+"/recommendations?page=1&page_size=10", nil)
	req = withURLParam(req, "id", decision.ID)
	testHandler.ListRecommendations(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListRecommendations: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var listed struct {
		Recommendations []DecisionRecommendationResponse `json:"recommendations"`
		Page            int                              `json:"page"`
		PageSize        int                              `json:"page_size"`
	}
	if err := json.NewDecoder(w.Body).Decode(&listed); err != nil {
		t.Fatalf("ListRecommendations: decode response: %v", err)
	}
	if len(listed.Recommendations) != 1 {
		t.Fatalf("ListRecommendations: expected 1 recommendation, got %d", len(listed.Recommendations))
	}
	if listed.Page != 1 || listed.PageSize != 10 {
		t.Fatalf("ListRecommendations: expected page=1 page_size=10, got page=%d page_size=%d", listed.Page, listed.PageSize)
	}
}

func TestApprovalWorkflowApprove(t *testing.T) {
	decision := createDecisionReadyForRecommendation(t)
	approval := submitApprovalForTest(t, decision.ID)

	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/decisions/"+decision.ID+"/approvals", nil)
	req = withURLParam(req, "id", decision.ID)
	testHandler.ListApprovals(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListApprovals: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var listed struct {
		Approvals []DecisionApprovalResponse `json:"approvals"`
	}
	if err := json.NewDecoder(w.Body).Decode(&listed); err != nil {
		t.Fatalf("ListApprovals: decode response: %v", err)
	}
	if len(listed.Approvals) != 1 {
		t.Fatalf("ListApprovals: expected 1 approval, got %d", len(listed.Approvals))
	}
	if listed.Approvals[0].Status != "pending" {
		t.Fatalf("ListApprovals: expected status %q, got %q", "pending", listed.Approvals[0].Status)
	}

	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/approvals/"+approval.ID+"/approve", map[string]any{
		"comment": "Proceed with the transfer plan",
	})
	req = withURLParam(req, "approvalId", approval.ID)
	testHandler.ApproveDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveDecision: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var approved struct {
		Approval DecisionApprovalResponse `json:"approval"`
		Decision DecisionResponse         `json:"decision"`
	}
	if err := json.NewDecoder(w.Body).Decode(&approved); err != nil {
		t.Fatalf("ApproveDecision: decode response: %v", err)
	}
	if approved.Approval.Status != "approved" {
		t.Fatalf("ApproveDecision: expected approval status %q, got %q", "approved", approved.Approval.Status)
	}
	if approved.Decision.Phase != "approved" {
		t.Fatalf("ApproveDecision: expected phase %q, got %q", "approved", approved.Decision.Phase)
	}
	if approved.Decision.ApprovalStatus != "approved" {
		t.Fatalf("ApproveDecision: expected approval_status %q, got %q", "approved", approved.Decision.ApprovalStatus)
	}
}

func TestApprovalWorkflowReject(t *testing.T) {
	decision := createDecisionReadyForRecommendation(t)
	approval := submitApprovalForTest(t, decision.ID)

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/approvals/"+approval.ID+"/reject", map[string]any{
		"comment": "Need a lower-risk option before approval",
	})
	req = withURLParam(req, "approvalId", approval.ID)
	testHandler.RejectDecision(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("RejectDecision: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var rejected struct {
		Approval DecisionApprovalResponse `json:"approval"`
		Decision DecisionResponse         `json:"decision"`
	}
	if err := json.NewDecoder(w.Body).Decode(&rejected); err != nil {
		t.Fatalf("RejectDecision: decode response: %v", err)
	}
	if rejected.Approval.Status != "rejected" {
		t.Fatalf("RejectDecision: expected approval status %q, got %q", "rejected", rejected.Approval.Status)
	}
	if rejected.Decision.Phase != "recommending" {
		t.Fatalf("RejectDecision: expected phase %q, got %q", "recommending", rejected.Decision.Phase)
	}
	if rejected.Decision.ApprovalStatus != "rejected" {
		t.Fatalf("RejectDecision: expected approval_status %q, got %q", "rejected", rejected.Decision.ApprovalStatus)
	}
}

func TestApproveDecisionRejectsNonApprover(t *testing.T) {
	decision := createDecisionReadyForRecommendation(t)
	approval := submitApprovalForTest(t, decision.ID)

	ctx := t.Context()
	const otherEmail = "recommendation-other-approver@multica.ai"

	var otherUserID string
	if err := testPool.QueryRow(ctx, `
		INSERT INTO "user" (name, email)
		VALUES ('Recommendation Other Approver', $1)
		RETURNING id
	`, otherEmail).Scan(&otherUserID); err != nil {
		t.Fatalf("insert other user: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, otherEmail)
	})

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/approvals/"+approval.ID+"/approve", map[string]any{
		"comment": "I should not be able to approve this",
	})
	req = withURLParam(req, "approvalId", approval.ID)
	req.Header.Set("X-User-ID", otherUserID)
	testHandler.ApproveDecision(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("ApproveDecision non-approver: expected 403, got %d: %s", w.Code, w.Body.String())
	}
}
