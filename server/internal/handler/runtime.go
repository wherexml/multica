package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type RuntimeExecutorResponse struct {
	ExecutorKind     string         `json:"executor_kind"`
	NetworkZone      string         `json:"network_zone"`
	CredentialScope  string         `json:"credential_scope"`
	ResourceQuota    map[string]any `json:"resource_quota"`
	AllowedActions   []string       `json:"allowed_actions"`
	ApprovalRequired bool           `json:"approval_required"`
}

type AgentRuntimeResponse struct {
	ID          string                  `json:"id"`
	WorkspaceID string                  `json:"workspace_id"`
	DaemonID    *string                 `json:"daemon_id"`
	Name        string                  `json:"name"`
	RuntimeMode string                  `json:"runtime_mode"`
	Provider    string                  `json:"provider"`
	Status      string                  `json:"status"`
	DeviceInfo  string                  `json:"device_info"`
	Metadata    map[string]any          `json:"metadata"`
	OwnerID     *string                 `json:"owner_id"`
	LastSeenAt  *string                 `json:"last_seen_at"`
	CreatedAt   string                  `json:"created_at"`
	UpdatedAt   string                  `json:"updated_at"`
	Executor    RuntimeExecutorResponse `json:"executor"`
}

type UpdateRuntimeExecutorRequest struct {
	ExecutorKind     *string          `json:"executor_kind"`
	NetworkZone      *string          `json:"network_zone"`
	CredentialScope  *string          `json:"credential_scope"`
	ResourceQuota    *json.RawMessage `json:"resource_quota"`
	AllowedActions   *[]string        `json:"allowed_actions"`
	ApprovalRequired *bool            `json:"approval_required"`
}

type UpdateRuntimeRequest struct {
	Name       *string                       `json:"name"`
	Status     *string                       `json:"status"`
	DeviceInfo *string                       `json:"device_info"`
	Metadata   *json.RawMessage              `json:"metadata"`
	Executor   *UpdateRuntimeExecutorRequest `json:"executor"`
}

func defaultRuntimeExecutorResponse() RuntimeExecutorResponse {
	return RuntimeExecutorResponse{
		ExecutorKind:     "llm_agent",
		NetworkZone:      "default",
		CredentialScope:  "",
		ResourceQuota:    map[string]any{},
		AllowedActions:   []string{},
		ApprovalRequired: false,
	}
}

func jsonObjectFromBytes(raw []byte) map[string]any {
	var payload map[string]any
	if len(raw) == 0 {
		return map[string]any{}
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload == nil {
		return map[string]any{}
	}
	return payload
}

func jsonObjectFromText(raw string) map[string]any {
	return jsonObjectFromBytes([]byte(raw))
}

func stringSliceFromText(raw string) []string {
	var items []string
	if raw == "" {
		return []string{}
	}
	if err := json.Unmarshal([]byte(raw), &items); err != nil || items == nil {
		return []string{}
	}
	return items
}

func marshalJSONObject(raw *json.RawMessage) ([]byte, error) {
	if raw == nil {
		return nil, nil
	}
	var payload map[string]any
	if err := json.Unmarshal(*raw, &payload); err != nil {
		return nil, err
	}
	if payload == nil {
		payload = map[string]any{}
	}
	return json.Marshal(payload)
}

func marshalStringList(raw *[]string) (string, error) {
	if raw == nil {
		return "", nil
	}
	items := []string{}
	if *raw != nil {
		items = *raw
	}
	buf, err := json.Marshal(items)
	if err != nil {
		return "", err
	}
	return string(buf), nil
}

func runtimeExecutorToResponse(executor db.RuntimeExecutor) RuntimeExecutorResponse {
	return RuntimeExecutorResponse{
		ExecutorKind:     executor.ExecutorKind,
		NetworkZone:      executor.NetworkZone,
		CredentialScope:  executor.CredentialScope,
		ResourceQuota:    jsonObjectFromText(executor.ResourceQuota),
		AllowedActions:   stringSliceFromText(executor.AllowedActions),
		ApprovalRequired: executor.ApprovalRequired,
	}
}

func runtimeToResponse(rt db.AgentRuntime) AgentRuntimeResponse {
	return runtimeToResponseWithExecutor(rt, defaultRuntimeExecutorResponse())
}

func runtimeToResponseWithExecutor(rt db.AgentRuntime, executor RuntimeExecutorResponse) AgentRuntimeResponse {
	return AgentRuntimeResponse{
		ID:          uuidToString(rt.ID),
		WorkspaceID: uuidToString(rt.WorkspaceID),
		DaemonID:    textToPtr(rt.DaemonID),
		Name:        rt.Name,
		RuntimeMode: rt.RuntimeMode,
		Provider:    rt.Provider,
		Status:      rt.Status,
		DeviceInfo:  rt.DeviceInfo,
		Metadata:    jsonObjectFromBytes(rt.Metadata),
		OwnerID:     uuidToPtr(rt.OwnerID),
		LastSeenAt:  timestampToPtr(rt.LastSeenAt),
		CreatedAt:   timestampToString(rt.CreatedAt),
		UpdatedAt:   timestampToString(rt.UpdatedAt),
		Executor:    executor,
	}
}

func isValidExecutorKind(kind string) bool {
	switch kind {
	case "llm_agent", "sql_runner", "python_worker", "optimizer", "connector_action":
		return true
	default:
		return false
	}
}

func isValidRuntimeStatus(status string) bool {
	switch status {
	case "online", "offline":
		return true
	default:
		return false
	}
}

func (req UpdateRuntimeRequest) hasRuntimeChanges() bool {
	return req.Name != nil || req.Status != nil || req.DeviceInfo != nil || req.Metadata != nil
}

func (req UpdateRuntimeRequest) hasExecutorChanges() bool {
	if req.Executor == nil {
		return false
	}
	return req.Executor.ExecutorKind != nil ||
		req.Executor.NetworkZone != nil ||
		req.Executor.CredentialScope != nil ||
		req.Executor.ResourceQuota != nil ||
		req.Executor.AllowedActions != nil ||
		req.Executor.ApprovalRequired != nil
}

func (h *Handler) loadRuntimeForMember(w http.ResponseWriter, r *http.Request, runtimeID string) (db.AgentRuntime, bool) {
	if runtimeID == "" {
		writeError(w, http.StatusBadRequest, "runtimeId is required")
		return db.AgentRuntime{}, false
	}

	workspaceID := resolveWorkspaceID(r)
	var (
		rt  db.AgentRuntime
		err error
	)
	if workspaceID != "" {
		rt, err = h.Queries.GetAgentRuntimeForWorkspace(r.Context(), db.GetAgentRuntimeForWorkspaceParams{
			ID:          parseUUID(runtimeID),
			WorkspaceID: parseUUID(workspaceID),
		})
	} else {
		rt, err = h.Queries.GetAgentRuntime(r.Context(), parseUUID(runtimeID))
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "runtime not found")
		return db.AgentRuntime{}, false
	}

	if _, ok := h.requireWorkspaceMember(w, r, uuidToString(rt.WorkspaceID), "runtime not found"); !ok {
		return db.AgentRuntime{}, false
	}

	return rt, true
}

func (h *Handler) requireRuntimeManager(w http.ResponseWriter, r *http.Request, rt db.AgentRuntime) (db.Member, bool) {
	member, ok := h.requireWorkspaceMember(w, r, uuidToString(rt.WorkspaceID), "runtime not found")
	if !ok {
		return db.Member{}, false
	}

	userID := uuidToString(member.UserID)
	isAdmin := roleAllowed(member.Role, "owner", "admin")
	isOwner := rt.OwnerID.Valid && uuidToString(rt.OwnerID) == userID
	if !isAdmin && !isOwner {
		writeError(w, http.StatusForbidden, "you can only update your own runtimes")
		return db.Member{}, false
	}

	return member, true
}

func (h *Handler) runtimeExecutorMap(ctx context.Context, workspaceID string, executorKind pgtype.Text) (map[string]RuntimeExecutorResponse, error) {
	rows, err := h.Queries.ListRuntimeExecutors(ctx, db.ListRuntimeExecutorsParams{
		WorkspaceID:  parseUUID(workspaceID),
		ExecutorKind: executorKind,
	})
	if err != nil {
		return nil, err
	}

	executors := make(map[string]RuntimeExecutorResponse, len(rows))
	for _, row := range rows {
		executors[uuidToString(row.RuntimeID)] = runtimeExecutorToResponse(row)
	}
	return executors, nil
}

func (h *Handler) runtimeExecutorResponse(ctx context.Context, runtimeID pgtype.UUID) RuntimeExecutorResponse {
	executor, err := h.Queries.GetRuntimeExecutorByRuntime(ctx, runtimeID)
	if err != nil {
		return defaultRuntimeExecutorResponse()
	}
	return runtimeExecutorToResponse(executor)
}

// ---------------------------------------------------------------------------
// Runtime Usage
// ---------------------------------------------------------------------------

type RuntimeUsageEntry struct {
	Date             string `json:"date"`
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	InputTokens      int64  `json:"input_tokens"`
	OutputTokens     int64  `json:"output_tokens"`
	CacheReadTokens  int64  `json:"cache_read_tokens"`
	CacheWriteTokens int64  `json:"cache_write_tokens"`
}

type RuntimeUsageResponse struct {
	RuntimeID        string `json:"runtime_id"`
	Date             string `json:"date"`
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	InputTokens      int64  `json:"input_tokens"`
	OutputTokens     int64  `json:"output_tokens"`
	CacheReadTokens  int64  `json:"cache_read_tokens"`
	CacheWriteTokens int64  `json:"cache_write_tokens"`
}

// ReportRuntimeUsage receives usage data from the daemon.
func (h *Handler) ReportRuntimeUsage(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")
	if runtimeID == "" {
		writeError(w, http.StatusBadRequest, "runtimeId is required")
		return
	}

	// Verify the caller owns this runtime's workspace.
	if _, ok := h.requireDaemonRuntimeAccess(w, r, runtimeID); !ok {
		return
	}

	var req struct {
		Entries []RuntimeUsageEntry `json:"entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	for _, entry := range req.Entries {
		date, err := time.Parse("2006-01-02", entry.Date)
		if err != nil {
			continue
		}
		h.Queries.UpsertRuntimeUsage(r.Context(), db.UpsertRuntimeUsageParams{
			RuntimeID:        parseUUID(runtimeID),
			Date:             pgtype.Date{Time: date, Valid: true},
			Provider:         entry.Provider,
			Model:            entry.Model,
			InputTokens:      entry.InputTokens,
			OutputTokens:     entry.OutputTokens,
			CacheReadTokens:  entry.CacheReadTokens,
			CacheWriteTokens: entry.CacheWriteTokens,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetRuntimeUsage returns usage data for a runtime (protected route).
func (h *Handler) GetRuntimeUsage(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")

	rt, err := h.Queries.GetAgentRuntime(r.Context(), parseUUID(runtimeID))
	if err != nil {
		writeError(w, http.StatusNotFound, "runtime not found")
		return
	}

	if _, ok := h.requireWorkspaceMember(w, r, uuidToString(rt.WorkspaceID), "runtime not found"); !ok {
		return
	}

	limit := int32(90)
	if l := r.URL.Query().Get("days"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 365 {
			limit = int32(parsed)
		}
	}

	rows, err := h.Queries.ListRuntimeUsage(r.Context(), db.ListRuntimeUsageParams{
		RuntimeID: parseUUID(runtimeID),
		Limit:     limit,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list usage")
		return
	}

	resp := make([]RuntimeUsageResponse, len(rows))
	for i, row := range rows {
		resp[i] = RuntimeUsageResponse{
			RuntimeID:        runtimeID,
			Date:             row.Date.Time.Format("2006-01-02"),
			Provider:         row.Provider,
			Model:            row.Model,
			InputTokens:      row.InputTokens,
			OutputTokens:     row.OutputTokens,
			CacheReadTokens:  row.CacheReadTokens,
			CacheWriteTokens: row.CacheWriteTokens,
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetRuntimeTaskActivity returns hourly task activity distribution for a runtime.
func (h *Handler) GetRuntimeTaskActivity(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")

	rt, err := h.Queries.GetAgentRuntime(r.Context(), parseUUID(runtimeID))
	if err != nil {
		writeError(w, http.StatusNotFound, "runtime not found")
		return
	}

	if _, ok := h.requireWorkspaceMember(w, r, uuidToString(rt.WorkspaceID), "runtime not found"); !ok {
		return
	}

	rows, err := h.Queries.GetRuntimeTaskHourlyActivity(r.Context(), parseUUID(runtimeID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get task activity")
		return
	}

	type HourlyActivity struct {
		Hour  int `json:"hour"`
		Count int `json:"count"`
	}

	resp := make([]HourlyActivity, len(rows))
	for i, row := range rows {
		resp[i] = HourlyActivity{Hour: int(row.Hour), Count: int(row.Count)}
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetWorkspaceUsageByDay returns daily token usage aggregated by model for the workspace.
func (h *Handler) GetWorkspaceUsageByDay(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	since := parseSinceParam(r, 30)

	rows, err := h.Queries.GetWorkspaceUsageByDay(r.Context(), db.GetWorkspaceUsageByDayParams{
		WorkspaceID: parseUUID(workspaceID),
		Since:       since,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get usage")
		return
	}

	type DailyUsageRow struct {
		Date                  string `json:"date"`
		Model                 string `json:"model"`
		TotalInputTokens      int64  `json:"total_input_tokens"`
		TotalOutputTokens     int64  `json:"total_output_tokens"`
		TotalCacheReadTokens  int64  `json:"total_cache_read_tokens"`
		TotalCacheWriteTokens int64  `json:"total_cache_write_tokens"`
		TaskCount             int32  `json:"task_count"`
	}

	resp := make([]DailyUsageRow, len(rows))
	for i, row := range rows {
		resp[i] = DailyUsageRow{
			Date:                  row.Date.Time.Format("2006-01-02"),
			Model:                 row.Model,
			TotalInputTokens:      row.TotalInputTokens,
			TotalOutputTokens:     row.TotalOutputTokens,
			TotalCacheReadTokens:  row.TotalCacheReadTokens,
			TotalCacheWriteTokens: row.TotalCacheWriteTokens,
			TaskCount:             row.TaskCount,
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetWorkspaceUsageSummary returns total token usage aggregated by model for the workspace.
func (h *Handler) GetWorkspaceUsageSummary(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	since := parseSinceParam(r, 30)

	rows, err := h.Queries.GetWorkspaceUsageSummary(r.Context(), db.GetWorkspaceUsageSummaryParams{
		WorkspaceID: parseUUID(workspaceID),
		Since:       since,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get usage summary")
		return
	}

	type UsageSummaryRow struct {
		Model                 string `json:"model"`
		TotalInputTokens      int64  `json:"total_input_tokens"`
		TotalOutputTokens     int64  `json:"total_output_tokens"`
		TotalCacheReadTokens  int64  `json:"total_cache_read_tokens"`
		TotalCacheWriteTokens int64  `json:"total_cache_write_tokens"`
		TaskCount             int32  `json:"task_count"`
	}

	resp := make([]UsageSummaryRow, len(rows))
	for i, row := range rows {
		resp[i] = UsageSummaryRow{
			Model:                 row.Model,
			TotalInputTokens:      row.TotalInputTokens,
			TotalOutputTokens:     row.TotalOutputTokens,
			TotalCacheReadTokens:  row.TotalCacheReadTokens,
			TotalCacheWriteTokens: row.TotalCacheWriteTokens,
			TaskCount:             row.TaskCount,
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// parseSinceParam parses the "days" query parameter and returns a timestamptz.
func parseSinceParam(r *http.Request, defaultDays int) pgtype.Timestamptz {
	days := defaultDays
	if d := r.URL.Query().Get("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 365 {
			days = parsed
		}
	}
	t := time.Now().AddDate(0, 0, -days)
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func (h *Handler) ListAgentRuntimes(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	member, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found")
	if !ok {
		return
	}

	executorKindFilter := strings.TrimSpace(r.URL.Query().Get("executor_kind"))
	var executorKindArg pgtype.Text
	if executorKindFilter != "" {
		if !isValidExecutorKind(executorKindFilter) {
			writeError(w, http.StatusBadRequest, "invalid executor_kind")
			return
		}
		executorKindArg = strToText(executorKindFilter)
	}

	var (
		runtimes []db.AgentRuntime
		err      error
	)
	if ownerFilter := r.URL.Query().Get("owner"); ownerFilter == "me" {
		runtimes, err = h.Queries.ListAgentRuntimesByOwner(r.Context(), db.ListAgentRuntimesByOwnerParams{
			WorkspaceID: parseUUID(workspaceID),
			OwnerID:     member.UserID,
		})
	} else {
		runtimes, err = h.Queries.ListAgentRuntimes(r.Context(), parseUUID(workspaceID))
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runtimes")
		return
	}

	executors, err := h.runtimeExecutorMap(r.Context(), workspaceID, executorKindArg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runtimes")
		return
	}

	resp := make([]AgentRuntimeResponse, 0, len(runtimes))
	for _, rt := range runtimes {
		executor, found := executors[uuidToString(rt.ID)]
		if executorKindArg.Valid && !found {
			continue
		}
		if !found {
			executor = defaultRuntimeExecutorResponse()
		}
		resp = append(resp, runtimeToResponseWithExecutor(rt, executor))
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetAgentRuntime(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")
	rt, ok := h.loadRuntimeForMember(w, r, runtimeID)
	if !ok {
		return
	}

	writeJSON(w, http.StatusOK, runtimeToResponseWithExecutor(rt, h.runtimeExecutorResponse(r.Context(), rt.ID)))
}

func (h *Handler) UpdateAgentRuntime(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")
	rt, ok := h.loadRuntimeForMember(w, r, runtimeID)
	if !ok {
		return
	}

	member, ok := h.requireRuntimeManager(w, r, rt)
	if !ok {
		return
	}

	var req UpdateRuntimeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !req.hasRuntimeChanges() && !req.hasExecutorChanges() {
		writeError(w, http.StatusBadRequest, "no fields to update")
		return
	}

	if req.Status != nil && !isValidRuntimeStatus(strings.TrimSpace(*req.Status)) {
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}
	if req.Executor != nil && req.Executor.ExecutorKind != nil && !isValidExecutorKind(strings.TrimSpace(*req.Executor.ExecutorKind)) {
		writeError(w, http.StatusBadRequest, "invalid executor_kind")
		return
	}

	metadata, err := marshalJSONObject(req.Metadata)
	if err != nil {
		writeError(w, http.StatusBadRequest, "metadata must be a JSON object")
		return
	}

	resourceQuota := ""
	if req.Executor != nil {
		resourceQuotaBytes, marshalErr := marshalJSONObject(req.Executor.ResourceQuota)
		if marshalErr != nil {
			writeError(w, http.StatusBadRequest, "resource_quota must be a JSON object")
			return
		}
		if resourceQuotaBytes != nil {
			resourceQuota = string(resourceQuotaBytes)
		}
	}

	allowedActions := ""
	if req.Executor != nil {
		encodedActions, marshalErr := marshalStringList(req.Executor.AllowedActions)
		if marshalErr != nil {
			writeError(w, http.StatusBadRequest, "allowed_actions must be a string array")
			return
		}
		allowedActions = encodedActions
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update runtime")
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.Queries.WithTx(tx)
	updatedRuntime := rt
	if req.hasRuntimeChanges() {
		updatedRuntime, err = qtx.UpdateAgentRuntime(r.Context(), db.UpdateAgentRuntimeParams{
			Name:        ptrToText(req.Name),
			Status:      ptrToText(req.Status),
			DeviceInfo:  ptrToText(req.DeviceInfo),
			Metadata:    metadata,
			ID:          rt.ID,
			WorkspaceID: rt.WorkspaceID,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update runtime")
			return
		}
	}

	updatedExecutor := defaultRuntimeExecutorResponse()
	if req.hasExecutorChanges() {
		executorRow, upsertErr := qtx.UpsertRuntimeExecutor(r.Context(), db.UpsertRuntimeExecutorParams{
			RuntimeID:        rt.ID,
			ExecutorKind:     req.Executor.ExecutorKind,
			NetworkZone:      req.Executor.NetworkZone,
			CredentialScope:  req.Executor.CredentialScope,
			ResourceQuota:    nilIfEmpty(resourceQuota),
			AllowedActions:   nilIfEmpty(allowedActions),
			ApprovalRequired: req.Executor.ApprovalRequired,
		})
		if upsertErr != nil {
			writeError(w, http.StatusInternalServerError, "failed to update runtime executor")
			return
		}
		updatedExecutor = runtimeExecutorToResponse(executorRow)
	} else {
		executorRow, getErr := qtx.GetRuntimeExecutorByRuntime(r.Context(), rt.ID)
		if getErr == nil {
			updatedExecutor = runtimeExecutorToResponse(executorRow)
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update runtime")
		return
	}

	h.publish(protocol.EventDaemonRegister, uuidToString(updatedRuntime.WorkspaceID), "member", uuidToString(member.UserID), map[string]any{
		"action":     "update",
		"runtime_id": uuidToString(updatedRuntime.ID),
	})

	writeJSON(w, http.StatusOK, runtimeToResponseWithExecutor(updatedRuntime, updatedExecutor))
}

func nilIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

// DeleteAgentRuntime deletes a runtime after permission and dependency checks.
func (h *Handler) DeleteAgentRuntime(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")

	rt, err := h.Queries.GetAgentRuntime(r.Context(), parseUUID(runtimeID))
	if err != nil {
		writeError(w, http.StatusNotFound, "runtime not found")
		return
	}

	wsID := uuidToString(rt.WorkspaceID)
	member, ok := h.requireWorkspaceMember(w, r, wsID, "runtime not found")
	if !ok {
		return
	}

	// Permission: owner/admin can delete any runtime; members can only delete their own.
	userID := uuidToString(member.UserID)
	isAdmin := roleAllowed(member.Role, "owner", "admin")
	isOwner := rt.OwnerID.Valid && uuidToString(rt.OwnerID) == userID
	if !isAdmin && !isOwner {
		writeError(w, http.StatusForbidden, "you can only delete your own runtimes")
		return
	}

	// Check if any active (non-archived) agents are bound to this runtime.
	activeCount, err := h.Queries.CountActiveAgentsByRuntime(r.Context(), rt.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check runtime dependencies")
		return
	}
	if activeCount > 0 {
		writeError(w, http.StatusConflict, "cannot delete runtime: it has active agents bound to it. Archive or reassign the agents first.")
		return
	}

	// Remove archived agents so the FK constraint (ON DELETE RESTRICT) won't block deletion.
	if err := h.Queries.DeleteArchivedAgentsByRuntime(r.Context(), rt.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clean up archived agents")
		return
	}

	if err := h.Queries.DeleteAgentRuntime(r.Context(), rt.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete runtime")
		return
	}

	slog.Info("runtime deleted", "runtime_id", runtimeID, "deleted_by", userID)

	// Notify frontend to refresh runtime list.
	h.publish(protocol.EventDaemonRegister, wsID, "member", userID, map[string]any{
		"action": "delete",
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
