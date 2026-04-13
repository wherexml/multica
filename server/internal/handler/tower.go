package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type TowerAlertResponse struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Severity    string  `json:"severity"`
	Title       string  `json:"title"`
	Body        *string `json:"body"`
	IssueID     *string `json:"issue_id"`
	IssueStatus *string `json:"issue_status"`
	CreatedAt   string  `json:"created_at"`
	Domain      string  `json:"domain"`
	RiskLevel   string  `json:"risk_level"`
}

type towerAlertDetails struct {
	Domain     string          `json:"domain"`
	RiskLevel  string          `json:"risk_level"`
	ObjectType string          `json:"object_type"`
	ObjectID   string          `json:"object_id"`
	Metrics    json.RawMessage `json:"metrics"`
}

func towerAlertToResponse(alert db.ListTowerAlertsRow) TowerAlertResponse {
	return TowerAlertResponse{
		ID:          uuidToString(alert.ID),
		Type:        alert.Type,
		Severity:    alert.Severity,
		Title:       alert.Title,
		Body:        textToPtr(alert.Body),
		IssueID:     uuidToPtr(alert.IssueID),
		IssueStatus: textToPtr(alert.IssueStatus),
		CreatedAt:   timestampToString(alert.CreatedAt),
		Domain:      alert.Domain,
		RiskLevel:   alert.RiskLevel,
	}
}

func parseListPage(r *http.Request, defaultPageSize int) (page int, pageSize int, offset int, ok bool) {
	page = 1
	if rawPage := r.URL.Query().Get("page"); rawPage != "" {
		parsed, err := strconv.Atoi(rawPage)
		if err != nil || parsed < 1 {
			return 0, 0, 0, false
		}
		page = parsed
	}

	pageSize = defaultPageSize
	if rawPageSize := r.URL.Query().Get("page_size"); rawPageSize != "" {
		parsed, err := strconv.Atoi(rawPageSize)
		if err != nil || parsed < 1 {
			return 0, 0, 0, false
		}
		pageSize = parsed
	}

	offset = (page - 1) * pageSize
	return page, pageSize, offset, true
}

func parseOptionalText(value string) pgtype.Text {
	if value == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: value, Valid: true}
}

func parseTowerAlertDetails(raw []byte) towerAlertDetails {
	if len(raw) == 0 {
		return towerAlertDetails{}
	}

	var details towerAlertDetails
	if err := json.Unmarshal(raw, &details); err != nil {
		return towerAlertDetails{}
	}
	return details
}

func towerRiskLevelFromSeverity(severity string) string {
	switch severity {
	case "action_required":
		return "high"
	case "attention":
		return "medium"
	default:
		return "low"
	}
}

func textValue(value pgtype.Text) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func towerSnapshotMetrics(alert db.InboxItem, issue db.Issue, details towerAlertDetails, resolvedRisk string) ([]byte, error) {
	payload := map[string]any{
		"alert": map[string]any{
			"id":         uuidToString(alert.ID),
			"type":       alert.Type,
			"severity":   alert.Severity,
			"title":      alert.Title,
			"body":       textValue(alert.Body),
			"domain":     details.Domain,
			"risk_level": resolvedRisk,
			"object": map[string]any{
				"type": details.ObjectType,
				"id":   details.ObjectID,
			},
		},
		"issue": map[string]any{
			"id":         uuidToString(issue.ID),
			"title":      issue.Title,
			"status":     issue.Status,
			"priority":   issue.Priority,
			"project_id": uuidToPtr(issue.ProjectID),
		},
	}

	if len(alert.Details) > 0 {
		var detailsPayload map[string]any
		if err := json.Unmarshal(alert.Details, &detailsPayload); err == nil && len(detailsPayload) > 0 {
			payload["details"] = detailsPayload
		}
	}

	return json.Marshal(payload)
}

func (h *Handler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	_, pageSize, offset, ok := parseListPage(r, 50)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid pagination parameters")
		return
	}

	workspaceID := resolveWorkspaceID(r)
	params := db.ListTowerAlertsParams{
		WorkspaceID: parseUUID(workspaceID),
		Severity:    parseOptionalText(r.URL.Query().Get("severity")),
		Domain:      parseOptionalText(r.URL.Query().Get("domain")),
		RiskLevel:   parseOptionalText(r.URL.Query().Get("risk_level")),
		LimitCount:  int32(pageSize),
		OffsetCount: int32(offset),
	}

	alerts, err := h.Queries.ListTowerAlerts(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list alerts")
		return
	}

	total, err := h.Queries.CountTowerAlerts(r.Context(), db.CountTowerAlertsParams{
		WorkspaceID: params.WorkspaceID,
		Severity:    params.Severity,
		Domain:      params.Domain,
		RiskLevel:   params.RiskLevel,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list alerts")
		return
	}

	resp := make([]TowerAlertResponse, len(alerts))
	for i, alert := range alerts {
		resp[i] = towerAlertToResponse(alert)
	}

	w.Header().Set("X-Total-Count", strconv.FormatInt(total, 10))
	writeJSON(w, http.StatusOK, map[string]any{
		"alerts": resp,
		"total":  total,
	})
}

func (h *Handler) AlertToDecision(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	alertID := chi.URLParam(r, "alertId")

	alert, err := h.Queries.GetInboxItemInWorkspace(r.Context(), db.GetInboxItemInWorkspaceParams{
		ID:          parseUUID(alertID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "alert not found")
		return
	}
	if !alert.IssueID.Valid {
		writeError(w, http.StatusBadRequest, "alert is not linked to an issue")
		return
	}
	if alert.Severity != "action_required" && alert.Severity != "attention" {
		writeError(w, http.StatusBadRequest, "alert cannot be converted to a decision")
		return
	}

	issue, err := h.Queries.GetIssueInWorkspace(r.Context(), db.GetIssueInWorkspaceParams{
		ID:          alert.IssueID,
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "issue not found")
		return
	}

	existing, err := h.Queries.GetDecisionCaseInWorkspace(r.Context(), db.GetDecisionCaseInWorkspaceParams{
		IssueID:     alert.IssueID,
		WorkspaceID: parseUUID(workspaceID),
	})
	if err == nil {
		writeJSON(w, http.StatusOK, decisionToResponse(issue, existing))
		return
	}
	if !isNotFound(err) {
		writeError(w, http.StatusInternalServerError, "failed to convert alert to decision")
		return
	}

	details := parseTowerAlertDetails(alert.Details)
	objectType := details.ObjectType
	if objectType == "" {
		objectType = "issue"
	}
	objectID := details.ObjectID
	if objectID == "" {
		objectID = uuidToString(issue.ID)
	}

	riskLevel := towerRiskLevelFromSeverity(alert.Severity)
	snapshotMetrics, err := towerSnapshotMetrics(alert, issue, details, riskLevel)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to convert alert to decision")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to convert alert to decision")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	decision, err := qtx.CreateDecisionCase(r.Context(), db.CreateDecisionCaseParams{
		IssueID:         issue.ID,
		WorkspaceID:     issue.WorkspaceID,
		ProjectID:       issue.ProjectID,
		Domain:          details.Domain,
		DecisionType:    alert.Type,
		ObjectType:      objectType,
		ObjectID:        objectID,
		Objective:       alert.Title,
		Constraints:     textValue(alert.Body),
		RiskLevel:       riskLevel,
		ExecutionMode:   "manual",
		Phase:           "identified",
		ApprovalStatus:  "draft",
		ExecutionStatus: "pending",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to convert alert to decision")
		return
	}

	_, err = qtx.CreateDecisionContextSnapshot(r.Context(), db.CreateDecisionContextSnapshotParams{
		DecisionCaseID: decision.IssueID,
		WorkspaceID:    decision.WorkspaceID,
		Source:         "tower_alert",
		SourceRef:      alertID,
		Metrics:        snapshotMetrics,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to convert alert to decision")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to convert alert to decision")
		return
	}

	resp := decisionToResponse(issue, decision)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	h.publish(protocol.EventDecisionCreated, workspaceID, actorType, actorID, map[string]any{"decision": resp})
	writeJSON(w, http.StatusCreated, resp)
}
