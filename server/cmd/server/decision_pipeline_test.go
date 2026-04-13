package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type decisionPipelineDecisionResponse struct {
	ID              string `json:"id"`
	Phase           string `json:"phase"`
	ApprovalStatus  string `json:"approval_status"`
	ExecutionStatus string `json:"execution_status"`
}

type decisionPipelineRecommendationResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Rationale string `json:"rationale"`
}

type decisionPipelineApprovalResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Comment string `json:"comment"`
}

type decisionPipelineActionResponse struct {
	ID             string  `json:"id"`
	IdempotencyKey string  `json:"idempotency_key"`
	ActionType     string  `json:"action_type"`
	Status         string  `json:"status"`
	CompletedAt    *string `json:"completed_at"`
}

type decisionPipelineRecommendResult struct {
	Recommendation decisionPipelineRecommendationResponse `json:"recommendation"`
	Decision       decisionPipelineDecisionResponse       `json:"decision"`
}

type decisionPipelineRecommendationListResponse struct {
	Recommendations []decisionPipelineRecommendationResponse `json:"recommendations"`
	Page            int                                      `json:"page"`
	PageSize        int                                      `json:"page_size"`
}

type decisionPipelineSubmitApprovalResult struct {
	Approvals []decisionPipelineApprovalResponse `json:"approvals"`
	Decision  decisionPipelineDecisionResponse   `json:"decision"`
}

type decisionPipelineApprovalActionResult struct {
	Approval decisionPipelineApprovalResponse `json:"approval"`
	Decision decisionPipelineDecisionResponse `json:"decision"`
}

type decisionPipelineApprovalListResponse struct {
	Approvals []decisionPipelineApprovalResponse `json:"approvals"`
}

type decisionPipelineActionResult struct {
	Action   decisionPipelineActionResponse   `json:"action"`
	Decision decisionPipelineDecisionResponse `json:"decision"`
}

type decisionPipelineActionListResponse struct {
	Actions  []decisionPipelineActionResponse `json:"actions"`
	Page     int                              `json:"page"`
	PageSize int                              `json:"page_size"`
}

type decisionPipelineAuditEventResponse struct {
	ID             string `json:"id"`
	DecisionCaseID string `json:"decision_case_id"`
	Action         string `json:"action"`
	TargetType     string `json:"target_type"`
	TargetID       string `json:"target_id"`
}

type decisionPipelineAuditListResponse struct {
	Events []decisionPipelineAuditEventResponse `json:"events"`
}

func skipDecisionPipelineIntegration(t *testing.T) {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping integration test")
	}
}

func requireStatusCode(t *testing.T, resp *http.Response, expected int) {
	t.Helper()
	if resp.StatusCode == expected {
		return
	}

	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	require.Failf(
		t,
		"unexpected status code",
		"expected %d, got %d for %s %s: %s",
		expected,
		resp.StatusCode,
		resp.Request.Method,
		resp.Request.URL.Path,
		strings.TrimSpace(string(body)),
	)
}

func decisionPipelineUniqueValue(t *testing.T, prefix string) string {
	t.Helper()
	replacer := strings.NewReplacer("/", "-", " ", "-", "(", "", ")", "")
	name := replacer.Replace(strings.ToLower(t.Name()))
	return fmt.Sprintf("%s-%s-%d", prefix, name, time.Now().UnixNano())
}

func createDecisionForPipeline(t *testing.T) decisionPipelineDecisionResponse {
	t.Helper()

	seed := decisionPipelineUniqueValue(t, "decision")
	resp := authRequest(t, "POST", "/api/decisions", map[string]any{
		"title":          "Decision pipeline " + seed,
		"priority":       "high",
		"domain":         "decision_pipeline_test",
		"decision_type":  "inventory_rebalance",
		"object_type":    "sku_warehouse",
		"object_id":      strings.ToUpper(seed),
		"objective":      "Keep service levels stable",
		"constraints":    "Do not exceed transfer budget",
		"risk_level":     "medium",
		"execution_mode": "manual",
	})
	requireStatusCode(t, resp, http.StatusCreated)

	var created decisionPipelineDecisionResponse
	readJSON(t, resp, &created)
	require.NotEmpty(t, created.ID)

	return created
}

func moveDecisionToPhaseForPipeline(t *testing.T, decisionID, phase string) decisionPipelineDecisionResponse {
	t.Helper()

	resp := authRequest(t, "PATCH", "/api/decisions/"+decisionID, map[string]any{
		"phase": phase,
	})
	requireStatusCode(t, resp, http.StatusOK)

	var updated decisionPipelineDecisionResponse
	readJSON(t, resp, &updated)
	require.Equal(t, phase, updated.Phase)

	return updated
}

func createDecisionReadyForRecommendation(t *testing.T) decisionPipelineDecisionResponse {
	t.Helper()

	created := createDecisionForPipeline(t)
	return moveDecisionToPhaseForPipeline(t, created.ID, "simulating")
}

func recommendDecisionForPipeline(t *testing.T, decisionID, title, rationale string) decisionPipelineRecommendResult {
	t.Helper()

	resp := authRequest(t, "POST", "/api/decisions/"+decisionID+"/recommend", map[string]any{
		"title":            title,
		"rationale":        rationale,
		"expected_impact":  "Reduce stockout risk this week",
		"confidence_score": 0.82,
	})
	requireStatusCode(t, resp, http.StatusOK)

	var recommended decisionPipelineRecommendResult
	readJSON(t, resp, &recommended)
	require.NotEmpty(t, recommended.Recommendation.ID)

	return recommended
}

func submitApprovalForPipeline(t *testing.T, decisionID string) decisionPipelineSubmitApprovalResult {
	t.Helper()

	resp := authRequest(t, "POST", "/api/decisions/"+decisionID+"/submit-approval", map[string]any{
		"approvers": []map[string]any{
			{"type": "member", "id": testUserID},
		},
	})
	requireStatusCode(t, resp, http.StatusOK)

	var submitted decisionPipelineSubmitApprovalResult
	readJSON(t, resp, &submitted)
	require.Len(t, submitted.Approvals, 1)
	require.NotEmpty(t, submitted.Approvals[0].ID)

	return submitted
}

func approveDecisionForPipeline(t *testing.T, approvalID, comment string) decisionPipelineApprovalActionResult {
	t.Helper()

	resp := authRequest(t, "POST", "/api/approvals/"+approvalID+"/approve", map[string]any{
		"comment": comment,
	})
	requireStatusCode(t, resp, http.StatusOK)

	var approved decisionPipelineApprovalActionResult
	readJSON(t, resp, &approved)
	require.NotEmpty(t, approved.Approval.ID)

	return approved
}

func rejectDecisionForPipeline(t *testing.T, approvalID, comment string) decisionPipelineApprovalActionResult {
	t.Helper()

	resp := authRequest(t, "POST", "/api/approvals/"+approvalID+"/reject", map[string]any{
		"comment": comment,
	})
	requireStatusCode(t, resp, http.StatusOK)

	var rejected decisionPipelineApprovalActionResult
	readJSON(t, resp, &rejected)
	require.NotEmpty(t, rejected.Approval.ID)

	return rejected
}

func createApprovedDecisionForPipeline(t *testing.T) decisionPipelineDecisionResponse {
	t.Helper()

	decision := createDecisionReadyForRecommendation(t)
	recommendTitle := "Recommendation " + decisionPipelineUniqueValue(t, "approved")
	recommended := recommendDecisionForPipeline(t, decision.ID, recommendTitle, "Recommended by approval workflow helper")
	submitted := submitApprovalForPipeline(t, decision.ID)
	approved := approveDecisionForPipeline(t, submitted.Approvals[0].ID, "Ready to execute")

	require.Equal(t, recommended.Decision.ID, approved.Decision.ID)
	require.Equal(t, "approved", approved.Decision.Phase)

	return approved.Decision
}

func executeActionForPipeline(t *testing.T, decisionID, idempotencyKey string) decisionPipelineActionResult {
	t.Helper()

	resp := authRequest(t, "POST", "/api/decisions/"+decisionID+"/execute", map[string]any{
		"idempotency_key": idempotencyKey,
		"action_type":     "inventory.transfer",
		"request_payload": map[string]any{
			"from": "north",
			"to":   "east",
			"sku":  decisionPipelineUniqueValue(t, "sku"),
		},
	})
	requireStatusCode(t, resp, http.StatusOK)

	var executed decisionPipelineActionResult
	readJSON(t, resp, &executed)
	require.NotEmpty(t, executed.Action.ID)

	return executed
}

func rollbackActionForPipeline(t *testing.T, actionID string) decisionPipelineActionResult {
	t.Helper()

	resp := authRequest(t, "POST", "/api/actions/"+actionID+"/rollback", map[string]any{
		"rollback_payload": map[string]any{
			"reason": "operator requested rollback",
		},
	})
	requireStatusCode(t, resp, http.StatusOK)

	var rolledBack decisionPipelineActionResult
	readJSON(t, resp, &rolledBack)
	require.NotEmpty(t, rolledBack.Action.ID)

	return rolledBack
}

func listApprovalsForPipeline(t *testing.T, decisionID string) decisionPipelineApprovalListResponse {
	t.Helper()

	resp := authRequest(t, "GET", "/api/decisions/"+decisionID+"/approvals", nil)
	requireStatusCode(t, resp, http.StatusOK)

	var listed decisionPipelineApprovalListResponse
	readJSON(t, resp, &listed)
	return listed
}

func collectAuditActions(events []decisionPipelineAuditEventResponse) []string {
	actions := make([]string, 0, len(events))
	for _, event := range events {
		actions = append(actions, event.Action)
	}
	return actions
}

func TestRecommendDecision(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createDecisionReadyForRecommendation(t)
	title := "Shift inventory from north to east"
	rationale := "East warehouse demand is exceeding forecast"

	recommended := recommendDecisionForPipeline(t, decision.ID, title, rationale)
	assert.Equal(t, "recommending", recommended.Decision.Phase)
	assert.Equal(t, title, recommended.Recommendation.Title)
	assert.Equal(t, rationale, recommended.Recommendation.Rationale)

	listResp := authRequest(t, "GET", "/api/decisions/"+decision.ID+"/recommendations?page=1&page_size=10", nil)
	requireStatusCode(t, listResp, http.StatusOK)

	var listed decisionPipelineRecommendationListResponse
	readJSON(t, listResp, &listed)
	require.Len(t, listed.Recommendations, 1)
	assert.Equal(t, 1, listed.Page)
	assert.Equal(t, 10, listed.PageSize)
	assert.Equal(t, recommended.Recommendation.ID, listed.Recommendations[0].ID)
	assert.Equal(t, title, listed.Recommendations[0].Title)
}

func TestApprovalWorkflow(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createDecisionReadyForRecommendation(t)
	recommendDecisionForPipeline(t, decision.ID, "Approval path recommendation", "Approve the safer transfer option")

	submitted := submitApprovalForPipeline(t, decision.ID)
	require.Len(t, submitted.Approvals, 1)
	assert.Equal(t, "awaiting_approval", submitted.Decision.Phase)
	assert.Equal(t, "pending", submitted.Decision.ApprovalStatus)
	assert.Equal(t, "pending", submitted.Approvals[0].Status)

	pendingApprovals := listApprovalsForPipeline(t, decision.ID)
	require.Len(t, pendingApprovals.Approvals, 1)
	assert.Equal(t, "pending", pendingApprovals.Approvals[0].Status)

	approved := approveDecisionForPipeline(t, submitted.Approvals[0].ID, "Proceed with the transfer plan")
	assert.Equal(t, "approved", approved.Decision.Phase)
	assert.Equal(t, "approved", approved.Decision.ApprovalStatus)
	assert.Equal(t, "approved", approved.Approval.Status)

	approvedApprovals := listApprovalsForPipeline(t, decision.ID)
	require.Len(t, approvedApprovals.Approvals, 1)
	assert.Equal(t, "approved", approvedApprovals.Approvals[0].Status)
}

func TestRejectDecision(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createDecisionReadyForRecommendation(t)
	recommendDecisionForPipeline(t, decision.ID, "Reject path recommendation", "Needs a lower-risk alternative")

	submitted := submitApprovalForPipeline(t, decision.ID)
	rejected := rejectDecisionForPipeline(t, submitted.Approvals[0].ID, "Need a lower-risk option before approval")

	assert.Equal(t, "recommending", rejected.Decision.Phase)
	assert.Equal(t, "rejected", rejected.Decision.ApprovalStatus)
	assert.Equal(t, "rejected", rejected.Approval.Status)
	assert.Equal(t, "Need a lower-risk option before approval", rejected.Approval.Comment)

	approvals := listApprovalsForPipeline(t, decision.ID)
	require.Len(t, approvals.Approvals, 1)
	assert.Equal(t, "rejected", approvals.Approvals[0].Status)
}

func TestActionExecution(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createApprovedDecisionForPipeline(t)
	idempotencyKey := decisionPipelineUniqueValue(t, "execute")

	executed := executeActionForPipeline(t, decision.ID, idempotencyKey)
	assert.Equal(t, "executing", executed.Decision.Phase)
	assert.Equal(t, "completed", executed.Action.Status)
	assert.NotNil(t, executed.Action.CompletedAt)
	assert.Equal(t, "completed", executed.Decision.ExecutionStatus)

	listResp := authRequest(t, "GET", "/api/decisions/"+decision.ID+"/actions?page=1&page_size=10", nil)
	requireStatusCode(t, listResp, http.StatusOK)

	var listed decisionPipelineActionListResponse
	readJSON(t, listResp, &listed)
	require.Len(t, listed.Actions, 1)
	assert.Equal(t, 1, listed.Page)
	assert.Equal(t, 10, listed.PageSize)
	assert.Equal(t, executed.Action.ID, listed.Actions[0].ID)
	assert.Equal(t, "completed", listed.Actions[0].Status)

	getResp := authRequest(t, "GET", "/api/actions/"+executed.Action.ID, nil)
	requireStatusCode(t, getResp, http.StatusOK)

	var action decisionPipelineActionResponse
	readJSON(t, getResp, &action)
	assert.Equal(t, executed.Action.ID, action.ID)
	assert.Equal(t, idempotencyKey, action.IdempotencyKey)
	assert.Equal(t, "completed", action.Status)
}

func TestIdempotentExecution(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createApprovedDecisionForPipeline(t)
	idempotencyKey := decisionPipelineUniqueValue(t, "idempotent")

	first := executeActionForPipeline(t, decision.ID, idempotencyKey)

	secondResp := authRequest(t, "POST", "/api/decisions/"+decision.ID+"/execute", map[string]any{
		"idempotency_key": idempotencyKey,
		"action_type":     "inventory.transfer",
	})
	requireStatusCode(t, secondResp, http.StatusOK)

	var second decisionPipelineActionResult
	readJSON(t, secondResp, &second)
	assert.Equal(t, first.Action.ID, second.Action.ID)
	assert.Equal(t, idempotencyKey, second.Action.IdempotencyKey)
	assert.Equal(t, "completed", second.Action.Status)
}

func TestRollbackAction(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createApprovedDecisionForPipeline(t)
	executed := executeActionForPipeline(t, decision.ID, decisionPipelineUniqueValue(t, "rollback"))

	rolledBack := rollbackActionForPipeline(t, executed.Action.ID)
	assert.Equal(t, "rolled_back", rolledBack.Action.Status)
	assert.Equal(t, "rolled_back", rolledBack.Decision.ExecutionStatus)

	getResp := authRequest(t, "GET", "/api/actions/"+executed.Action.ID, nil)
	requireStatusCode(t, getResp, http.StatusOK)

	var action decisionPipelineActionResponse
	readJSON(t, getResp, &action)
	assert.Equal(t, "rolled_back", action.Status)
}

func TestAuditTrail(t *testing.T) {
	skipDecisionPipelineIntegration(t)

	decision := createDecisionReadyForRecommendation(t)
	recommendDecisionForPipeline(t, decision.ID, "Audit trail recommendation", "Track the full approval and execution flow")
	submitted := submitApprovalForPipeline(t, decision.ID)
	approveDecisionForPipeline(t, submitted.Approvals[0].ID, "Approved for audit trail verification")
	executed := executeActionForPipeline(t, decision.ID, decisionPipelineUniqueValue(t, "audit"))
	rollbackActionForPipeline(t, executed.Action.ID)

	trailResp := authRequest(t, "GET", "/api/decisions/"+decision.ID+"/audit-trail?page=1&page_size=20", nil)
	requireStatusCode(t, trailResp, http.StatusOK)

	var trail decisionPipelineAuditListResponse
	readJSON(t, trailResp, &trail)
	require.NotEmpty(t, trail.Events)
	trailActions := collectAuditActions(trail.Events)
	assert.Contains(t, trailActions, "decision.recommended")
	assert.Contains(t, trailActions, "approval.submitted")
	assert.Contains(t, trailActions, "approval.approved")
	assert.Contains(t, trailActions, "action.executed")
	assert.Contains(t, trailActions, "action.rolled_back")

	workspaceResp := authRequest(t, "GET", "/api/audit/events?decision_case_id="+decision.ID+"&page=1&page_size=20", nil)
	requireStatusCode(t, workspaceResp, http.StatusOK)
	require.NotEmpty(t, workspaceResp.Header.Get("X-Total-Count"))

	var workspaceEvents decisionPipelineAuditListResponse
	readJSON(t, workspaceResp, &workspaceEvents)
	require.NotEmpty(t, workspaceEvents.Events)
	workspaceActions := collectAuditActions(workspaceEvents.Events)
	assert.Contains(t, workspaceActions, "decision.recommended")
	assert.Contains(t, workspaceActions, "action.rolled_back")

	eventResp := authRequest(t, "GET", "/api/audit/events/"+workspaceEvents.Events[0].ID, nil)
	requireStatusCode(t, eventResp, http.StatusOK)

	var event decisionPipelineAuditEventResponse
	readJSON(t, eventResp, &event)
	assert.Equal(t, workspaceEvents.Events[0].ID, event.ID)
	assert.Equal(t, decision.ID, event.DecisionCaseID)
	assert.NotEmpty(t, event.Action)
}
