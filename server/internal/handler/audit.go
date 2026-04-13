package handler

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type AuditEventResponse struct {
	ID             string `json:"id"`
	WorkspaceID    string `json:"workspace_id"`
	DecisionCaseID string `json:"decision_case_id"`
	ActorType      string `json:"actor_type"`
	ActorID        string `json:"actor_id"`
	Action         string `json:"action"`
	TargetType     string `json:"target_type"`
	TargetID       string `json:"target_id"`
	OldState       any    `json:"old_state"`
	NewState       any    `json:"new_state"`
	Metadata       any    `json:"metadata"`
	IPAddress      string `json:"ip_address"`
	UserAgent      string `json:"user_agent"`
	CreatedAt      string `json:"created_at"`
}

type recordAuditParams struct {
	WorkspaceID    string
	DecisionCaseID string
	ActorType      string
	ActorID        string
	Action         string
	TargetType     string
	TargetID       string
	OldState       any
	NewState       any
	Metadata       any
	IPAddress      string
	UserAgent      string
}

func auditEventToResponse(event db.AuditEvent) AuditEventResponse {
	return AuditEventResponse{
		ID:             uuidToString(event.ID),
		WorkspaceID:    uuidToString(event.WorkspaceID),
		DecisionCaseID: uuidToString(event.DecisionCaseID),
		ActorType:      event.ActorType,
		ActorID:        uuidToString(event.ActorID),
		Action:         event.Action,
		TargetType:     event.TargetType,
		TargetID:       uuidToString(event.TargetID),
		OldState:       jsonBytesToValue(event.OldState, map[string]any{}),
		NewState:       jsonBytesToValue(event.NewState, map[string]any{}),
		Metadata:       jsonBytesToValue(event.Metadata, map[string]any{}),
		IPAddress:      event.IpAddress,
		UserAgent:      event.UserAgent,
		CreatedAt:      timestampToString(event.CreatedAt),
	}
}

func marshalAuditValue(value any) ([]byte, error) {
	if value == nil {
		return []byte(`{}`), nil
	}

	switch typed := value.(type) {
	case []byte:
		if len(typed) == 0 {
			return []byte(`{}`), nil
		}
		return typed, nil
	case json.RawMessage:
		if len(typed) == 0 {
			return []byte(`{}`), nil
		}
		return typed, nil
	default:
		return json.Marshal(value)
	}
}

func requestIPAddress(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return host
	}

	return strings.TrimSpace(r.RemoteAddr)
}

func auditRequestContext(r *http.Request) (string, string) {
	return requestIPAddress(r), strings.TrimSpace(r.Header.Get("User-Agent"))
}

func (h *Handler) recordAuditEvent(ctx context.Context, params recordAuditParams) error {
	oldState, err := marshalAuditValue(params.OldState)
	if err != nil {
		return err
	}
	newState, err := marshalAuditValue(params.NewState)
	if err != nil {
		return err
	}
	metadata, err := marshalAuditValue(params.Metadata)
	if err != nil {
		return err
	}

	_, err = h.Queries.CreateAuditEvent(ctx, db.CreateAuditEventParams{
		WorkspaceID:    parseUUID(params.WorkspaceID),
		DecisionCaseID: parseUUID(params.DecisionCaseID),
		ActorType:      strToText(strings.TrimSpace(params.ActorType)),
		ActorID:        parseUUID(params.ActorID),
		Action:         strings.TrimSpace(params.Action),
		TargetType:     strToText(strings.TrimSpace(params.TargetType)),
		TargetID:       parseUUID(params.TargetID),
		OldState:       oldState,
		NewState:       newState,
		Metadata:       metadata,
		IpAddress:      strToText(strings.TrimSpace(params.IPAddress)),
		UserAgent:      strToText(strings.TrimSpace(params.UserAgent)),
	})
	return err
}

func (h *Handler) ListAuditTrail(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	decisionID := chi.URLParam(r, "id")
	workspaceID := resolveWorkspaceID(r)
	if _, _, ok := h.getDecisionIssueAndCase(r, decisionID, workspaceID); !ok {
		writeError(w, http.StatusNotFound, "decision not found")
		return
	}

	actorIDFilter, valid := parseOptionalActionUUID(ptrOrNil(strings.TrimSpace(r.URL.Query().Get("actor_id"))))
	if !valid {
		writeError(w, http.StatusBadRequest, "actor_id is invalid")
		return
	}

	page, pageSize := parsePageAndSize(r)
	offset := (page - 1) * pageSize
	actionFilter := strings.TrimSpace(r.URL.Query().Get("action"))
	actorTypeFilter := strings.TrimSpace(r.URL.Query().Get("actor_type"))

	total, err := h.Queries.CountAuditEvents(r.Context(), db.CountAuditEventsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionID),
		Action:         strToText(actionFilter),
		ActorType:      strToText(actorTypeFilter),
		ActorID:        actorIDFilter,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit trail")
		return
	}

	events, err := h.Queries.ListAuditEvents(r.Context(), db.ListAuditEventsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionID),
		Action:         strToText(actionFilter),
		ActorType:      strToText(actorTypeFilter),
		ActorID:        actorIDFilter,
		LimitCount:     int32(pageSize),
		OffsetCount:    int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit trail")
		return
	}

	resp := make([]AuditEventResponse, len(events))
	for i, event := range events {
		resp[i] = auditEventToResponse(event)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"events":    resp,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *Handler) ListWorkspaceAuditEvents(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	decisionCaseIDFilter, valid := parseOptionalActionUUID(ptrOrNil(strings.TrimSpace(r.URL.Query().Get("decision_case_id"))))
	if !valid {
		writeError(w, http.StatusBadRequest, "decision_case_id is invalid")
		return
	}

	actorIDFilter, valid := parseOptionalActionUUID(ptrOrNil(strings.TrimSpace(r.URL.Query().Get("actor_id"))))
	if !valid {
		writeError(w, http.StatusBadRequest, "actor_id is invalid")
		return
	}

	page, pageSize := parsePageAndSize(r)
	offset := (page - 1) * pageSize
	actionFilter := strings.TrimSpace(r.URL.Query().Get("action"))
	actorTypeFilter := strings.TrimSpace(r.URL.Query().Get("actor_type"))
	targetTypeFilter := strings.TrimSpace(r.URL.Query().Get("target_type"))

	total, err := h.Queries.CountAuditEvents(r.Context(), db.CountAuditEventsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decisionCaseIDFilter,
		Action:         strToText(actionFilter),
		ActorType:      strToText(actorTypeFilter),
		ActorID:        actorIDFilter,
		TargetType:     strToText(targetTypeFilter),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit events")
		return
	}

	events, err := h.Queries.ListAuditEvents(r.Context(), db.ListAuditEventsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: decisionCaseIDFilter,
		Action:         strToText(actionFilter),
		ActorType:      strToText(actorTypeFilter),
		ActorID:        actorIDFilter,
		TargetType:     strToText(targetTypeFilter),
		LimitCount:     int32(pageSize),
		OffsetCount:    int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit events")
		return
	}

	resp := make([]AuditEventResponse, len(events))
	for i, event := range events {
		resp[i] = auditEventToResponse(event)
	}

	w.Header().Set("X-Total-Count", strconv.FormatInt(total, 10))
	writeJSON(w, http.StatusOK, map[string]any{
		"events":    resp,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *Handler) GetAuditEvent(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	eventID := chi.URLParam(r, "eventId")

	event, err := h.Queries.GetAuditEvent(r.Context(), parseUUID(eventID))
	if err != nil {
		if isNotFound(err) {
			writeError(w, http.StatusNotFound, "audit event not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load audit event")
		return
	}

	if uuidToString(event.WorkspaceID) != workspaceID {
		writeError(w, http.StatusNotFound, "audit event not found")
		return
	}

	writeJSON(w, http.StatusOK, auditEventToResponse(event))
}
