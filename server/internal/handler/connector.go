package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	adapterpkg "github.com/multica-ai/multica/server/internal/connector"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

var validConnectorTypes = map[string]struct{}{
	"erp": {},
	"oms": {},
	"wms": {},
	"dwh": {},
	"bi":  {},
}

var validConnectorCapabilities = map[string]struct{}{
	"read":    {},
	"write":   {},
	"webhook": {},
}

type ConnectorResponse struct {
	ID             string          `json:"id"`
	WorkspaceID    string          `json:"workspace_id"`
	Name           string          `json:"name"`
	ConnectorType  string          `json:"connector_type"`
	BaseURL        string          `json:"base_url"`
	Capabilities   []string        `json:"capabilities"`
	AuthConfig     json.RawMessage `json:"auth_config"`
	AllowedActions []string        `json:"allowed_actions"`
	HealthStatus   string          `json:"health_status"`
	LastTestedAt   *string         `json:"last_tested_at"`
	CreatedAt      string          `json:"created_at"`
	UpdatedAt      string          `json:"updated_at"`
}

type ConnectorTestResponse struct {
	ConnectorID string `json:"connector_id"`
	Status      string `json:"status"`
	LatencyMs   int64  `json:"latency_ms"`
	Message     string `json:"message"`
	TestedAt    string `json:"tested_at"`
}

type CreateConnectorRequest struct {
	Name           string          `json:"name"`
	ConnectorType  string          `json:"connector_type"`
	BaseURL        string          `json:"base_url"`
	Capabilities   []string        `json:"capabilities"`
	AuthConfig     json.RawMessage `json:"auth_config"`
	AllowedActions []string        `json:"allowed_actions"`
}

func connectorToResponse(connector db.Connector) ConnectorResponse {
	authConfig := connector.Config
	if len(authConfig) == 0 {
		authConfig = []byte(`{}`)
	}

	return ConnectorResponse{
		ID:             uuidToString(connector.ID),
		WorkspaceID:    uuidToString(connector.WorkspaceID),
		Name:           connector.Name,
		ConnectorType:  connector.Kind,
		BaseURL:        connector.BaseUrl,
		Capabilities:   decodeConnectorCapabilities(connector.Capability),
		AuthConfig:     authConfig,
		AllowedActions: connector.AllowedActions,
		HealthStatus:   connector.HealthStatus,
		LastTestedAt:   timestampToPtr(connector.LastHealthCheck),
		CreatedAt:      timestampToString(connector.CreatedAt),
		UpdatedAt:      timestampToString(connector.UpdatedAt),
	}
}

func connectorIDParam(r *http.Request) string {
	if id := chi.URLParam(r, "connectorId"); id != "" {
		return id
	}
	return chi.URLParam(r, "id")
}

func isValidConnectorType(connectorType string) bool {
	_, ok := validConnectorTypes[connectorType]
	return ok
}

func decodeConnectorCapabilities(capability string) []string {
	switch capability {
	case "read_write":
		return []string{"read", "write"}
	case "":
		return nil
	default:
		return []string{capability}
	}
}

func encodeConnectorCapabilities(capabilities []string) (string, error) {
	if len(capabilities) == 0 {
		return "", errBadRequest("capabilities is required")
	}

	seen := make(map[string]struct{}, len(capabilities))
	hasRead := false
	hasWrite := false

	for _, capability := range capabilities {
		capability = strings.TrimSpace(capability)
		if capability == "" {
			return "", errBadRequest("capabilities contains an empty value")
		}
		if _, ok := validConnectorCapabilities[capability]; !ok {
			return "", errBadRequest("invalid capability: " + capability)
		}
		seen[capability] = struct{}{}
		hasRead = hasRead || capability == "read"
		hasWrite = hasWrite || capability == "write"
	}

	if len(seen) == 1 {
		for capability := range seen {
			return capability, nil
		}
	}

	if len(seen) == 2 && hasRead && hasWrite {
		return "read_write", nil
	}

	return "", errBadRequest("unsupported capability combination")
}

func normalizeAuthConfig(raw json.RawMessage) ([]byte, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return []byte(`{}`), nil
	}
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return []byte(`{}`), nil
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, errBadRequest("auth_config must be a JSON object")
	}

	normalized, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return normalized, nil
}

type badRequestError struct {
	message string
}

func (e badRequestError) Error() string {
	return e.message
}

func errBadRequest(message string) error {
	return badRequestError{message: message}
}

func isBadRequest(err error) (string, bool) {
	var target badRequestError
	if ok := errors.As(err, &target); ok {
		return target.message, true
	}
	return "", false
}

func (h *Handler) ListConnectors(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	params := db.ListConnectorsParams{
		WorkspaceID: parseUUID(workspaceID),
		LimitCount:  1000,
	}

	if connectorType := strings.TrimSpace(r.URL.Query().Get("connector_type")); connectorType != "" {
		if !isValidConnectorType(connectorType) {
			writeError(w, http.StatusBadRequest, "invalid connector_type")
			return
		}
		params.Kind = pgtype.Text{String: connectorType, Valid: true}
	}

	connectors, err := h.Queries.ListConnectors(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list connectors")
		return
	}

	resp := make([]ConnectorResponse, len(connectors))
	for i, connector := range connectors {
		resp[i] = connectorToResponse(connector)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"connectors": resp,
		"total":      len(resp),
	})
}

func (h *Handler) CreateConnector(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req CreateConnectorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	connectorType := strings.TrimSpace(req.ConnectorType)
	if !isValidConnectorType(connectorType) {
		writeError(w, http.StatusBadRequest, "invalid connector_type")
		return
	}

	capability, err := encodeConnectorCapabilities(req.Capabilities)
	if msg, ok := isBadRequest(err); ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to validate capabilities")
		return
	}

	authConfig, err := normalizeAuthConfig(req.AuthConfig)
	if msg, ok := isBadRequest(err); ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to validate auth_config")
		return
	}

	connector, err := h.Queries.CreateConnector(r.Context(), db.CreateConnectorParams{
		WorkspaceID:    parseUUID(workspaceID),
		Name:           name,
		Kind:           connectorType,
		BaseUrl:        strings.TrimSpace(req.BaseURL),
		Capability:     capability,
		Config:         authConfig,
		AllowedActions: req.AllowedActions,
		HealthStatus:   "unknown",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create connector")
		return
	}

	writeJSON(w, http.StatusCreated, connectorToResponse(connector))
}

func (h *Handler) GetConnector(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	connector, err := h.Queries.GetConnectorInWorkspace(r.Context(), db.GetConnectorInWorkspaceParams{
		ID:          parseUUID(connectorIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "connector not found")
		return
	}

	writeJSON(w, http.StatusOK, connectorToResponse(connector))
}

func (h *Handler) UpdateConnector(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	connectorID := connectorIDParam(r)
	current, err := h.Queries.GetConnectorInWorkspace(r.Context(), db.GetConnectorInWorkspaceParams{
		ID:          parseUUID(connectorID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "connector not found")
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	var rawFields map[string]json.RawMessage
	if err := json.Unmarshal(bodyBytes, &rawFields); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(rawFields) == 0 {
		writeError(w, http.StatusBadRequest, "at least one field is required")
		return
	}

	params := db.UpdateConnectorParams{ID: current.ID}

	if raw, ok := rawFields["name"]; ok {
		var name string
		if err := json.Unmarshal(raw, &name); err != nil {
			writeError(w, http.StatusBadRequest, "name must be a string")
			return
		}
		name = strings.TrimSpace(name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}
		params.Name = pgtype.Text{String: name, Valid: true}
	}

	if raw, ok := rawFields["connector_type"]; ok {
		var connectorType string
		if err := json.Unmarshal(raw, &connectorType); err != nil {
			writeError(w, http.StatusBadRequest, "connector_type must be a string")
			return
		}
		connectorType = strings.TrimSpace(connectorType)
		if !isValidConnectorType(connectorType) {
			writeError(w, http.StatusBadRequest, "invalid connector_type")
			return
		}
		params.Kind = pgtype.Text{String: connectorType, Valid: true}
	}

	if raw, ok := rawFields["base_url"]; ok {
		if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			params.BaseUrl = pgtype.Text{String: "", Valid: true}
		} else {
			var baseURL string
			if err := json.Unmarshal(raw, &baseURL); err != nil {
				writeError(w, http.StatusBadRequest, "base_url must be a string")
				return
			}
			params.BaseUrl = pgtype.Text{String: strings.TrimSpace(baseURL), Valid: true}
		}
	}

	if raw, ok := rawFields["capabilities"]; ok {
		var capabilities []string
		if err := json.Unmarshal(raw, &capabilities); err != nil {
			writeError(w, http.StatusBadRequest, "capabilities must be an array of strings")
			return
		}
		capability, err := encodeConnectorCapabilities(capabilities)
		if msg, ok := isBadRequest(err); ok {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to validate capabilities")
			return
		}
		params.Capability = pgtype.Text{String: capability, Valid: true}
	}

	if raw, ok := rawFields["auth_config"]; ok {
		authConfig, err := normalizeAuthConfig(raw)
		if msg, ok := isBadRequest(err); ok {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to validate auth_config")
			return
		}
		params.Config = authConfig
	}

	if raw, ok := rawFields["allowed_actions"]; ok {
		if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			params.AllowedActions = []string{}
		} else {
			var allowedActions []string
			if err := json.Unmarshal(raw, &allowedActions); err != nil {
				writeError(w, http.StatusBadRequest, "allowed_actions must be an array of strings")
				return
			}
			params.AllowedActions = allowedActions
		}
	}

	updated, err := h.Queries.UpdateConnector(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update connector")
		return
	}

	writeJSON(w, http.StatusOK, connectorToResponse(updated))
}

func (h *Handler) TestConnector(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	connector, err := h.Queries.GetConnectorInWorkspace(r.Context(), db.GetConnectorInWorkspaceParams{
		ID:          parseUUID(connectorIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "connector not found")
		return
	}

	adapter, err := adapterpkg.NewAdapter(connector.Kind)
	if err != nil {
		writeError(w, http.StatusBadRequest, "unsupported connector_type")
		return
	}

	result, err := adapter.TestConnection(r.Context(), connector)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to test connector")
		return
	}

	testedAt := pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	connector, err = h.Queries.RecordConnectorHealthCheck(r.Context(), db.RecordConnectorHealthCheckParams{
		ID:              connector.ID,
		HealthStatus:    result.Status,
		LastHealthCheck: testedAt,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update connector health")
		return
	}

	writeJSON(w, http.StatusOK, ConnectorTestResponse{
		ConnectorID: uuidToString(connector.ID),
		Status:      result.Status,
		LatencyMs:   result.LatencyMs,
		Message:     result.Message,
		TestedAt:    timestampToString(connector.LastHealthCheck),
	})
}
