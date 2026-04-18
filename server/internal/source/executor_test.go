package source

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type listDocsArgs struct {
	Query string `json:"query,omitempty"`
}

func listDocsTool(_ context.Context, _ *mcp.CallToolRequest, args listDocsArgs) (*mcp.CallToolResult, any, error) {
	text := "docs ready"
	if strings.TrimSpace(args.Query) != "" {
		text = "docs for " + args.Query
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: text},
		},
	}, nil, nil
}

func mutateTool(_ context.Context, _ *mcp.CallToolRequest, _ any) (*mcp.CallToolResult, any, error) {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: "mutated"},
		},
	}, nil, nil
}

func newTestServer() *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "test-mcp-server",
		Version: "1.0.0",
	}, nil)

	destructive := true
	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_docs",
		Title:       "列出文档",
		Description: "Read-only tool for listing docs",
		Annotations: &mcp.ToolAnnotations{
			ReadOnlyHint: true,
			Title:        "列出文档",
		},
	}, listDocsTool)
	mcp.AddTool(server, &mcp.Tool{
		Name:        "mutate_doc",
		Title:       "修改文档",
		Description: "Write tool for mutating docs",
		Annotations: &mcp.ToolAnnotations{
			DestructiveHint: &destructive,
			Title:           "修改文档",
		},
	}, mutateTool)
	return server
}

func withBearer(handler http.Handler, token string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}
		handler.ServeHTTP(w, r)
	})
}

func TestTestMCPConnectionStreamableHTTP(t *testing.T) {
	srv := httptest.NewServer(mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return newTestServer()
	}, nil))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := TestMCPConnection(ctx, MCPConfig{
		Transport: "http",
		URL:       srv.URL,
	}, nil)
	if err != nil {
		t.Fatalf("TestMCPConnection: %v", err)
	}
	if result.ConnectionStatus != ConnectionStatusConnected {
		t.Fatalf("expected connected, got %q", result.ConnectionStatus)
	}
}

func TestDiscoverMCPToolsStreamableHTTP(t *testing.T) {
	srv := httptest.NewServer(mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return newTestServer()
	}, nil))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := DiscoverMCPTools(ctx, MCPConfig{
		Transport: "http",
		URL:       srv.URL,
	}, nil)
	if err != nil {
		t.Fatalf("DiscoverMCPTools: %v", err)
	}
	if len(result.Tools) != 2 {
		t.Fatalf("expected 2 tools, got %d", len(result.Tools))
	}
	if result.Tools[0].Safety != ToolSafetyReadOnly {
		t.Fatalf("expected first tool to be read_only, got %q", result.Tools[0].Safety)
	}
}

func TestCallMCPToolStreamableHTTP(t *testing.T) {
	srv := httptest.NewServer(mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return newTestServer()
	}, nil))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := CallMCPTool(ctx, MCPConfig{
		Transport: "http",
		URL:       srv.URL,
	}, nil, "list_docs", map[string]any{"query": "roadmap"})
	if err != nil {
		t.Fatalf("CallMCPTool: %v", err)
	}

	payload, ok := result.ToolResult.(map[string]any)
	if !ok {
		t.Fatalf("expected tool result payload map, got %#v", result.ToolResult)
	}
	content, ok := payload["content"].([]any)
	if !ok || len(content) == 0 {
		t.Fatalf("expected content entries, got %#v", payload["content"])
	}
	textItem, ok := content[0].(map[string]any)
	if !ok || !strings.Contains(textItem["text"].(string), "roadmap") {
		t.Fatalf("expected content text to include roadmap, got %#v", content[0])
	}
}

func TestTestMCPConnectionSSE(t *testing.T) {
	srv := httptest.NewServer(mcp.NewSSEHandler(func(*http.Request) *mcp.Server {
		return newTestServer()
	}, nil))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := TestMCPConnection(ctx, MCPConfig{
		Transport: "sse",
		URL:       srv.URL,
	}, nil)
	if err != nil {
		t.Fatalf("TestMCPConnection SSE: %v", err)
	}
	if result.ConnectionStatus != ConnectionStatusConnected {
		t.Fatalf("expected connected, got %q", result.ConnectionStatus)
	}
}

func TestTestMCPConnectionBearerAuth(t *testing.T) {
	handler := withBearer(mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return newTestServer()
	}, nil), "secret-token")
	srv := httptest.NewServer(handler)
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := TestMCPConnection(ctx, MCPConfig{
		Transport: "http",
		URL:       srv.URL,
		AuthType:  "bearer",
	}, &AuthSecretPayload{
		AuthType: "bearer",
		Bearer: &BearerSecretPayload{
			Token: "secret-token",
		},
	})
	if err != nil {
		t.Fatalf("TestMCPConnection bearer: %v", err)
	}
	if result.ConnectionStatus != ConnectionStatusConnected {
		t.Fatalf("expected connected, got %q", result.ConnectionStatus)
	}
}

func TestTestMCPConnectionMissingBearerNeedsAuth(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := TestMCPConnection(ctx, MCPConfig{
		Transport: "http",
		URL:       "https://example.com/mcp",
		AuthType:  "bearer",
	}, nil)
	if err == nil {
		t.Fatal("expected auth required error")
	}
	if msg, ok := IsAuthRequired(err); !ok || !strings.Contains(msg, "Bearer Token") {
		t.Fatalf("expected bearer auth required error, got %v", err)
	}
}

func TestTestMCPConnectionStdio(t *testing.T) {
	if os.Getenv("GO_WANT_SOURCE_STDIO_HELPER") == "1" {
		server := newTestServer()
		if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
			t.Fatalf("stdio helper server failed: %v", err)
		}
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := TestMCPConnection(ctx, MCPConfig{
		Transport: "stdio",
		Command:   os.Args[0],
		Args:      []string{"-test.run", "TestTestMCPConnectionStdio"},
		Env: map[string]string{
			"GO_WANT_SOURCE_STDIO_HELPER": "1",
		},
	}, nil)
	if err != nil {
		t.Fatalf("TestMCPConnection stdio: %v", err)
	}
	if result.ConnectionStatus != ConnectionStatusConnected {
		t.Fatalf("expected connected, got %q", result.ConnectionStatus)
	}
}
