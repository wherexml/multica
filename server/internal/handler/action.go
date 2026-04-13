package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type ActionRunResponse struct {
	ID              string  `json:"id"`
	DecisionCaseID  string  `json:"decision_case_id"`
	WorkspaceID     string  `json:"workspace_id"`
	IdempotencyKey  string  `json:"idempotency_key"`
	ConnectorID     *string `json:"connector_id"`
	ActionType      string  `json:"action_type"`
	RequestPayload  any     `json:"request_payload"`
	ExternalRef     string  `json:"external_ref"`
	RollbackPayload any     `json:"rollback_payload"`
	Status          string  `json:"status"`
	RuntimeID       *string `json:"runtime_id"`
	ErrorMessage    string  `json:"error_message"`
	StartedAt       *string `json:"started_at"`
	CompletedAt     *string `json:"completed_at"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

type ExecuteActionRequest struct {
	IdempotencyKey string         `json:"idempotency_key"`
	ConnectorID    *string        `json:"connector_id"`
	ActionType     string         `json:"action_type"`
	RequestPayload map[string]any `json:"request_payload"`
	RuntimeID      *string        `json:"runtime_id"`
}

type RollbackActionRequest struct {
	RollbackPayload map[string]any `json:"rollback_payload"`
}

func actionRunToResponse(action db.ActionRun) ActionRunResponse {
	return ActionRunResponse{
		ID:              uuidToString(action.ID),
		DecisionCaseID:  uuidToString(action.DecisionCaseID),
		WorkspaceID:     uuidToString(action.WorkspaceID),
		IdempotencyKey:  action.IdempotencyKey,
		ConnectorID:     uuidToPtr(action.ConnectorID),
		ActionType:      action.ActionType,
		RequestPayload:  jsonBytesToValue(action.RequestPayload, map[string]any{}),
		ExternalRef:     action.ExternalRef,
		RollbackPayload: jsonBytesToValue(action.RollbackPayload, map[string]any{}),
		Status:          action.Status,
		RuntimeID:       uuidToPtr(action.RuntimeID),
		ErrorMessage:    action.ErrorMessage,
		StartedAt:       timestampToPtr(action.StartedAt),
		CompletedAt:     timestampToPtr(action.CompletedAt),
		CreatedAt:       timestampToString(action.CreatedAt),
		UpdatedAt:       timestampToString(action.UpdatedAt),
	}
}

func marshalActionPayload(payload map[string]any) ([]byte, error) {
	if payload == nil {
		return []byte(`{}`), nil
	}
	return json.Marshal(payload)
}

func parseOptionalActionUUID(value *string) (pgtype.UUID, bool) {
	if value == nil {
		return pgtype.UUID{}, true
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return pgtype.UUID{}, true
	}

	parsed := parseUUID(trimmed)
	return parsed, parsed.Valid
}

func actionIdempotencyResponse(existing db.ActionRun, issue db.Issue, decision db.DecisionCase) map[string]any {
	return map[string]any{
		"action":   actionRunToResponse(existing),
		"decision": decisionToResponse(issue, decision),
	}
}

func (h *Handler) ExecuteAction(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req ExecuteActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	req.ActionType = strings.TrimSpace(req.ActionType)
	if req.IdempotencyKey == "" {
		writeError(w, http.StatusBadRequest, "idempotency_key is required")
		return
	}
	if req.ActionType == "" {
		writeError(w, http.StatusBadRequest, "action_type is required")
		return
	}

	connectorID, valid := parseOptionalActionUUID(req.ConnectorID)
	if !valid {
		writeError(w, http.StatusBadRequest, "connector_id is invalid")
		return
	}

	runtimeID, valid := parseOptionalActionUUID(req.RuntimeID)
	if !valid {
		writeError(w, http.StatusBadRequest, "runtime_id is invalid")
		return
	}

	requestPayload, err := marshalActionPayload(req.RequestPayload)
	if err != nil {
		writeError(w, http.StatusBadRequest, "request_payload must be a valid object")
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	issue, decision, err := getDecisionIssueAndCaseWithQueries(r, qtx, decisionID, workspaceID)
	if err != nil {
		if isNotFound(err) {
			writeError(w, http.StatusNotFound, "decision not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	existing, err := qtx.GetActionByIdempotencyKey(r.Context(), db.GetActionByIdempotencyKeyParams{
		WorkspaceID:    parseUUID(workspaceID),
		IdempotencyKey: req.IdempotencyKey,
	})
	if err == nil {
		if existing.DecisionCaseID != decision.IssueID {
			writeError(w, http.StatusConflict, "idempotency key is already used by another action")
			return
		}
		if existing.Status == "completed" {
			writeJSON(w, http.StatusOK, actionIdempotencyResponse(existing, issue, decision))
			return
		}
		if existing.Status == "running" {
			writeError(w, http.StatusConflict, "action is already running")
			return
		}
		writeError(w, http.StatusConflict, "idempotency key is already in use")
		return
	}
	if !isNotFound(err) {
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	if decision.Phase != "approved" {
		writeError(w, http.StatusConflict, "decision is not approved")
		return
	}
	if decision.ExecutionStatus == "running" {
		writeError(w, http.StatusConflict, "decision execution is already running")
		return
	}
	oldDecisionState := decisionToResponse(issue, decision)

	now := pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}

	actionRun, err := qtx.CreateActionRun(r.Context(), db.CreateActionRunParams{
		DecisionCaseID:  decision.IssueID,
		WorkspaceID:     parseUUID(workspaceID),
		IdempotencyKey:  req.IdempotencyKey,
		ConnectorID:     connectorID,
		ActionType:      req.ActionType,
		RequestPayload:  requestPayload,
		ExternalRef:     "",
		RollbackPayload: []byte(`{}`),
		Status:          "pending",
		RuntimeID:       runtimeID,
		ErrorMessage:    "",
		StartedAt:       now,
	})
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "idempotency key is already in use")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	decision, err = updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:         decision.IssueID,
		Phase:           strToText("executing"),
		ExecutionStatus: strToText("running"),
		ProjectID:       decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	actionRun, err = qtx.UpdateActionRun(r.Context(), db.UpdateActionRunParams{
		Status:      strToText("completed"),
		CompletedAt: now,
		ID:          actionRun.ID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	decision, err = updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:         decision.IssueID,
		ExecutionStatus: strToText("completed"),
		ProjectID:       decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to execute action")
		return
	}

	oldState := map[string]any{"decision": oldDecisionState}
	resp := map[string]any{
		"action":   actionRunToResponse(actionRun),
		"decision": decisionToResponse(issue, decision),
	}

	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: uuidToString(actionRun.DecisionCaseID),
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "action.executed",
		TargetType:     "action",
		TargetID:       uuidToString(actionRun.ID),
		OldState:       oldState,
		NewState:       resp,
		Metadata: map[string]any{
			"action_type": actionRun.ActionType,
			"status":      actionRun.Status,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventActionExecuted, workspaceID, actorType, actorID, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) RollbackAction(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req RollbackActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	rollbackPayload, err := marshalActionPayload(req.RollbackPayload)
	if err != nil {
		writeError(w, http.StatusBadRequest, "rollback_payload must be a valid object")
		return
	}

	actionID := chi.URLParam(r, "actionId")
	workspaceID := resolveWorkspaceID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rollback action")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	actionRun, err := qtx.GetActionRunInWorkspace(r.Context(), db.GetActionRunInWorkspaceParams{
		ID:          parseUUID(actionID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		if isNotFound(err) {
			writeError(w, http.StatusNotFound, "action not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to rollback action")
		return
	}
	if actionRun.Status != "completed" {
		writeError(w, http.StatusConflict, "only completed actions can be rolled back")
		return
	}

	issue, decision, err := getDecisionIssueAndCaseWithQueries(r, qtx, uuidToString(actionRun.DecisionCaseID), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rollback action")
		return
	}
	oldActionState := actionRunToResponse(actionRun)
	oldDecisionState := decisionToResponse(issue, decision)

	actionRun, err = qtx.UpdateActionRun(r.Context(), db.UpdateActionRunParams{
		RollbackPayload: rollbackPayload,
		Status:          strToText("rolled_back"),
		ID:              actionRun.ID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rollback action")
		return
	}

	decision, err = updateDecisionCaseRow(r.Context(), tx, decisionUpdateParams{
		IssueID:         decision.IssueID,
		ExecutionStatus: strToText("rolled_back"),
		ProjectID:       decision.ProjectID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rollback action")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rollback action")
		return
	}

	oldState := map[string]any{
		"action":   oldActionState,
		"decision": oldDecisionState,
	}
	resp := map[string]any{
		"action":   actionRunToResponse(actionRun),
		"decision": decisionToResponse(issue, decision),
	}

	ipAddress, userAgent := auditRequestContext(r)
	if err := h.recordAuditEvent(r.Context(), recordAuditParams{
		WorkspaceID:    workspaceID,
		DecisionCaseID: uuidToString(actionRun.DecisionCaseID),
		ActorType:      actorType,
		ActorID:        actorID,
		Action:         "action.rolled_back",
		TargetType:     "action",
		TargetID:       uuidToString(actionRun.ID),
		OldState:       oldState,
		NewState:       resp,
		Metadata: map[string]any{
			"action_type": actionRun.ActionType,
			"status":      actionRun.Status,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record audit event")
		return
	}
	h.publish(protocol.EventActionRolledBack, workspaceID, actorType, actorID, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListActions(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)

	if _, _, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID); !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	connectorFilter, valid := parseOptionalActionUUID(ptrOrNil(strings.TrimSpace(r.URL.Query().Get("connector_id"))))
	if !valid {
		writeError(w, http.StatusBadRequest, "connector_id is invalid")
		return
	}

	page, pageSize := parsePageAndSize(r)
	offset := (page - 1) * pageSize

	actions, err := h.Queries.ListActionRuns(r.Context(), db.ListActionRunsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionID),
		ConnectorID:    connectorFilter,
		Status:         strToText(strings.TrimSpace(r.URL.Query().Get("status"))),
		ActionType:     strToText(strings.TrimSpace(r.URL.Query().Get("action_type"))),
		OffsetCount:    int32(offset),
		LimitCount:     int32(pageSize),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list actions")
		return
	}

	resp := make([]ActionRunResponse, len(actions))
	for i, action := range actions {
		resp[i] = actionRunToResponse(action)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"actions":   resp,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *Handler) GetAction(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	actionID := chi.URLParam(r, "actionId")
	workspaceID := resolveWorkspaceID(r)

	actionRun, err := h.Queries.GetActionRunInWorkspace(r.Context(), db.GetActionRunInWorkspaceParams{
		ID:          parseUUID(actionID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		if isNotFound(err) {
			writeError(w, http.StatusNotFound, "action not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load action")
		return
	}

	writeJSON(w, http.StatusOK, actionRunToResponse(actionRun))
}

func ptrOrNil(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
