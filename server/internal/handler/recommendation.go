package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type DecisionRecommendationResponse struct {
	ID               string  `json:"id"`
	DecisionCaseID   string  `json:"decision_case_id"`
	WorkspaceID      string  `json:"workspace_id"`
	ScenarioOptionID *string `json:"scenario_option_id"`
	Title            string  `json:"title"`
	Rationale        string  `json:"rationale"`
	ExpectedImpact   string  `json:"expected_impact"`
	ConfidenceScore  any     `json:"confidence_score"`
	ModelVersion     string  `json:"model_version"`
	SkillVersion     string  `json:"skill_version"`
	CreatedAt        string  `json:"created_at"`
}

type DecisionApprovalResponse struct {
	ID             string `json:"id"`
	DecisionCaseID string `json:"decision_case_id"`
	WorkspaceID    string `json:"workspace_id"`
	ApproverType   string `json:"approver_type"`
	ApproverID     string `json:"approver_id"`
	Status         string `json:"status"`
	Comment        string `json:"comment"`
	SortOrder      int32  `json:"sort_order"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type RecommendDecisionRequest struct {
	ScenarioOptionID *string  `json:"scenario_option_id"`
	Title            string   `json:"title"`
	Rationale        *string  `json:"rationale"`
	ExpectedImpact   *string  `json:"expected_impact"`
	ConfidenceScore  *float64 `json:"confidence_score"`
}

type decisionApprovalApproverRequest struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type SubmitApprovalRequest struct {
	Approvers []decisionApprovalApproverRequest `json:"approvers"`
}

type decisionApprovalCommentRequest struct {
	Comment *string `json:"comment"`
}

type decisionRejectionRequest struct {
	Comment string `json:"comment"`
}

func decisionRecommendationToResponse(recommendation db.DecisionRecommendation) DecisionRecommendationResponse {
	return DecisionRecommendationResponse{
		ID:               uuidToString(recommendation.ID),
		DecisionCaseID:   uuidToString(recommendation.DecisionCaseID),
		WorkspaceID:      uuidToString(recommendation.WorkspaceID),
		ScenarioOptionID: uuidToPtr(recommendation.ScenarioOptionID),
		Title:            recommendation.Title,
		Rationale:        recommendation.Rationale,
		ExpectedImpact:   recommendation.ExpectedImpact,
		ConfidenceScore:  numericToValue(recommendation.ConfidenceScore),
		ModelVersion:     recommendation.ModelVersion,
		SkillVersion:     recommendation.SkillVersion,
		CreatedAt:        timestampToString(recommendation.CreatedAt),
	}
}

func decisionApprovalToResponse(approval db.DecisionApproval) DecisionApprovalResponse {
	return DecisionApprovalResponse{
		ID:             uuidToString(approval.ID),
		DecisionCaseID: uuidToString(approval.DecisionCaseID),
		WorkspaceID:    uuidToString(approval.WorkspaceID),
		ApproverType:   approval.ApproverType,
		ApproverID:     uuidToString(approval.ApproverID),
		Status:         approval.Status,
		Comment:        approval.Comment,
		SortOrder:      approval.SortOrder,
		CreatedAt:      timestampToString(approval.CreatedAt),
		UpdatedAt:      timestampToString(approval.UpdatedAt),
	}
}

func parsePageAndSize(r *http.Request) (int, int) {
	page := 1
	if rawPage := r.URL.Query().Get("page"); rawPage != "" {
		if parsed, err := strconv.Atoi(rawPage); err == nil && parsed > 0 {
			page = parsed
		}
	}

	pageSize := 50
	if rawPageSize := r.URL.Query().Get("page_size"); rawPageSize != "" {
		if parsed, err := strconv.Atoi(rawPageSize); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	return page, pageSize
}

func getDecisionIssueAndCaseWithQueries(ctx *http.Request, queries *db.Queries, decisionID, workspaceID string) (db.Issue, db.DecisionCase, error) {
	issue, err := queries.GetIssueInWorkspace(ctx.Context(), db.GetIssueInWorkspaceParams{
		ID:          parseUUID(decisionID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		return db.Issue{}, db.DecisionCase{}, err
	}

	decision, err := queries.GetDecisionCaseInWorkspace(ctx.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     parseUUID(decisionID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		return db.Issue{}, db.DecisionCase{}, err
	}

	return issue, decision, nil
}

func validateApprover(queries *db.Queries, r *http.Request, workspaceID, approverType, approverID string) bool {
	switch approverType {
	case "member":
		_, err := queries.GetMemberByUserAndWorkspace(r.Context(), db.GetMemberByUserAndWorkspaceParams{
			UserID:      parseUUID(approverID),
			WorkspaceID: parseUUID(workspaceID),
		})
		return err == nil
	case "agent":
		agent, err := queries.GetAgent(r.Context(), parseUUID(approverID))
		return err == nil && uuidToString(agent.WorkspaceID) == workspaceID
	default:
		return false
	}
}

func validateScenarioOption(queries *db.Queries, r *http.Request, workspaceID string, decision db.DecisionCase, scenarioOptionID *string) (pgtype.UUID, bool) {
	if scenarioOptionID == nil || strings.TrimSpace(*scenarioOptionID) == "" {
		return pgtype.UUID{}, true
	}

	optionID := parseUUID(strings.TrimSpace(*scenarioOptionID))
	option, err := queries.GetScenarioOption(r.Context(), optionID)
	if err != nil {
		return pgtype.UUID{}, false
	}

	run, err := queries.GetScenarioRunInWorkspace(r.Context(), db.GetScenarioRunInWorkspaceParams{
		ID:          option.ScenarioRunID,
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil || run.DecisionCaseID != decision.IssueID {
		return pgtype.UUID{}, false
	}

	return optionID, true
}

func activeApprovalsAllApproved(approvals []db.DecisionApproval) bool {
	activeCount := 0
	for _, approval := range approvals {
		if approval.Status == "cancelled" {
			continue
		}
		activeCount++
		if approval.Status != "approved" {
			return false
		}
	}

	return activeCount > 0
}

func (h *Handler) RecommendDecision(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req RecommendDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	issue, decision, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID)
	if !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}
	if decision.Phase != "simulating" && decision.Phase != "recommending" {
		writeError(w, http.StatusConflict, "decision is not ready for recommendation")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create recommendation")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	scenarioOptionID, valid := validateScenarioOption(qtx, r, workspaceID, decision, req.ScenarioOptionID)
	if !valid {
		writeError(w, http.StatusBadRequest, "scenario_option_id is invalid")
		return
	}

	recommendation, err := qtx.CreateDecisionRecommendation(r.Context(), db.CreateDecisionRecommendationParams{
		DecisionCaseID:   decision.IssueID,
		WorkspaceID:      parseUUID(workspaceID),
		ScenarioOptionID: scenarioOptionID,
		Title:            strings.TrimSpace(req.Title),
		Rationale:        optionalTextValue(req.Rationale),
		ExpectedImpact:   optionalTextValue(req.ExpectedImpact),
		ConfidenceScore:  optionalFloatValue(req.ConfidenceScore),
		ModelVersion:     "",
		SkillVersion:     "",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create recommendation")
		return
	}

	updatedDecision, err := updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:        decision.IssueID,
		Phase:          strToText("recommending"),
		ApprovalStatus: strToText("draft"),
		ProjectID:      decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create recommendation")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create recommendation")
		return
	}

	oldState := decisionToResponse(issue, decision)
	resp := map[string]any{
		"recommendation": decisionRecommendationToResponse(recommendation),
		"decision":       decisionToResponse(issue, updatedDecision),
	}

	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: decisionID,
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "decision.recommended",
		TargetType:     "recommendation",
		TargetID:       uuidToString(recommendation.ID),
		OldState:       oldState,
		NewState:       resp,
		Metadata: map[string]any{
			"scenario_option_id": uuidToPtr(recommendation.ScenarioOptionID),
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionRecommended, workspaceID, actorType, actorID, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListRecommendations(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	if _, _, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID); !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	page, pageSize := parsePageAndSize(r)
	recommendations, err := h.Queries.ListDecisionRecommendations(r.Context(), db.ListDecisionRecommendationsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionID),
		OffsetCount:    int32((page - 1) * pageSize),
		LimitCount:     int32(pageSize),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list recommendations")
		return
	}

	resp := make([]DecisionRecommendationResponse, 0, len(recommendations))
	for _, recommendation := range recommendations {
		resp = append(resp, decisionRecommendationToResponse(recommendation))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"recommendations": resp,
		"page":            page,
		"page_size":       pageSize,
	})
}

func (h *Handler) SubmitForApproval(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req SubmitApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Approvers) == 0 {
		writeError(w, http.StatusBadRequest, "at least one approver is required")
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	issue, decision, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID)
	if !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}
	if decision.Phase != "recommending" {
		writeError(w, http.StatusConflict, "decision is not ready for approval")
		return
	}

	recommendations, err := h.Queries.ListDecisionRecommendations(r.Context(), db.ListDecisionRecommendationsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decision.IssueID,
		OffsetCount:    0,
		LimitCount:     1,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
		return
	}
	if len(recommendations) == 0 {
		writeError(w, http.StatusConflict, "at least one recommendation is required before approval")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	existingApprovals, err := qtx.ListDecisionApprovals(r.Context(), db.ListDecisionApprovalsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decision.IssueID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
		return
	}
	for _, approval := range existingApprovals {
		if approval.Status == "cancelled" {
			continue
		}
		if _, err := qtx.UpdateDecisionApproval(r.Context(), db.UpdateDecisionApprovalParams{
			Status: strToText("cancelled"),
			ID:     approval.ID,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
			return
		}
	}

	createdApprovals := make([]DecisionApprovalResponse, 0, len(req.Approvers))
	for idx, approver := range req.Approvers {
		approverType := strings.TrimSpace(approver.Type)
		approverID := strings.TrimSpace(approver.ID)
		if approverType == "" || approverID == "" {
			writeError(w, http.StatusBadRequest, "approver type and id are required")
			return
		}
		if !validateApprover(qtx, r, workspaceID, approverType, approverID) {
			writeError(w, http.StatusBadRequest, "approver is invalid")
			return
		}

		approval, err := qtx.CreateDecisionApproval(r.Context(), db.CreateDecisionApprovalParams{
			DecisionCaseID: decision.IssueID,
			WorkspaceID:    parseUUID(workspaceID),
			ApproverType:   approverType,
			ApproverID:     parseUUID(approverID),
			Status:         "pending",
			Comment:        "",
			SortOrder:      idx,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
			return
		}
		createdApprovals = append(createdApprovals, decisionApprovalToResponse(approval))
	}

	updatedDecision, err := updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:        decision.IssueID,
		Phase:          strToText("awaiting_approval"),
		ApprovalStatus: strToText("pending"),
		ProjectID:      decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to submit decision for approval")
		return
	}

	oldState := map[string]any{
		"decision":  decisionToResponse(issue, decision),
		"approvals": make([]DecisionApprovalResponse, 0),
	}
	resp := map[string]any{
		"approvals": createdApprovals,
		"decision":  decisionToResponse(issue, updatedDecision),
	}

	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: decisionID,
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "approval.submitted",
		TargetType:     "approval",
		TargetID:       createdApprovals[0].ID,
		OldState:       oldState,
		NewState:       resp,
		Metadata: map[string]any{
			"approval_count": len(createdApprovals),
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionApprovalSubmitted, workspaceID, actorType, actorID, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ApproveDecision(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req decisionApprovalCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	approvalID := chi.URLParam(r, "approvalId")
	workspaceID := resolveWorkspaceID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to approve decision")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	approval, err := qtx.GetDecisionApprovalInWorkspace(r.Context(), db.GetDecisionApprovalInWorkspaceParams{
		ID:          parseUUID(approvalID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "approval not found")
		return
	}
	if approval.Status != "pending" {
		writeError(w, http.StatusConflict, "approval is not pending")
		return
	}
	if actorType != approval.ApproverType || actorID != uuidToString(approval.ApproverID) {
		writeError(w, http.StatusForbidden, "approval is not assigned to the current actor")
		return
	}

	updatedApproval, err := qtx.UpdateDecisionApproval(r.Context(), db.UpdateDecisionApprovalParams{
		Status:  strToText("approved"),
		Comment: ptrToText(req.Comment),
		ID:      approval.ID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to approve decision")
		return
	}

	issue, decision, err := getDecisionIssueAndCaseWithQueries(r, qtx, uuidToString(approval.DecisionCaseID), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to approve decision")
		return
	}
	oldDecisionState := decisionToResponse(issue, decision)

	approvals, err := qtx.ListDecisionApprovals(r.Context(), db.ListDecisionApprovalsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: approval.DecisionCaseID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to approve decision")
		return
	}

	if activeApprovalsAllApproved(approvals) {
		decision, err = updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
			IssueID:        decision.IssueID,
			Phase:          strToText("approved"),
			ApprovalStatus: strToText("approved"),
			ProjectID:      decision.ProjectID,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to approve decision")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to approve decision")
		return
	}

	oldState := map[string]any{
		"approval": decisionApprovalToResponse(approval),
		"decision": oldDecisionState,
	}
	resp := map[string]any{
		"approval": decisionApprovalToResponse(updatedApproval),
		"decision": decisionToResponse(issue, decision),
	}

	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: uuidToString(approval.DecisionCaseID),
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "approval.approved",
		TargetType:     "approval",
		TargetID:       uuidToString(approval.ID),
		OldState:       oldState,
		NewState:       resp,
		Metadata:       map[string]any{"status": updatedApproval.Status},
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionApproved, workspaceID, actorType, actorID, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) RejectDecision(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req decisionRejectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Comment) == "" {
		writeError(w, http.StatusBadRequest, "comment is required")
		return
	}

	approvalID := chi.URLParam(r, "approvalId")
	workspaceID := resolveWorkspaceID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reject decision")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	approval, err := qtx.GetDecisionApprovalInWorkspace(r.Context(), db.GetDecisionApprovalInWorkspaceParams{
		ID:          parseUUID(approvalID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "approval not found")
		return
	}
	if approval.Status != "pending" {
		writeError(w, http.StatusConflict, "approval is not pending")
		return
	}
	if actorType != approval.ApproverType || actorID != uuidToString(approval.ApproverID) {
		writeError(w, http.StatusForbidden, "approval is not assigned to the current actor")
		return
	}

	updatedApproval, err := qtx.UpdateDecisionApproval(r.Context(), db.UpdateDecisionApprovalParams{
		Status:  strToText("rejected"),
		Comment: strToText(strings.TrimSpace(req.Comment)),
		ID:      approval.ID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reject decision")
		return
	}

	issue, decision, err := getDecisionIssueAndCaseWithQueries(r, qtx, uuidToString(approval.DecisionCaseID), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reject decision")
		return
	}
	oldDecisionState := decisionToResponse(issue, decision)

	decision, err = updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:        decision.IssueID,
		Phase:          strToText("recommending"),
		ApprovalStatus: strToText("rejected"),
		ProjectID:      decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reject decision")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reject decision")
		return
	}

	oldState := map[string]any{
		"approval": decisionApprovalToResponse(approval),
		"decision": oldDecisionState,
	}
	resp := map[string]any{
		"approval": decisionApprovalToResponse(updatedApproval),
		"decision": decisionToResponse(issue, decision),
	}

	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: uuidToString(approval.DecisionCaseID),
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "approval.rejected",
		TargetType:     "approval",
		TargetID:       uuidToString(approval.ID),
		OldState:       oldState,
		NewState:       resp,
		Metadata:       map[string]any{"status": updatedApproval.Status},
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionRejected, workspaceID, actorType, actorID, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListApprovals(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	if _, _, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID); !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	approvals, err := h.Queries.ListDecisionApprovals(r.Context(), db.ListDecisionApprovalsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list approvals")
		return
	}

	resp := make([]DecisionApprovalResponse, 0, len(approvals))
	for _, approval := range approvals {
		resp = append(resp, decisionApprovalToResponse(approval))
	}

	writeJSON(w, http.StatusOK, map[string]any{"approvals": resp})
}

func optionalTextValue(value *string) any {
	if value == nil {
		return nil
	}
	return strings.TrimSpace(*value)
}

func optionalFloatValue(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}
