package source

import "testing"

func TestValidateMCPConfigShape(t *testing.T) {
	tests := []struct {
		name    string
		config  MCPConfig
		wantErr bool
	}{
		{
			name: "http transport accepts valid url",
			config: MCPConfig{
				Transport: "http",
				URL:       "https://mcp.example.com",
			},
		},
		{
			name: "sse transport requires url",
			config: MCPConfig{
				Transport: "sse",
			},
			wantErr: true,
		},
		{
			name: "stdio transport requires command",
			config: MCPConfig{
				Transport: "stdio",
			},
			wantErr: true,
		},
		{
			name: "stdio transport accepts command",
			config: MCPConfig{
				Transport: "stdio",
				Command:   "npx",
				Args:      []string{"-y", "@modelcontextprotocol/server-filesystem"},
			},
		},
		{
			name: "rejects unknown transport",
			config: MCPConfig{
				Transport: "grpc",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateMCPConfigShape(tt.config)
			if tt.wantErr && err == nil {
				t.Fatal("expected validation error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func TestTestMCPConfig(t *testing.T) {
	base := MCPConfig{
		Transport: "http",
		URL:       "https://mcp.example.com",
	}

	t.Run("offline runtime fails", func(t *testing.T) {
		result := TestMCPConfig(base, false)
		if result.Status != ConnectionStatusFailed {
			t.Fatalf("expected failed status, got %q", result.Status)
		}
	})

	t.Run("no auth connects", func(t *testing.T) {
		result := TestMCPConfig(base, true)
		if result.Status != ConnectionStatusConnected {
			t.Fatalf("expected connected status, got %q", result.Status)
		}
	})

	t.Run("missing bearer token needs auth", func(t *testing.T) {
		result := TestMCPConfig(MCPConfig{
			Transport: "http",
			URL:       "https://mcp.example.com",
			AuthType:  "bearer",
		}, true)
		if result.Status != ConnectionStatusNeedsAuth {
			t.Fatalf("expected needs_auth status, got %q", result.Status)
		}
	})

	t.Run("configured bearer token connects", func(t *testing.T) {
		result := TestMCPConfig(MCPConfig{
			Transport: "http",
			URL:       "https://mcp.example.com",
			AuthType:  "bearer",
			Headers: map[string]string{
				"Authorization": "Bearer secret",
			},
		}, true)
		if result.Status != ConnectionStatusConnected {
			t.Fatalf("expected connected status, got %q", result.Status)
		}
	})

	t.Run("oauth waits for auth", func(t *testing.T) {
		result := TestMCPConfig(MCPConfig{
			Transport: "http",
			URL:       "https://mcp.example.com",
			AuthType:  "oauth",
			ClientID:  "client-id",
		}, true)
		if result.Status != ConnectionStatusNeedsAuth {
			t.Fatalf("expected needs_auth status, got %q", result.Status)
		}
	})
}
