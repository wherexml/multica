package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func ensureSourceOpsTables(t *testing.T) {
	t.Helper()

	_, err := testPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS source_secret (
			source_id UUID PRIMARY KEY REFERENCES source(id) ON DELETE CASCADE,
			workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
			auth_type TEXT NOT NULL DEFAULT 'none'
				CHECK (auth_type IN ('none', 'bearer', 'oauth')),
			secret_ciphertext BYTEA NOT NULL,
			secret_nonce BYTEA NOT NULL,
			secret_preview TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);

		CREATE TABLE IF NOT EXISTS source_tool (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
			workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			safety TEXT NOT NULL DEFAULT 'unknown'
				CHECK (safety IN ('read_only', 'write', 'unknown')),
			input_schema JSONB NOT NULL DEFAULT '{}'
				CHECK (jsonb_typeof(input_schema) = 'object'),
			annotations JSONB NOT NULL DEFAULT '{}'
				CHECK (jsonb_typeof(annotations) = 'object'),
			last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (source_id, name)
		);

		CREATE TABLE IF NOT EXISTS source_run (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
			workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
			runtime_id UUID NOT NULL REFERENCES agent_runtime(id) ON DELETE CASCADE,
			run_type TEXT NOT NULL
				CHECK (run_type IN ('test', 'discover_tools', 'call_tool')),
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK (status IN ('pending', 'running', 'completed', 'failed', 'blocked')),
			tool_name TEXT NOT NULL DEFAULT '',
			request_payload JSONB NOT NULL DEFAULT '{}'
				CHECK (jsonb_typeof(request_payload) = 'object'),
			result_payload JSONB NOT NULL DEFAULT '{}'
				CHECK (jsonb_typeof(result_payload) = 'object'),
			summary TEXT NOT NULL DEFAULT '',
			error_message TEXT NOT NULL DEFAULT '',
			started_at TIMESTAMPTZ,
			completed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
	`)
	if err != nil {
		t.Fatalf("ensure source ops tables: %v", err)
	}
}

func createSourceFixture(t *testing.T, name string) string {
	t.Helper()
	ensureSourceOpsTables(t)

	var runtimeID string
	if err := testPool.QueryRow(context.Background(), `
		SELECT id
		FROM agent_runtime
		WHERE workspace_id = $1
		ORDER BY created_at ASC
		LIMIT 1
	`, testWorkspaceID).Scan(&runtimeID); err != nil {
		t.Fatalf("select runtime fixture: %v", err)
	}

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/sources", map[string]any{
		"name":        name,
		"runtime_id":  runtimeID,
		"source_type": "mcp",
		"mcp": map[string]any{
			"transport": "http",
			"url":       "https://mcp.example.com",
			"auth_type": "bearer",
		},
	})
	testHandler.CreateSource(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateSource: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created SourceResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("decode CreateSource response: %v", err)
	}

	t.Cleanup(func() {
		_, _ = testPool.Exec(context.Background(), `DELETE FROM source WHERE id = $1`, created.ID)
	})
	return created.ID
}

func TestSourceAuthAndRunEndpoints(t *testing.T) {
	t.Setenv("SOURCE_SECRET_KEY", "test-source-secret")

	sourceID := createSourceFixture(t, "Handler MCP Source")

	w := httptest.NewRecorder()
	req := newRequest("PUT", "/api/sources/"+sourceID+"/auth", map[string]any{
		"auth_type":    "bearer",
		"bearer_token": "secret-token",
	})
	req = withURLParam(req, "sourceId", sourceID)
	testHandler.UpdateSourceAuth(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateSourceAuth: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var authState SourceAuthStateResponse
	if err := json.NewDecoder(w.Body).Decode(&authState); err != nil {
		t.Fatalf("decode auth state: %v", err)
	}
	if !authState.Configured {
		t.Fatalf("expected auth to be configured")
	}
	if authState.Preview == "" {
		t.Fatalf("expected masked auth preview")
	}

	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/sources/"+sourceID+"/test", nil)
	req = withURLParam(req, "sourceId", sourceID)
	testHandler.TestSource(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("TestSource: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var run SourceRunResponse
	if err := json.NewDecoder(w.Body).Decode(&run); err != nil {
		t.Fatalf("decode source run: %v", err)
	}
	if run.RunType != "test" {
		t.Fatalf("expected run_type test, got %q", run.RunType)
	}
	if run.Status != "pending" {
		t.Fatalf("expected pending run, got %q", run.Status)
	}

	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/sources/"+sourceID+"/runs/"+run.ID, nil)
	req = withURLParam(req, "sourceId", sourceID)
	req = withURLParam(req, "runId", run.ID)
	testHandler.GetSourceRun(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetSourceRun: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var fetchedRun SourceRunResponse
	if err := json.NewDecoder(w.Body).Decode(&fetchedRun); err != nil {
		t.Fatalf("decode fetched source run: %v", err)
	}
	if fetchedRun.ID != run.ID {
		t.Fatalf("expected run id %q, got %q", run.ID, fetchedRun.ID)
	}
}

func TestCreateSourcePersistsInlineBearerSecret(t *testing.T) {
	t.Setenv("SOURCE_SECRET_KEY", "test-source-secret")
	ensureSourceOpsTables(t)

	var runtimeID string
	if err := testPool.QueryRow(context.Background(), `
		SELECT id
		FROM agent_runtime
		WHERE workspace_id = $1
		ORDER BY created_at ASC
		LIMIT 1
	`, testWorkspaceID).Scan(&runtimeID); err != nil {
		t.Fatalf("select runtime fixture: %v", err)
	}

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/sources", map[string]any{
		"name":        "Inline Bearer Source",
		"runtime_id":  runtimeID,
		"source_type": "mcp",
		"mcp": map[string]any{
			"transport": "http",
			"url":       "https://mcp.example.com",
			"auth_type": "bearer",
			"headers": map[string]any{
				"Authorization": "Bearer inline-secret-token",
				"X-Test":        "ok",
			},
		},
	})
	testHandler.CreateSource(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateSource: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created SourceResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("decode CreateSource response: %v", err)
	}
	t.Cleanup(func() {
		_, _ = testPool.Exec(context.Background(), `DELETE FROM source WHERE id = $1`, created.ID)
	})

	if !created.AuthState.Configured {
		t.Fatalf("expected auth_state.configured to be true")
	}
	if created.AuthState.Preview == "" {
		t.Fatalf("expected auth_state.preview to be masked")
	}
	if created.MCP == nil {
		t.Fatalf("expected mcp config in response")
	}
	if _, ok := created.MCP.Headers["Authorization"]; ok {
		t.Fatalf("expected authorization header to be stripped from response config")
	}
	if created.MCP.Headers["X-Test"] != "ok" {
		t.Fatalf("expected non-secret headers to remain in response")
	}
}

func TestCallSourceToolBlocksWriteSafety(t *testing.T) {
	sourceID := createSourceFixture(t, "Write Tool Source")

	if _, err := testPool.Exec(context.Background(), `
		INSERT INTO source_tool (
			source_id, workspace_id, name, title, description, safety, input_schema, annotations
		)
		VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, '{}'::jsonb)
	`, sourceID, testWorkspaceID, "mutate_doc", "修改文档", "write tool", "write"); err != nil {
		t.Fatalf("insert source_tool: %v", err)
	}
	t.Cleanup(func() {
		_, _ = testPool.Exec(context.Background(), `DELETE FROM source_tool WHERE source_id = $1`, sourceID)
	})

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/sources/"+sourceID+"/tools/mutate_doc/call", map[string]any{
		"arguments": map[string]any{},
	})
	req = withURLParam(req, "sourceId", sourceID)
	req = withURLParam(req, "toolName", "mutate_doc")
	testHandler.CallSourceTool(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("CallSourceTool: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var run SourceRunResponse
	if err := json.NewDecoder(w.Body).Decode(&run); err != nil {
		t.Fatalf("decode blocked tool run: %v", err)
	}
	if run.Status != "blocked" {
		t.Fatalf("expected blocked run, got %q", run.Status)
	}
}
