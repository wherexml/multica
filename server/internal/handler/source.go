package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	sourcepkg "github.com/multica-ai/multica/server/internal/source"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

var validSourceTypes = map[string]struct{}{
	"mcp":   {},
	"api":   {},
	"local": {},
}

type MCPSourceConfig = sourcepkg.MCPConfig

type SourceResponse struct {
	ID               string                     `json:"id"`
	WorkspaceID      string                     `json:"workspace_id"`
	RuntimeID        string                     `json:"runtime_id"`
	Name             string                     `json:"name"`
	SourceType       string                     `json:"source_type"`
	ConnectionStatus string                     `json:"connection_status"`
	ConnectionError  string                     `json:"connection_error"`
	LastTestMessage  string                     `json:"last_test_message"`
	LastTestedAt     *string                    `json:"last_tested_at"`
	MCP              *MCPSourceConfig           `json:"mcp,omitempty"`
	AuthState        SourceAuthStateResponse    `json:"auth_state"`
	ToolSummary      *SourceToolSummaryResponse `json:"tool_summary,omitempty"`
	LatestRun        *SourceRunResponse         `json:"latest_run,omitempty"`
	CreatedAt        string                     `json:"created_at"`
	UpdatedAt        string                     `json:"updated_at"`
}

type CreateSourceRequest struct {
	Name       string           `json:"name"`
	RuntimeID  string           `json:"runtime_id"`
	SourceType string           `json:"source_type"`
	MCP        *MCPSourceConfig `json:"mcp,omitempty"`
}

type UpdateSourceRequest struct {
	Name       *string          `json:"name"`
	RuntimeID  *string          `json:"runtime_id"`
	SourceType *string          `json:"source_type"`
	MCP        *MCPSourceConfig `json:"mcp,omitempty"`
}

func sourceIDParam(r *http.Request) string {
	if id := chi.URLParam(r, "sourceId"); id != "" {
		return id
	}
	return chi.URLParam(r, "id")
}

func normalizeSourceType(sourceType string) (string, error) {
	normalized := strings.TrimSpace(strings.ToLower(sourceType))
	if normalized == "" {
		normalized = "mcp"
	}
	if _, ok := validSourceTypes[normalized]; !ok {
		return "", errBadRequest("invalid source_type")
	}
	return normalized, nil
}

func marshalMCPConfig(raw *MCPSourceConfig) ([]byte, error) {
	if raw == nil {
		return nil, errBadRequest("mcp config is required")
	}
	if err := sourcepkg.ValidateMCPConfigShape(*raw); err != nil {
		return nil, errBadRequest(err.Error())
	}

	sanitized := sourcepkg.SanitizeMCPConfig(*raw)
	normalized, err := json.Marshal(sanitized)
	if err != nil {
		return nil, err
	}
	return normalized, nil
}

func (h *Handler) getRuntimeInWorkspace(r *http.Request, runtimeID, workspaceID string) (db.AgentRuntime, error) {
	return h.Queries.GetAgentRuntimeForWorkspace(r.Context(), db.GetAgentRuntimeForWorkspaceParams{
		ID:          parseUUID(runtimeID),
		WorkspaceID: parseUUID(workspaceID),
	})
}

func (h *Handler) ListSources(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	params := db.ListSourcesParams{
		WorkspaceID: parseUUID(workspaceID),
		LimitCount:  1000,
	}

	if sourceType := strings.TrimSpace(r.URL.Query().Get("source_type")); sourceType != "" {
		normalized, err := normalizeSourceType(sourceType)
		if err != nil {
			msg, _ := isBadRequest(err)
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		params.SourceType = pgtype.Text{String: normalized, Valid: true}
	}

	sources, err := h.Queries.ListSources(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list sources")
		return
	}

	resp := make([]SourceResponse, len(sources))
	for i, source := range sources {
		resp[i], err = h.buildSourceResponse(r.Context(), source)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to build source response")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"sources": resp,
		"total":   len(resp),
	})
}

func (h *Handler) CreateSource(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	var req CreateSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if strings.TrimSpace(req.RuntimeID) == "" {
		writeError(w, http.StatusBadRequest, "runtime_id is required")
		return
	}

	sourceType, err := normalizeSourceType(req.SourceType)
	if err != nil {
		msg, _ := isBadRequest(err)
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	if _, err := h.getRuntimeInWorkspace(r, req.RuntimeID, workspaceID); err != nil {
		writeError(w, http.StatusBadRequest, "runtime_id is invalid")
		return
	}

	var config []byte
	switch sourceType {
	case "mcp":
		config, err = marshalMCPConfig(req.MCP)
		if err != nil {
			msg, _ := isBadRequest(err)
			writeError(w, http.StatusBadRequest, msg)
			return
		}
	default:
		writeError(w, http.StatusBadRequest, "only mcp sources are supported right now")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create source")
		return
	}
	defer tx.Rollback(r.Context())
	qtx := h.Queries.WithTx(tx)

	created, err := qtx.CreateSource(r.Context(), db.CreateSourceParams{
		WorkspaceID:      parseUUID(workspaceID),
		RuntimeID:        parseUUID(req.RuntimeID),
		Name:             name,
		SourceType:       pgtype.Text{String: sourceType, Valid: true},
		Config:           config,
		ConnectionStatus: pgtype.Text{String: "untested", Valid: true},
		ConnectionError:  pgtype.Text{String: "", Valid: true},
		LastTestMessage:  pgtype.Text{String: "", Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create source")
		return
	}

	if err := h.syncSourceSecretWithConfig(r.Context(), qtx, created, req.MCP); err != nil {
		if msg, ok := isBadRequest(err); ok {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create source")
		return
	}

	resp, err := h.buildSourceResponse(r.Context(), created)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build source response")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) GetSource(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	resp, err := h.buildSourceResponse(r.Context(), source)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build source response")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) UpdateSource(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	existing, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	var req UpdateSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	name := existing.Name
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}
	}

	runtimeID := uuidToString(existing.RuntimeID)
	if req.RuntimeID != nil {
		runtimeID = strings.TrimSpace(*req.RuntimeID)
		if runtimeID == "" {
			writeError(w, http.StatusBadRequest, "runtime_id is required")
			return
		}
		if _, err := h.getRuntimeInWorkspace(r, runtimeID, workspaceID); err != nil {
			writeError(w, http.StatusBadRequest, "runtime_id is invalid")
			return
		}
	}

	sourceType := existing.SourceType
	if req.SourceType != nil {
		sourceType, err = normalizeSourceType(*req.SourceType)
		if err != nil {
			msg, _ := isBadRequest(err)
			writeError(w, http.StatusBadRequest, msg)
			return
		}
	}

	config := existing.Config
	switch sourceType {
	case "mcp":
		if req.MCP != nil {
			config, err = marshalMCPConfig(req.MCP)
			if err != nil {
				msg, _ := isBadRequest(err)
				writeError(w, http.StatusBadRequest, msg)
				return
			}
		} else if existing.SourceType != "mcp" {
			writeError(w, http.StatusBadRequest, "mcp config is required")
			return
		}
	default:
		writeError(w, http.StatusBadRequest, "only mcp sources are supported right now")
		return
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update source")
		return
	}
	defer tx.Rollback(r.Context())
	qtx := h.Queries.WithTx(tx)

	updated, err := qtx.UpdateSource(r.Context(), db.UpdateSourceParams{
		ID:         existing.ID,
		RuntimeID:  parseUUID(runtimeID),
		Name:       pgtype.Text{String: name, Valid: true},
		SourceType: pgtype.Text{String: sourceType, Valid: true},
		Config:     config,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update source")
		return
	}

	if req.MCP != nil {
		if err := h.syncSourceSecretWithConfig(r.Context(), qtx, updated, req.MCP); err != nil {
			if msg, ok := isBadRequest(err); ok {
				writeError(w, http.StatusBadRequest, msg)
				return
			}
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update source")
		return
	}

	resp, err := h.buildSourceResponse(r.Context(), updated)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build source response")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) DeleteSource(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	if err := h.Queries.DeleteSource(r.Context(), source.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete source")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) TestSource(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	runtime, err := h.getRuntimeInWorkspace(r, uuidToString(source.RuntimeID), workspaceID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bound runtime is invalid")
		return
	}

	config, err := decodeSourceMCPConfig(source)
	if err != nil {
		writeError(w, http.StatusBadRequest, "source config is invalid")
		return
	}
	if source.SourceType != "mcp" || config == nil {
		writeError(w, http.StatusBadRequest, "only mcp sources are supported right now")
		return
	}

	secretPayload, _, err := h.decryptSourceSecret(r.Context(), source)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if runtime.Status != "online" {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "test", "", "failed", map[string]any{
			"action": "test",
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusFailed,
			Message:          "绑定的执行环境当前离线，无法完成连接测试",
			ErrorMessage:     "绑定的执行环境当前离线，无法完成连接测试",
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record source test")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	authType := strings.ToLower(strings.TrimSpace(config.AuthType))
	if authType == "bearer" && (secretPayload == nil || secretPayload.Bearer == nil || strings.TrimSpace(secretPayload.Bearer.Token) == "") {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "test", "", "blocked", map[string]any{
			"action": "test",
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusNeedsAuth,
			Message:          "还缺少 Bearer Token，请先补充认证信息",
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record source test")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}
	if authType == "oauth" && (secretPayload == nil || secretPayload.OAuth == nil || strings.TrimSpace(secretPayload.OAuth.AccessToken) == "") {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "test", "", "blocked", map[string]any{
			"action": "test",
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusNeedsAuth,
			Message:          "还缺少 OAuth token bundle，请先补充认证信息",
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record source test")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	run, err := h.enqueueSourceRun(r.Context(), source, "test", "", map[string]any{
		"action": "test",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to queue source test")
		return
	}

	writeJSON(w, http.StatusOK, sourceRunToResponse(run))
}

func (h *Handler) GetSourceTools(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	tools, err := h.Queries.ListSourceToolsBySource(r.Context(), source.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list source tools")
		return
	}

	resp := make([]SourceToolResponse, len(tools))
	for i, tool := range tools {
		resp[i] = sourceToolToResponse(tool)
	}
	writeJSON(w, http.StatusOK, map[string]any{"tools": resp})
}

func (h *Handler) RefreshSourceTools(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	runtime, err := h.getRuntimeInWorkspace(r, uuidToString(source.RuntimeID), workspaceID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bound runtime is invalid")
		return
	}

	config, err := decodeSourceMCPConfig(source)
	if err != nil {
		writeError(w, http.StatusBadRequest, "source config is invalid")
		return
	}
	if source.SourceType != "mcp" || config == nil {
		writeError(w, http.StatusBadRequest, "only mcp sources are supported right now")
		return
	}

	secretPayload, _, err := h.decryptSourceSecret(r.Context(), source)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if runtime.Status != "online" {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "discover_tools", "", "failed", map[string]any{
			"action": "discover_tools",
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusFailed,
			Message:          "绑定的执行环境当前离线，无法刷新工具列表",
			ErrorMessage:     "绑定的执行环境当前离线，无法刷新工具列表",
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool refresh")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	authType := strings.ToLower(strings.TrimSpace(config.AuthType))
	if authType == "bearer" && (secretPayload == nil || secretPayload.Bearer == nil || strings.TrimSpace(secretPayload.Bearer.Token) == "") {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "discover_tools", "", "blocked", map[string]any{
			"action": "discover_tools",
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusNeedsAuth,
			Message:          "还缺少 Bearer Token，请先补充认证信息",
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool refresh")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}
	if authType == "oauth" && (secretPayload == nil || secretPayload.OAuth == nil || strings.TrimSpace(secretPayload.OAuth.AccessToken) == "") {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "discover_tools", "", "blocked", map[string]any{
			"action": "discover_tools",
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusNeedsAuth,
			Message:          "还缺少 OAuth token bundle，请先补充认证信息",
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool refresh")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	run, err := h.enqueueSourceRun(r.Context(), source, "discover_tools", "", map[string]any{
		"action": "discover_tools",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to queue tool refresh")
		return
	}
	writeJSON(w, http.StatusOK, sourceRunToResponse(run))
}

func (h *Handler) CallSourceTool(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	var req SourceToolCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if req.Arguments == nil {
		req.Arguments = map[string]any{}
	}

	toolName := strings.TrimSpace(chi.URLParam(r, "toolName"))
	if toolName == "" {
		writeError(w, http.StatusBadRequest, "tool name is required")
		return
	}

	tools, err := h.Queries.ListSourceToolsBySource(r.Context(), source.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load source tools")
		return
	}

	var selected *db.SourceTool
	for i := range tools {
		if tools[i].Name == toolName {
			selected = &tools[i]
			break
		}
	}
	if selected == nil {
		writeError(w, http.StatusNotFound, "tool not found")
		return
	}
	if selected.Safety != string(sourcepkg.ToolSafetyReadOnly) {
		reason := "这个工具当前被禁止执行，因为它不是只读工具"
		if selected.Safety == string(sourcepkg.ToolSafetyUnknown) {
			reason = "这个工具当前被禁止执行，因为它的安全级别还不明确"
		}
		run, err := h.recordImmediateSourceRun(r.Context(), source, "call_tool", toolName, "blocked", map[string]any{
			"arguments": req.Arguments,
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusConnected,
			Message:          reason,
			ErrorMessage:     reason,
			ToolName:         toolName,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool block")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	runtime, err := h.getRuntimeInWorkspace(r, uuidToString(source.RuntimeID), workspaceID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bound runtime is invalid")
		return
	}
	if runtime.Status != "online" {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "call_tool", toolName, "failed", map[string]any{
			"arguments": req.Arguments,
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusFailed,
			Message:          "绑定的执行环境当前离线，无法运行工具",
			ErrorMessage:     "绑定的执行环境当前离线，无法运行工具",
			ToolName:         toolName,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool call")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	config, err := decodeSourceMCPConfig(source)
	if err != nil {
		writeError(w, http.StatusBadRequest, "source config is invalid")
		return
	}
	secretPayload, _, err := h.decryptSourceSecret(r.Context(), source)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	authType := strings.ToLower(strings.TrimSpace(config.AuthType))
	if authType == "bearer" && (secretPayload == nil || secretPayload.Bearer == nil || strings.TrimSpace(secretPayload.Bearer.Token) == "") {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "call_tool", toolName, "blocked", map[string]any{
			"arguments": req.Arguments,
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusNeedsAuth,
			Message:          "还缺少 Bearer Token，请先补充认证信息",
			ToolName:         toolName,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool call")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}
	if authType == "oauth" && (secretPayload == nil || secretPayload.OAuth == nil || strings.TrimSpace(secretPayload.OAuth.AccessToken) == "") {
		run, err := h.recordImmediateSourceRun(r.Context(), source, "call_tool", toolName, "blocked", map[string]any{
			"arguments": req.Arguments,
		}, sourcepkg.OperationOutcome{
			ConnectionStatus: sourcepkg.ConnectionStatusNeedsAuth,
			Message:          "还缺少 OAuth token bundle，请先补充认证信息",
			ToolName:         toolName,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record tool call")
			return
		}
		writeJSON(w, http.StatusOK, sourceRunToResponse(run))
		return
	}

	run, err := h.enqueueSourceRun(r.Context(), source, "call_tool", toolName, map[string]any{
		"arguments": req.Arguments,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to queue tool call")
		return
	}
	writeJSON(w, http.StatusOK, sourceRunToResponse(run))
}

func (h *Handler) UpdateSourceAuth(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	var req UpdateSourceAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	payload, err := buildAuthPayload(req)
	if err != nil {
		if msg, ok := isBadRequest(err); ok {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if payload.AuthType == "none" {
		if err := h.Queries.DeleteSourceSecret(r.Context(), source.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to clear source auth")
			return
		}
		writeJSON(w, http.StatusOK, SourceAuthStateResponse{
			AuthType:   "none",
			Configured: true,
			Preview:    "",
		})
		return
	}

	secret, err := h.updateSourceAuth(r.Context(), source, payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	config, _ := decodeSourceMCPConfig(source)
	writeJSON(w, http.StatusOK, sourceAuthStateFromConfig(config, secret))
}

func (h *Handler) DeleteSourceAuth(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if _, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found"); !ok {
		return
	}

	source, err := h.Queries.GetSourceInWorkspace(r.Context(), db.GetSourceInWorkspaceParams{
		ID:          parseUUID(sourceIDParam(r)),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source not found")
		return
	}

	if err := h.Queries.DeleteSourceSecret(r.Context(), source.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear source auth")
		return
	}

	writeJSON(w, http.StatusOK, SourceAuthStateResponse{
		AuthType:   "none",
		Configured: true,
		Preview:    "",
	})
}

func (h *Handler) GetSourceRun(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	workspaceID := resolveWorkspaceID(r)
	run, err := h.Queries.GetSourceRunInWorkspace(r.Context(), db.GetSourceRunInWorkspaceParams{
		ID:          parseUUID(chi.URLParam(r, "runId")),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "source run not found")
		return
	}
	if uuidToString(run.SourceID) != sourceIDParam(r) {
		writeError(w, http.StatusNotFound, "source run not found")
		return
	}

	writeJSON(w, http.StatusOK, sourceRunToResponse(run))
}

func normalizeSourceConfig(raw []byte) ([]byte, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return []byte(`{}`), nil
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, errBadRequest("config must be a JSON object")
	}
	normalized, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return normalized, nil
}

func parseSourceConfig(raw []byte) ([]byte, error) {
	normalized, err := normalizeSourceConfig(raw)
	if err != nil {
		return nil, err
	}
	if bytes.Equal(bytes.TrimSpace(normalized), []byte("null")) {
		return []byte(`{}`), nil
	}
	return normalized, nil
}

func isSourceBadRequest(err error) (string, bool) {
	var target badRequestError
	if errors.As(err, &target) {
		return target.message, true
	}
	return "", false
}
