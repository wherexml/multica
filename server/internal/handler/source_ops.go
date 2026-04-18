package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	sourcepkg "github.com/multica-ai/multica/server/internal/source"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type SourceAuthStateResponse struct {
	AuthType   string  `json:"auth_type"`
	Configured bool    `json:"configured"`
	Preview    string  `json:"preview"`
	UpdatedAt  *string `json:"updated_at"`
}

type SourceToolSummaryResponse struct {
	Total      int     `json:"total"`
	ReadOnly   int     `json:"read_only"`
	Write      int     `json:"write"`
	Unknown    int     `json:"unknown"`
	LastSeenAt *string `json:"last_seen_at"`
}

type SourceToolResponse struct {
	ID          string         `json:"id"`
	SourceID    string         `json:"source_id"`
	WorkspaceID string         `json:"workspace_id"`
	Name        string         `json:"name"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Safety      string         `json:"safety"`
	InputSchema map[string]any `json:"input_schema"`
	Annotations map[string]any `json:"annotations"`
	LastSeenAt  string         `json:"last_seen_at"`
	CreatedAt   string         `json:"created_at"`
	UpdatedAt   string         `json:"updated_at"`
}

type SourceRunResponse struct {
	ID             string  `json:"id"`
	SourceID       string  `json:"source_id"`
	WorkspaceID    string  `json:"workspace_id"`
	RuntimeID      string  `json:"runtime_id"`
	RunType        string  `json:"run_type"`
	Status         string  `json:"status"`
	ToolName       string  `json:"tool_name"`
	RequestPayload any     `json:"request_payload"`
	ResultPayload  any     `json:"result_payload"`
	Summary        string  `json:"summary"`
	ErrorMessage   string  `json:"error_message"`
	StartedAt      *string `json:"started_at"`
	CompletedAt    *string `json:"completed_at"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type UpdateSourceAuthRequest struct {
	AuthType    string                        `json:"auth_type"`
	BearerToken string                        `json:"bearer_token,omitempty"`
	OAuth       *sourcepkg.OAuthSecretPayload `json:"oauth,omitempty"`
}

type SourceToolCallRequest struct {
	Arguments map[string]any `json:"arguments"`
}

type DaemonSourceAuthPayload struct {
	AuthType    string                        `json:"auth_type"`
	BearerToken string                        `json:"bearer_token,omitempty"`
	OAuth       *sourcepkg.OAuthSecretPayload `json:"oauth,omitempty"`
}

type DaemonSourcePayload struct {
	ID        string                   `json:"id"`
	Name      string                   `json:"name"`
	RuntimeID string                   `json:"runtime_id"`
	MCP       *MCPSourceConfig         `json:"mcp,omitempty"`
	Auth      *DaemonSourceAuthPayload `json:"auth,omitempty"`
}

type DaemonSourceRunPayload struct {
	ID             string               `json:"id"`
	SourceID       string               `json:"source_id"`
	RuntimeID      string               `json:"runtime_id"`
	RunType        string               `json:"run_type"`
	Status         string               `json:"status"`
	ToolName       string               `json:"tool_name"`
	RequestPayload any                  `json:"request_payload"`
	Source         *DaemonSourcePayload `json:"source,omitempty"`
}

type ReportSourceRunResultRequest struct {
	Status        string         `json:"status,omitempty"`
	Summary       string         `json:"summary"`
	ErrorMessage  string         `json:"error_message,omitempty"`
	ResultPayload map[string]any `json:"result_payload"`
}

func decodeSourceMCPConfig(source db.Source) (*MCPSourceConfig, error) {
	if source.SourceType != "mcp" {
		return nil, nil
	}
	var config MCPSourceConfig
	if err := json.Unmarshal(source.Config, &config); err != nil {
		return nil, err
	}
	sanitized := sourcepkg.SanitizeMCPConfig(config)
	return &sanitized, nil
}

func decodeJSONMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil || decoded == nil {
		return map[string]any{}
	}
	return decoded
}

func decodeJSONValue(raw []byte) any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return map[string]any{}
	}
	return decoded
}

func sourceToolToResponse(tool db.SourceTool) SourceToolResponse {
	return SourceToolResponse{
		ID:          uuidToString(tool.ID),
		SourceID:    uuidToString(tool.SourceID),
		WorkspaceID: uuidToString(tool.WorkspaceID),
		Name:        tool.Name,
		Title:       tool.Title,
		Description: tool.Description,
		Safety:      tool.Safety,
		InputSchema: decodeJSONMap(tool.InputSchema),
		Annotations: decodeJSONMap(tool.Annotations),
		LastSeenAt:  timestampToString(tool.LastSeenAt),
		CreatedAt:   timestampToString(tool.CreatedAt),
		UpdatedAt:   timestampToString(tool.UpdatedAt),
	}
}

func sourceRunToResponse(run db.SourceRun) SourceRunResponse {
	return SourceRunResponse{
		ID:             uuidToString(run.ID),
		SourceID:       uuidToString(run.SourceID),
		WorkspaceID:    uuidToString(run.WorkspaceID),
		RuntimeID:      uuidToString(run.RuntimeID),
		RunType:        run.RunType,
		Status:         run.Status,
		ToolName:       run.ToolName,
		RequestPayload: decodeJSONValue(run.RequestPayload),
		ResultPayload:  decodeJSONValue(run.ResultPayload),
		Summary:        run.Summary,
		ErrorMessage:   run.ErrorMessage,
		StartedAt:      timestampToPtr(run.StartedAt),
		CompletedAt:    timestampToPtr(run.CompletedAt),
		CreatedAt:      timestampToString(run.CreatedAt),
		UpdatedAt:      timestampToString(run.UpdatedAt),
	}
}

func (h *Handler) loadSourceSecret(ctx context.Context, sourceID pgtype.UUID) (*db.SourceSecret, error) {
	secret, err := h.Queries.GetSourceSecret(ctx, sourceID)
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return &secret, nil
}

func (h *Handler) decryptSourceSecret(ctx context.Context, source db.Source) (*sourcepkg.AuthSecretPayload, *db.SourceSecret, error) {
	secret, err := h.loadSourceSecret(ctx, source.ID)
	if err != nil || secret == nil {
		return nil, secret, err
	}

	cipher, err := sourcepkg.LoadSecretCipherFromEnv()
	if err != nil {
		return nil, secret, err
	}

	var payload sourcepkg.AuthSecretPayload
	if err := cipher.DecryptPayload(secret.SecretCiphertext, secret.SecretNonce, &payload); err != nil {
		return nil, secret, err
	}

	return &payload, secret, nil
}

func sourceAuthStateFromConfig(config *MCPSourceConfig, secret *db.SourceSecret) SourceAuthStateResponse {
	authType := "none"
	if config != nil && strings.TrimSpace(config.AuthType) != "" {
		authType = config.AuthType
	}

	if secret != nil {
		return SourceAuthStateResponse{
			AuthType:   secret.AuthType,
			Configured: true,
			Preview:    secret.SecretPreview,
			UpdatedAt:  timestampToPtr(secret.UpdatedAt),
		}
	}

	if authType == "none" {
		return SourceAuthStateResponse{
			AuthType:   authType,
			Configured: true,
			Preview:    "",
		}
	}

	return SourceAuthStateResponse{
		AuthType:   authType,
		Configured: false,
		Preview:    "",
	}
}

func buildSourceToolSummary(tools []db.SourceTool) *SourceToolSummaryResponse {
	if len(tools) == 0 {
		return &SourceToolSummaryResponse{}
	}

	summary := &SourceToolSummaryResponse{Total: len(tools)}
	var latest time.Time
	for _, tool := range tools {
		switch tool.Safety {
		case string(sourcepkg.ToolSafetyReadOnly):
			summary.ReadOnly++
		case string(sourcepkg.ToolSafetyWrite):
			summary.Write++
		default:
			summary.Unknown++
		}
		if tool.LastSeenAt.Valid && tool.LastSeenAt.Time.After(latest) {
			latest = tool.LastSeenAt.Time
			lastSeen := timestampToString(tool.LastSeenAt)
			summary.LastSeenAt = &lastSeen
		}
	}
	return summary
}

func (h *Handler) buildSourceResponse(ctx context.Context, source db.Source) (SourceResponse, error) {
	config, err := decodeSourceMCPConfig(source)
	if err != nil {
		return SourceResponse{}, err
	}

	secret, err := h.loadSourceSecret(ctx, source.ID)
	if err != nil {
		return SourceResponse{}, err
	}

	tools, err := h.Queries.ListSourceToolsBySource(ctx, source.ID)
	if err != nil && !isNotFound(err) {
		return SourceResponse{}, err
	}

	var latestRun *SourceRunResponse
	if run, err := h.Queries.GetLatestSourceRunBySource(ctx, source.ID); err == nil {
		resp := sourceRunToResponse(run)
		latestRun = &resp
	}

	return SourceResponse{
		ID:               uuidToString(source.ID),
		WorkspaceID:      uuidToString(source.WorkspaceID),
		RuntimeID:        uuidToString(source.RuntimeID),
		Name:             source.Name,
		SourceType:       source.SourceType,
		ConnectionStatus: source.ConnectionStatus,
		ConnectionError:  source.ConnectionError,
		LastTestMessage:  source.LastTestMessage,
		LastTestedAt:     timestampToPtr(source.LastTestedAt),
		MCP:              config,
		AuthState:        sourceAuthStateFromConfig(config, secret),
		ToolSummary:      buildSourceToolSummary(tools),
		LatestRun:        latestRun,
		CreatedAt:        timestampToString(source.CreatedAt),
		UpdatedAt:        timestampToString(source.UpdatedAt),
	}, nil
}

func buildAuthPayload(req UpdateSourceAuthRequest) (sourcepkg.AuthSecretPayload, error) {
	authType := strings.ToLower(strings.TrimSpace(req.AuthType))
	if authType == "" {
		authType = "none"
	}

	switch authType {
	case "none":
		return sourcepkg.AuthSecretPayload{AuthType: "none"}, nil
	case "bearer":
		if strings.TrimSpace(req.BearerToken) == "" {
			return sourcepkg.AuthSecretPayload{}, errBadRequest("bearer_token is required")
		}
		return sourcepkg.AuthSecretPayload{
			AuthType: "bearer",
			Bearer: &sourcepkg.BearerSecretPayload{
				Token: strings.TrimSpace(req.BearerToken),
			},
		}, nil
	case "oauth":
		if req.OAuth == nil || strings.TrimSpace(req.OAuth.AccessToken) == "" {
			return sourcepkg.AuthSecretPayload{}, errBadRequest("oauth.access_token is required")
		}
		payload := *req.OAuth
		payload.AccessToken = strings.TrimSpace(payload.AccessToken)
		payload.RefreshToken = strings.TrimSpace(payload.RefreshToken)
		payload.TokenType = strings.TrimSpace(payload.TokenType)
		payload.ExpiresAt = strings.TrimSpace(payload.ExpiresAt)
		return sourcepkg.AuthSecretPayload{
			AuthType: "oauth",
			OAuth:    &payload,
		}, nil
	default:
		return sourcepkg.AuthSecretPayload{}, errBadRequest("invalid auth_type")
	}
}

func buildInlineSecretPayload(config *sourcepkg.MCPConfig) (*sourcepkg.AuthSecretPayload, bool, error) {
	if config == nil {
		return nil, false, nil
	}

	switch strings.ToLower(strings.TrimSpace(config.AuthType)) {
	case "", "none":
		return nil, true, nil
	case "bearer":
		token, err := inlineBearerToken(config.Headers)
		if err != nil {
			return nil, false, err
		}
		if token == "" {
			return nil, true, nil
		}
		return &sourcepkg.AuthSecretPayload{
			AuthType: "bearer",
			Bearer: &sourcepkg.BearerSecretPayload{
				Token: token,
			},
		}, false, nil
	case "oauth":
		return nil, true, nil
	default:
		return nil, false, errBadRequest("invalid auth_type")
	}
}

func inlineBearerToken(headers map[string]string) (string, error) {
	for key, value := range headers {
		if !strings.EqualFold(key, "authorization") {
			continue
		}

		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return "", nil
		}

		lower := strings.ToLower(trimmed)
		if strings.HasPrefix(lower, "bearer ") {
			return strings.TrimSpace(trimmed[len("Bearer "):]), nil
		}
		if strings.Contains(trimmed, " ") {
			return "", errBadRequest("authorization header must use Bearer scheme")
		}
		return trimmed, nil
	}
	return "", nil
}

func (h *Handler) enqueueSourceRun(ctx context.Context, source db.Source, runType, toolName string, requestPayload map[string]any) (db.SourceRun, error) {
	payload := requestPayload
	if payload == nil {
		payload = map[string]any{}
	}
	return h.Queries.CreateSourceRun(ctx, db.CreateSourceRunParams{
		SourceID:       source.ID,
		WorkspaceID:    source.WorkspaceID,
		RuntimeID:      source.RuntimeID,
		RunType:        runType,
		ToolName:       toolName,
		RequestPayload: payload,
	})
}

func (h *Handler) recordImmediateSourceRun(ctx context.Context, source db.Source, runType, toolName, status string, requestPayload map[string]any, outcome sourcepkg.OperationOutcome) (db.SourceRun, error) {
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		return db.SourceRun{}, err
	}
	defer tx.Rollback(ctx)

	qtx := h.Queries.WithTx(tx)
	payload := requestPayload
	if payload == nil {
		payload = map[string]any{}
	}
	run, err := qtx.CreateSourceRun(ctx, db.CreateSourceRunParams{
		SourceID:       source.ID,
		WorkspaceID:    source.WorkspaceID,
		RuntimeID:      source.RuntimeID,
		RunType:        runType,
		Status:         status,
		ToolName:       toolName,
		RequestPayload: payload,
		ResultPayload:  outcome,
		Summary:        outcome.Message,
		ErrorMessage:   outcome.ErrorMessage,
		CompletedAt:    pgtype.Timestamptz{Time: time.Now(), Valid: true},
	})
	if err != nil {
		return db.SourceRun{}, err
	}

	if err := h.applySourceRunOutcomeTx(ctx, qtx, source, run, outcome, status); err != nil {
		return db.SourceRun{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return db.SourceRun{}, err
	}
	return run, nil
}

func (h *Handler) applySourceRunOutcomeTx(ctx context.Context, qtx *db.Queries, source db.Source, run db.SourceRun, outcome sourcepkg.OperationOutcome, status string) error {
	connectionStatus := string(outcome.ConnectionStatus)
	if connectionStatus == "" {
		switch status {
		case "blocked":
			connectionStatus = string(sourcepkg.ConnectionStatusNeedsAuth)
		case "failed":
			connectionStatus = string(sourcepkg.ConnectionStatusFailed)
		default:
			connectionStatus = string(sourcepkg.ConnectionStatusConnected)
		}
	}

	connectionError := ""
	if connectionStatus == string(sourcepkg.ConnectionStatusFailed) {
		connectionError = firstNonEmpty(outcome.ErrorMessage, outcome.Message)
	}

	if _, err := qtx.RecordSourceTestResult(ctx, db.RecordSourceTestResultParams{
		ID:               source.ID,
		ConnectionStatus: connectionStatus,
		ConnectionError:  strToText(connectionError),
		LastTestMessage:  strToText(firstNonEmpty(outcome.Message, run.Summary)),
		LastTestedAt:     pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}); err != nil {
		return err
	}

	if run.RunType == "discover_tools" {
		if err := qtx.DeleteSourceToolsBySource(ctx, source.ID); err != nil {
			return err
		}
		for _, tool := range outcome.Tools {
			if _, err := qtx.UpsertSourceTool(ctx, db.UpsertSourceToolParams{
				SourceID:    source.ID,
				WorkspaceID: source.WorkspaceID,
				Name:        tool.Name,
				Title:       tool.Title,
				Description: tool.Description,
				Safety:      string(tool.Safety),
				InputSchema: tool.InputSchema,
				Annotations: tool.Annotations,
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (h *Handler) buildDaemonSourceRunPayload(ctx context.Context, run db.SourceRun) (*DaemonSourceRunPayload, error) {
	source, err := h.Queries.GetSource(ctx, run.SourceID)
	if err != nil {
		return nil, err
	}

	config, err := decodeSourceMCPConfig(source)
	if err != nil {
		return nil, err
	}

	secret, _, err := h.decryptSourceSecret(ctx, source)
	if err != nil && strings.TrimSpace(os.Getenv("SOURCE_SECRET_KEY")) != "" {
		return nil, err
	}

	var auth *DaemonSourceAuthPayload
	if secret != nil {
		auth = &DaemonSourceAuthPayload{
			AuthType: secret.AuthType,
		}
		if secret.Bearer != nil {
			auth.BearerToken = secret.Bearer.Token
		}
		if secret.OAuth != nil {
			oauth := *secret.OAuth
			auth.OAuth = &oauth
		}
	}

	return &DaemonSourceRunPayload{
		ID:             uuidToString(run.ID),
		SourceID:       uuidToString(run.SourceID),
		RuntimeID:      uuidToString(run.RuntimeID),
		RunType:        run.RunType,
		Status:         run.Status,
		ToolName:       run.ToolName,
		RequestPayload: decodeJSONValue(run.RequestPayload),
		Source: &DaemonSourcePayload{
			ID:        uuidToString(source.ID),
			Name:      source.Name,
			RuntimeID: uuidToString(source.RuntimeID),
			MCP:       config,
			Auth:      auth,
		},
	}, nil
}

func (h *Handler) completeSourceRunWithPayload(ctx context.Context, run db.SourceRun, req ReportSourceRunResultRequest, fallbackStatus string) (db.SourceRun, error) {
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = fallbackStatus
	}

	outcome := sourcepkg.OperationOutcome{
		Message:          req.Summary,
		ErrorMessage:     req.ErrorMessage,
		ConnectionStatus: sourcepkg.ConnectionStatus(strings.TrimSpace(fmt.Sprint(req.ResultPayload["connection_status"]))),
	}

	if outcome.ConnectionStatus == "" {
		switch status {
		case "failed":
			outcome.ConnectionStatus = sourcepkg.ConnectionStatusFailed
		case "blocked":
			outcome.ConnectionStatus = sourcepkg.ConnectionStatusNeedsAuth
		default:
			outcome.ConnectionStatus = sourcepkg.ConnectionStatusConnected
		}
	}
	if toolsRaw, ok := req.ResultPayload["tools"].([]any); ok {
		for _, raw := range toolsRaw {
			toolMap, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			outcome.Tools = append(outcome.Tools, sourcepkg.ToolSnapshot{
				Name:        fmt.Sprint(toolMap["name"]),
				Title:       fmt.Sprint(toolMap["title"]),
				Description: fmt.Sprint(toolMap["description"]),
				Safety:      sourcepkg.ToolSafety(fmt.Sprint(toolMap["safety"])),
				InputSchema: mapValue(toolMap["input_schema"]),
				Annotations: mapValue(toolMap["annotations"]),
			})
		}
	}
	if result, ok := req.ResultPayload["tool_result"]; ok {
		outcome.ToolResult = result
	}
	if toolName := strings.TrimSpace(fmt.Sprint(req.ResultPayload["tool_name"])); toolName != "" {
		outcome.ToolName = toolName
	}
	if isToolError, ok := req.ResultPayload["is_tool_error"].(bool); ok {
		outcome.IsToolError = isToolError
	}

	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		return db.SourceRun{}, err
	}
	defer tx.Rollback(ctx)
	qtx := h.Queries.WithTx(tx)

	resultPayload := req.ResultPayload
	if resultPayload == nil {
		resultPayload = map[string]any{}
	}
	resultPayloadJSON, err := json.Marshal(resultPayload)
	if err != nil {
		return db.SourceRun{}, err
	}

	updatedRun, err := qtx.CompleteSourceRun(ctx, db.CompleteSourceRunParams{
		ID:            run.ID,
		Status:        strToText(status),
		ResultPayload: resultPayloadJSON,
		Summary:       strToText(req.Summary),
		ErrorMessage:  strToText(req.ErrorMessage),
		CompletedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true},
	})
	if err != nil {
		return db.SourceRun{}, err
	}

	source, err := qtx.GetSource(ctx, run.SourceID)
	if err != nil {
		return db.SourceRun{}, err
	}

	if err := h.applySourceRunOutcomeTx(ctx, qtx, source, updatedRun, outcome, status); err != nil {
		return db.SourceRun{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return db.SourceRun{}, err
	}
	return updatedRun, nil
}

func mapValue(value any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	data, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var decoded map[string]any
	if err := json.Unmarshal(data, &decoded); err != nil {
		return map[string]any{}
	}
	return decoded
}

func (h *Handler) updateSourceAuth(ctx context.Context, source db.Source, payload sourcepkg.AuthSecretPayload) (*db.SourceSecret, error) {
	return h.updateSourceAuthWithQueries(ctx, h.Queries, source, payload)
}

func (h *Handler) updateSourceAuthWithQueries(ctx context.Context, queries *db.Queries, source db.Source, payload sourcepkg.AuthSecretPayload) (*db.SourceSecret, error) {
	cipher, err := sourcepkg.LoadSecretCipherFromEnv()
	if err != nil {
		return nil, err
	}

	encrypted, err := cipher.EncryptPayload(payload)
	if err != nil {
		return nil, err
	}

	secret, err := queries.UpsertSourceSecret(ctx, db.UpsertSourceSecretParams{
		SourceID:         source.ID,
		WorkspaceID:      source.WorkspaceID,
		AuthType:         payload.AuthType,
		SecretCiphertext: encrypted.Ciphertext,
		SecretNonce:      encrypted.Nonce,
		SecretPreview:    sourcepkg.BuildSecretPreview(payload),
	})
	if err != nil {
		return nil, err
	}
	return &secret, nil
}

func (h *Handler) syncSourceSecretWithConfig(ctx context.Context, queries *db.Queries, source db.Source, config *sourcepkg.MCPConfig) error {
	payload, shouldDelete, err := buildInlineSecretPayload(config)
	if err != nil {
		return err
	}
	if payload == nil && !shouldDelete {
		return nil
	}

	if shouldDelete {
		return queries.DeleteSourceSecret(ctx, source.ID)
	}

	_, err = h.updateSourceAuthWithQueries(ctx, queries, source, *payload)
	return err
}
