package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

const countDecisionCasesSQL = `
SELECT COUNT(*) FROM decision_case
WHERE workspace_id = $1
  AND ($2::text = '' OR phase = $2)
  AND ($3::text = '' OR risk_level = $3)
  AND ($4::text = '' OR execution_mode = $4)
  AND ($5::text = '' OR decision_type = $5)
  AND ($6::text = '' OR object_type = $6)
  AND ($7::uuid IS NULL OR project_id = $7)
`

const updateDecisionCaseSQL = `
UPDATE decision_case SET
    domain = COALESCE($2, domain),
    decision_type = COALESCE($3, decision_type),
    object_type = COALESCE($4, object_type),
    object_id = COALESCE($5, object_id),
    objective = COALESCE($6, objective),
    constraints = COALESCE($7, constraints),
    risk_level = COALESCE($8, risk_level),
    execution_mode = COALESCE($9, execution_mode),
    phase = COALESCE($10, phase),
    approval_status = COALESCE($11, approval_status),
    execution_status = COALESCE($12, execution_status),
    project_id = $13,
    updated_at = now()
WHERE issue_id = $1
RETURNING issue_id, workspace_id, project_id, domain, decision_type, object_type, object_id, objective, constraints, risk_level, execution_mode, phase, approval_status, execution_status, created_at, updated_at
`

const updateDecisionIssueSQL = `
UPDATE issue SET
    project_id = $2,
    updated_at = now()
WHERE id = $1
RETURNING id, workspace_id, title, description, status, priority, assignee_type, assignee_id, creator_type, creator_id, parent_issue_id, acceptance_criteria, context_refs, position, due_date, created_at, updated_at, number, project_id
`

type DecisionResponse struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Description     *string `json:"description"`
	Status          string  `json:"status"`
	Priority        string  `json:"priority"`
	AssigneeType    *string `json:"assignee_type"`
	AssigneeID      *string `json:"assignee_id"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
	Domain          string  `json:"domain"`
	DecisionType    string  `json:"decision_type"`
	ObjectType      string  `json:"object_type"`
	ObjectID        string  `json:"object_id"`
	Objective       string  `json:"objective"`
	Constraints     string  `json:"constraints"`
	RiskLevel       string  `json:"risk_level"`
	ExecutionMode   string  `json:"execution_mode"`
	Phase           string  `json:"phase"`
	ApprovalStatus  string  `json:"approval_status"`
	ExecutionStatus string  `json:"execution_status"`
	ProjectID       *string `json:"project_id"`
}

type DecisionSnapshotSummary struct {
	ID         string `json:"id"`
	Source     string `json:"source"`
	SourceRef  string `json:"source_ref"`
	CapturedAt string `json:"captured_at"`
	CreatedAt  string `json:"created_at"`
}

type DecisionRecommendationSummary struct {
	ID               string  `json:"id"`
	ScenarioOptionID *string `json:"scenario_option_id"`
	Title            string  `json:"title"`
	ExpectedImpact   string  `json:"expected_impact"`
	CreatedAt        string  `json:"created_at"`
}

type DecisionApprovalSummary struct {
	ID           string `json:"id"`
	ApproverType string `json:"approver_type"`
	ApproverID   string `json:"approver_id"`
	Status       string `json:"status"`
	Comment      string `json:"comment"`
	SortOrder    int32  `json:"sort_order"`
	UpdatedAt    string `json:"updated_at"`
}

type DecisionDetailResponse struct {
	DecisionResponse
	LatestSnapshot       *DecisionSnapshotSummary       `json:"latest_snapshot,omitempty"`
	LatestRecommendation *DecisionRecommendationSummary `json:"latest_recommendation,omitempty"`
	LatestApproval       *DecisionApprovalSummary       `json:"latest_approval,omitempty"`
}

type CreateDecisionRequest struct {
	Title        string  `json:"title"`
	Description  *string `json:"description"`
	Priority     string  `json:"priority"`
	AssigneeType *string `json:"assignee_type"`
	AssigneeID   *string `json:"assignee_id"`

	Domain        string  `json:"domain"`
	DecisionType  string  `json:"decision_type"`
	ObjectType    string  `json:"object_type"`
	ObjectID      string  `json:"object_id"`
	Objective     string  `json:"objective"`
	Constraints   string  `json:"constraints"`
	RiskLevel     string  `json:"risk_level"`
	ExecutionMode string  `json:"execution_mode"`
	ProjectID     *string `json:"project_id"`
}

type UpdateDecisionRequest struct {
	Domain          *string `json:"domain"`
	DecisionType    *string `json:"decision_type"`
	ObjectType      *string `json:"object_type"`
	ObjectID        *string `json:"object_id"`
	Objective       *string `json:"objective"`
	Constraints     *string `json:"constraints"`
	RiskLevel       *string `json:"risk_level"`
	ExecutionMode   *string `json:"execution_mode"`
	Phase           *string `json:"phase"`
	ApprovalStatus  *string `json:"approval_status"`
	ExecutionStatus *string `json:"execution_status"`
	ProjectID       *string `json:"project_id"`
}

func decisionToResponse(issue db.Issue, decision db.DecisionCase) DecisionResponse {
	projectID := uuidToPtr(decision.ProjectID)
	if projectID == nil {
		projectID = uuidToPtr(issue.ProjectID)
	}

	return DecisionResponse{
		ID:              uuidToString(issue.ID),
		Title:           issue.Title,
		Description:     textToPtr(issue.Description),
		Status:          issue.Status,
		Priority:        issue.Priority,
		AssigneeType:    textToPtr(issue.AssigneeType),
		AssigneeID:      uuidToPtr(issue.AssigneeID),
		CreatedAt:       timestampToString(issue.CreatedAt),
		UpdatedAt:       timestampToString(issue.UpdatedAt),
		Domain:          decision.Domain,
		DecisionType:    decision.DecisionType,
		ObjectType:      decision.ObjectType,
		ObjectID:        decision.ObjectID,
		Objective:       decision.Objective,
		Constraints:     decision.Constraints,
		RiskLevel:       decision.RiskLevel,
		ExecutionMode:   decision.ExecutionMode,
		Phase:           decision.Phase,
		ApprovalStatus:  decision.ApprovalStatus,
		ExecutionStatus: decision.ExecutionStatus,
		ProjectID:       projectID,
	}
}

func decisionSnapshotToSummary(snapshot db.DecisionContextSnapshot) *DecisionSnapshotSummary {
	return &DecisionSnapshotSummary{
		ID:         uuidToString(snapshot.ID),
		Source:     snapshot.Source,
		SourceRef:  snapshot.SourceRef,
		CapturedAt: timestampToString(snapshot.CapturedAt),
		CreatedAt:  timestampToString(snapshot.CreatedAt),
	}
}

func decisionRecommendationToSummary(recommendation db.DecisionRecommendation) *DecisionRecommendationSummary {
	return &DecisionRecommendationSummary{
		ID:               uuidToString(recommendation.ID),
		ScenarioOptionID: uuidToPtr(recommendation.ScenarioOptionID),
		Title:            recommendation.Title,
		ExpectedImpact:   recommendation.ExpectedImpact,
		CreatedAt:        timestampToString(recommendation.CreatedAt),
	}
}

func decisionApprovalToSummary(approval db.DecisionApproval) *DecisionApprovalSummary {
	return &DecisionApprovalSummary{
		ID:           uuidToString(approval.ID),
		ApproverType: approval.ApproverType,
		ApproverID:   uuidToString(approval.ApproverID),
		Status:       approval.Status,
		Comment:      approval.Comment,
		SortOrder:    approval.SortOrder,
		UpdatedAt:    timestampToString(approval.UpdatedAt),
	}
}

func (h *Handler) countDecisionCases(ctx context.Context, workspaceID string, params db.ListDecisionCasesParams) int64 {
	if h.DB == nil {
		return 0
	}

	var total int64
	err := h.DB.QueryRow(ctx, countDecisionCasesSQL,
		parseUUID(workspaceID),
		params.Column2,
		params.Column3,
		params.Column4,
		params.Column5,
		params.Column6,
		params.Column7,
	).Scan(&total)
	if err != nil {
		return 0
	}
	return total
}

func (h *Handler) loadIssuesForDecisionCases(ctx context.Context, workspaceID string, decisions []db.DecisionCase) (map[string]db.Issue, error) {
	issues := make(map[string]db.Issue, len(decisions))
	for _, decision := range decisions {
		issue, err := h.Queries.GetIssueInWorkspace(ctx, db.GetIssueInWorkspaceParams{
			ID:          decision.IssueID,
			WorkspaceID: parseUUID(workspaceID),
		})
		if err != nil {
			return nil, err
		}
		issues[uuidToString(decision.IssueID)] = issue
	}
	return issues, nil
}

func (h *Handler) ListDecisions(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)

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
	offset := (page - 1) * pageSize

	riskFilter := r.URL.Query().Get("risk")
	if riskFilter == "" {
		riskFilter = r.URL.Query().Get("risk_level")
	}

	var projectID pgtype.UUID
	if projectFilter := r.URL.Query().Get("project_id"); projectFilter != "" {
		projectID = parseUUID(projectFilter)
	}

	params := db.ListDecisionCasesParams{
		WorkspaceID: parseUUID(workspaceID),
		Column2:     r.URL.Query().Get("phase"),
		Column3:     riskFilter,
		Column4:     r.URL.Query().Get("execution_mode"),
		Column5:     r.URL.Query().Get("decision_type"),
		Column6:     r.URL.Query().Get("object_type"),
		Column7:     projectID,
		Limit:       int32(pageSize),
		Offset:      int32(offset),
	}

	decisions, err := h.Queries.ListDecisionCases(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list decisions")
		return
	}

	issuesByID, err := h.loadIssuesForDecisionCases(r.Context(), workspaceID, decisions)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list decisions")
		return
	}

	total := h.countDecisionCases(r.Context(), workspaceID, params)
	if total == 0 {
		total = int64(len(decisions))
	}

	resp := make([]DecisionResponse, len(decisions))
	for i, decision := range decisions {
		issue := issuesByID[uuidToString(decision.IssueID)]
		resp[i] = decisionToResponse(issue, decision)
	}

	w.Header().Set("X-Total-Count", strconv.FormatInt(total, 10))
	writeJSON(w, http.StatusOK, map[string]any{
		"decisions": resp,
		"total":     total,
	})
}

func (h *Handler) GetDecision(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	id := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	issue, err := h.Queries.GetIssueInWorkspace(r.Context(), db.GetIssueInWorkspaceParams{
		ID:          parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	decision, err := h.Queries.GetDecisionCaseInWorkspace(r.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	resp := DecisionDetailResponse{
		DecisionResponse: decisionToResponse(issue, decision),
	}

	snapshots, err := h.Queries.ListDecisionContextSnapshots(r.Context(), db.ListDecisionContextSnapshotsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decision.IssueID,
		OffsetCount:    0,
		LimitCount:     1,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load decision")
		return
	}
	if len(snapshots) > 0 {
		resp.LatestSnapshot = decisionSnapshotToSummary(snapshots[0])
	}

	recommendations, err := h.Queries.ListDecisionRecommendations(r.Context(), db.ListDecisionRecommendationsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decision.IssueID,
		OffsetCount:    0,
		LimitCount:     1,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load decision")
		return
	}
	if len(recommendations) > 0 {
		resp.LatestRecommendation = decisionRecommendationToSummary(recommendations[0])
	}

	approvals, err := h.Queries.ListDecisionApprovals(r.Context(), db.ListDecisionApprovalsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decision.IssueID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load decision")
		return
	}
	if len(approvals) > 0 {
		resp.LatestApproval = decisionApprovalToSummary(approvals[len(approvals)-1])
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateDecision(w http.ResponseWriter, r *http.Request) {
	var req CreateDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	workspaceID := resolveWorkspaceID(r)
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create decision")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	issueNumber, err := qtx.IncrementIssueCounter(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create decision")
		return
	}

	creatorType, actualCreatorID := h.resolveActor(r, userID, workspaceID)

	priority := req.Priority
	if priority == "" {
		priority = "none"
	}
	riskLevel := req.RiskLevel
	if riskLevel == "" {
		riskLevel = "medium"
	}
	executionMode := req.ExecutionMode
	if executionMode == "" {
		executionMode = "manual"
	}

	var assigneeType pgtype.Text
	var assigneeID pgtype.UUID
	if req.AssigneeType != nil {
		assigneeType = pgtype.Text{String: *req.AssigneeType, Valid: true}
	}
	if req.AssigneeID != nil {
		assigneeID = parseUUID(*req.AssigneeID)
	}

	var projectID pgtype.UUID
	if req.ProjectID != nil {
		projectID = parseUUID(*req.ProjectID)
	}

	issue, err := qtx.CreateIssue(r.Context(), db.CreateIssueParams{
		WorkspaceID:   parseUUID(workspaceID),
		Title:         req.Title,
		Description:   ptrToText(req.Description),
		Status:        "todo",
		Priority:      priority,
		AssigneeType:  assigneeType,
		AssigneeID:    assigneeID,
		CreatorType:   creatorType,
		CreatorID:     parseUUID(actualCreatorID),
		Position:      0,
		Number:        issueNumber,
		ProjectID:     projectID,
		ParentIssueID: pgtype.UUID{},
		DueDate:       pgtype.Timestamptz{},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create decision")
		return
	}

	decision, err := qtx.CreateDecisionCase(r.Context(), db.CreateDecisionCaseParams{
		IssueID:         issue.ID,
		WorkspaceID:     issue.WorkspaceID,
		ProjectID:       projectID,
		Domain:          req.Domain,
		DecisionType:    req.DecisionType,
		ObjectType:      req.ObjectType,
		ObjectID:        req.ObjectID,
		Objective:       req.Objective,
		Constraints:     req.Constraints,
		RiskLevel:       riskLevel,
		ExecutionMode:   executionMode,
		Phase:           "identified",
		ApprovalStatus:  "draft",
		ExecutionStatus: "pending",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create decision")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create decision")
		return
	}

	resp := decisionToResponse(issue, decision)
	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: resp.ID,
		ActorType:      creatorType,
		ActorID:        actualCreatorID,
		Action:         "decision.created",
		TargetType:     "decision",
		TargetID:       resp.ID,
		OldState:       map[string]any{},
		NewState:       resp,
		Metadata:       map[string]any{"source": "api"},
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionCreated, workspaceID, creatorType, actualCreatorID, map[string]any{"decision": resp})
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) UpdateDecision(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	prevIssue, err := h.Queries.GetIssueInWorkspace(r.Context(), db.GetIssueInWorkspaceParams{
		ID:          parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	prevDecision, err := h.Queries.GetDecisionCaseInWorkspace(r.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	var req UpdateDecisionRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var rawFields map[string]json.RawMessage
	json.Unmarshal(bodyBytes, &rawFields)

	projectID := prevDecision.ProjectID
	issueProjectID := prevIssue.ProjectID
	if _, ok := rawFields["project_id"]; ok {
		if req.ProjectID != nil {
			projectID = parseUUID(*req.ProjectID)
			issueProjectID = parseUUID(*req.ProjectID)
		} else {
			projectID = pgtype.UUID{Valid: false}
			issueProjectID = pgtype.UUID{Valid: false}
		}
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update decision")
		return
	}
	defer tx.Rollback(r.Context())

	decision, err := updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:         prevDecision.IssueID,
		Domain:          ptrToNullableText(req.Domain),
		DecisionType:    ptrToNullableText(req.DecisionType),
		ObjectType:      ptrToNullableText(req.ObjectType),
		ObjectID:        ptrToNullableText(req.ObjectID),
		Objective:       ptrToNullableText(req.Objective),
		Constraints:     ptrToNullableText(req.Constraints),
		RiskLevel:       ptrToNullableText(req.RiskLevel),
		ExecutionMode:   ptrToNullableText(req.ExecutionMode),
		Phase:           ptrToNullableText(req.Phase),
		ApprovalStatus:  ptrToNullableText(req.ApprovalStatus),
		ExecutionStatus: ptrToNullableText(req.ExecutionStatus),
		ProjectID:       projectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update decision")
		return
	}

	issue, err := updateDecisionIssueRow(r.Context(), tx, prevIssue.ID, issueProjectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update decision")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update decision")
		return
	}

	oldState := decisionToResponse(prevIssue, prevDecision)
	resp := decisionToResponse(issue, decision)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: resp.ID,
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "decision.updated",
		TargetType:     "decision",
		TargetID:       resp.ID,
		OldState:       oldState,
		NewState:       resp,
		Metadata:       map[string]any{"source": "api"},
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventDecisionUpdated, workspaceID, actorType, actorID, map[string]any{"decision": resp})
	writeJSON(w, http.StatusOK, resp)
}

type decisionUpdateParams struct {
	IssueID         pgtype.UUID
	Domain          pgtype.Text
	DecisionType    pgtype.Text
	ObjectType      pgtype.Text
	ObjectID        pgtype.Text
	Objective       pgtype.Text
	Constraints     pgtype.Text
	RiskLevel       pgtype.Text
	ExecutionMode   pgtype.Text
	Phase           pgtype.Text
	ApprovalStatus  pgtype.Text
	ExecutionStatus pgtype.Text
	ProjectID       pgtype.UUID
}

func ptrToNullableText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func updateDecisionCaseRow(ctx context.Context, q dbExecutor, params decisionUpdateParams) (db.DecisionCase, error) {
	row := q.QueryRow(ctx, updateDecisionCaseSQL,
		params.IssueID,
		params.Domain,
		params.DecisionType,
		params.ObjectType,
		params.ObjectID,
		params.Objective,
		params.Constraints,
		params.RiskLevel,
		params.ExecutionMode,
		params.Phase,
		params.ApprovalStatus,
		params.ExecutionStatus,
		params.ProjectID,
	)

	var decision db.DecisionCase
	err := row.Scan(
		&decision.IssueID,
		&decision.WorkspaceID,
		&decision.ProjectID,
		&decision.Domain,
		&decision.DecisionType,
		&decision.ObjectType,
		&decision.ObjectID,
		&decision.Objective,
		&decision.Constraints,
		&decision.RiskLevel,
		&decision.ExecutionMode,
		&decision.Phase,
		&decision.ApprovalStatus,
		&decision.ExecutionStatus,
		&decision.CreatedAt,
		&decision.UpdatedAt,
	)
	return decision, err
}

func updateDecisionIssueRow(ctx context.Context, q dbExecutor, issueID, projectID pgtype.UUID) (db.Issue, error) {
	row := q.QueryRow(ctx, updateDecisionIssueSQL, issueID, projectID)

	var issue db.Issue
	err := row.Scan(
		&issue.ID,
		&issue.WorkspaceID,
		&issue.Title,
		&issue.Description,
		&issue.Status,
		&issue.Priority,
		&issue.AssigneeType,
		&issue.AssigneeID,
		&issue.CreatorType,
		&issue.CreatorID,
		&issue.ParentIssueID,
		&issue.AcceptanceCriteria,
		&issue.ContextRefs,
		&issue.Position,
		&issue.DueDate,
		&issue.CreatedAt,
		&issue.UpdatedAt,
		&issue.Number,
		&issue.ProjectID,
	)
	return issue, err
}
