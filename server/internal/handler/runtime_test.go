package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type runtimeExecutorTestResponse struct {
	ExecutorKind     string         `json:"executor_kind"`
	NetworkZone      string         `json:"network_zone"`
	CredentialScope  string         `json:"credential_scope"`
	ResourceQuota    map[string]any `json:"resource_quota"`
	AllowedActions   []string       `json:"allowed_actions"`
	ApprovalRequired bool           `json:"approval_required"`
}

type runtimeTestResponse struct {
	ID         string                      `json:"id"`
	Name       string                      `json:"name"`
	Status     string                      `json:"status"`
	DeviceInfo string                      `json:"device_info"`
	Metadata   map[string]any              `json:"metadata"`
	Executor   runtimeExecutorTestResponse `json:"executor"`
}

func createRuntimeExecutorFixture(t *testing.T, runtimeName, provider, executorKind string) string {
	t.Helper()

	ctx := context.Background()

	var runtimeID string
	err := runtimeTestPool.QueryRow(ctx, `
		INSERT INTO agent_runtime (
			workspace_id, daemon_id, name, runtime_mode, provider, status, device_info, metadata, last_seen_at
		)
		VALUES ($1, NULL, $2, 'local', $3, 'online', $4, '{"source":"test"}'::jsonb, now())
		RETURNING id
	`, runtimeTestWorkspaceID, runtimeName, provider, runtimeName+" device").Scan(&runtimeID)
	if err != nil {
		t.Fatalf("create runtime fixture: %v", err)
	}
	t.Cleanup(func() {
		if _, cleanupErr := runtimeTestPool.Exec(ctx, `DELETE FROM agent_runtime WHERE id = $1`, runtimeID); cleanupErr != nil {
			t.Fatalf("cleanup runtime fixture: %v", cleanupErr)
		}
	})

	_, err = runtimeTestPool.Exec(ctx, `
		INSERT INTO runtime_executor (
			runtime_id, executor_kind, network_zone, credential_scope, resource_quota, allowed_actions, approval_required
		)
		VALUES ($1, $2, 'sandbox', 'workspace', '{"cpu":"2","memory":"4Gi"}', '["query","explain"]', true)
		ON CONFLICT (runtime_id) DO UPDATE
		SET executor_kind = EXCLUDED.executor_kind,
		    network_zone = EXCLUDED.network_zone,
		    credential_scope = EXCLUDED.credential_scope,
		    resource_quota = EXCLUDED.resource_quota,
		    allowed_actions = EXCLUDED.allowed_actions,
		    approval_required = EXCLUDED.approval_required,
		    updated_at = now()
	`, runtimeID, executorKind)
	if err != nil {
		t.Fatalf("create runtime executor fixture: %v", err)
	}

	return runtimeID
}

func TestListAgentRuntimesIncludesExecutorFilter(t *testing.T) {
	if runtimeTestHandler == nil {
		t.Skip("database not available")
	}

	sqlRuntimeID := createRuntimeExecutorFixture(t, "SQL Runner Runtime", "sql-runner", "sql_runner")
	_ = createRuntimeExecutorFixture(t, "Python Worker Runtime", "python-worker", "python_worker")

	w := httptest.NewRecorder()
	req := runtimeNewRequest("GET", "/api/runtimes?executor_kind=sql_runner", nil)

	runtimeTestHandler.ListAgentRuntimes(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListAgentRuntimes: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp []runtimeTestResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("ListAgentRuntimes: decode response: %v", err)
	}
	if len(resp) != 1 {
		t.Fatalf("ListAgentRuntimes: expected 1 runtime after executor filter, got %d", len(resp))
	}
	if resp[0].ID != sqlRuntimeID {
		t.Fatalf("ListAgentRuntimes: expected runtime %q, got %q", sqlRuntimeID, resp[0].ID)
	}
	if resp[0].Executor.ExecutorKind != "sql_runner" {
		t.Fatalf("ListAgentRuntimes: expected executor_kind %q, got %q", "sql_runner", resp[0].Executor.ExecutorKind)
	}
	if len(resp[0].Executor.AllowedActions) != 2 {
		t.Fatalf("ListAgentRuntimes: expected allowed actions in response")
	}
}

func TestGetAgentRuntimeIncludesExecutorDetails(t *testing.T) {
	if runtimeTestHandler == nil {
		t.Skip("database not available")
	}

	runtimeID := createRuntimeExecutorFixture(t, "Optimizer Runtime", "optimizer", "optimizer")

	w := httptest.NewRecorder()
	req := runtimeNewRequest("GET", "/api/runtimes/"+runtimeID, nil)
	req = runtimeWithURLParam(req, "runtimeId", runtimeID)

	runtimeTestHandler.GetAgentRuntime(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetAgentRuntime: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp runtimeTestResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("GetAgentRuntime: decode response: %v", err)
	}
	if resp.ID != runtimeID {
		t.Fatalf("GetAgentRuntime: expected id %q, got %q", runtimeID, resp.ID)
	}
	if resp.Executor.ExecutorKind != "optimizer" {
		t.Fatalf("GetAgentRuntime: expected executor_kind %q, got %q", "optimizer", resp.Executor.ExecutorKind)
	}
	if resp.Executor.NetworkZone != "sandbox" {
		t.Fatalf("GetAgentRuntime: expected network_zone %q, got %q", "sandbox", resp.Executor.NetworkZone)
	}
	if resp.Executor.ResourceQuota["cpu"] != "2" {
		t.Fatalf("GetAgentRuntime: expected resource quota cpu to be %q, got %v", "2", resp.Executor.ResourceQuota["cpu"])
	}
}

func TestUpdateAgentRuntimeUpdatesExecutorFields(t *testing.T) {
	if runtimeTestHandler == nil {
		t.Skip("database not available")
	}

	runtimeID := createRuntimeExecutorFixture(t, "Connector Runtime", "connector", "connector_action")

	w := httptest.NewRecorder()
	req := runtimeNewRequest("PATCH", "/api/runtimes/"+runtimeID, map[string]any{
		"name":        "Connector Runtime Updated",
		"device_info": "Updated device info",
		"metadata": map[string]any{
			"source": "patched",
		},
		"executor": map[string]any{
			"executor_kind":    "sql_runner",
			"network_zone":     "restricted",
			"credential_scope": "workspace:finance",
			"resource_quota": map[string]any{
				"cpu": "4",
			},
			"allowed_actions":   []string{"query", "export"},
			"approval_required": false,
		},
	})
	req = runtimeWithURLParam(req, "runtimeId", runtimeID)

	runtimeTestHandler.UpdateAgentRuntime(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateAgentRuntime: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp runtimeTestResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("UpdateAgentRuntime: decode response: %v", err)
	}
	if resp.Name != "Connector Runtime Updated" {
		t.Fatalf("UpdateAgentRuntime: expected name %q, got %q", "Connector Runtime Updated", resp.Name)
	}
	if resp.Executor.ExecutorKind != "sql_runner" {
		t.Fatalf("UpdateAgentRuntime: expected executor_kind %q, got %q", "sql_runner", resp.Executor.ExecutorKind)
	}
	if resp.Executor.NetworkZone != "restricted" {
		t.Fatalf("UpdateAgentRuntime: expected network_zone %q, got %q", "restricted", resp.Executor.NetworkZone)
	}
	if resp.Executor.CredentialScope != "workspace:finance" {
		t.Fatalf("UpdateAgentRuntime: expected credential_scope %q, got %q", "workspace:finance", resp.Executor.CredentialScope)
	}
	if resp.Executor.ApprovalRequired {
		t.Fatalf("UpdateAgentRuntime: expected approval_required to be false")
	}
	if len(resp.Executor.AllowedActions) != 2 || resp.Executor.AllowedActions[1] != "export" {
		t.Fatalf("UpdateAgentRuntime: expected allowed actions to be updated, got %v", resp.Executor.AllowedActions)
	}
}
