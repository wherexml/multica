package daemon

import "context"

type SourceRunAuth struct {
	AuthType    string          `json:"auth_type"`
	BearerToken string          `json:"bearer_token,omitempty"`
	OAuth       *SourceRunOAuth `json:"oauth,omitempty"`
}

type SourceRunOAuth struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token,omitempty"`
	TokenType    string         `json:"token_type,omitempty"`
	ExpiresAt    string         `json:"expires_at,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
}

type SourceRunMCPConfig struct {
	Transport string            `json:"transport"`
	URL       string            `json:"url,omitempty"`
	AuthType  string            `json:"auth_type,omitempty"`
	ClientID  string            `json:"client_id,omitempty"`
	Command   string            `json:"command,omitempty"`
	Args      []string          `json:"args,omitempty"`
	Env       map[string]string `json:"env,omitempty"`
	Headers   map[string]string `json:"headers,omitempty"`
}

type SourceRunSource struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	RuntimeID string             `json:"runtime_id"`
	MCP       *SourceRunMCPConfig `json:"mcp,omitempty"`
	Auth      *SourceRunAuth     `json:"auth,omitempty"`
}

type SourceRunJob struct {
	ID             string `json:"id"`
	SourceID       string `json:"source_id"`
	RuntimeID      string `json:"runtime_id"`
	RunType        string `json:"run_type"`
	Status         string `json:"status"`
	ToolName       string `json:"tool_name"`
	RequestPayload any    `json:"request_payload"`
	Source         *SourceRunSource `json:"source,omitempty"`
}

func (c *Client) ClaimSourceRun(ctx context.Context, runtimeID string) (*SourceRunJob, error) {
	var resp struct {
		Run *SourceRunJob `json:"run"`
	}
	if err := c.postJSON(ctx, "/api/daemon/runtimes/"+runtimeID+"/source-runs/claim", map[string]any{}, &resp); err != nil {
		return nil, err
	}
	return resp.Run, nil
}

func (c *Client) CompleteSourceRun(ctx context.Context, runID string, resultPayload map[string]any, summary string) error {
	return c.postJSON(ctx, "/api/daemon/source-runs/"+runID+"/complete", map[string]any{
		"summary":        summary,
		"result_payload": resultPayload,
	}, nil)
}

func (c *Client) FailSourceRun(ctx context.Context, runID, summary, errorMessage string, resultPayload map[string]any, status string) error {
	body := map[string]any{
		"summary":        summary,
		"error_message":  errorMessage,
		"result_payload": resultPayload,
	}
	if status != "" {
		body["status"] = status
	}
	return c.postJSON(ctx, "/api/daemon/source-runs/"+runID+"/fail", body, nil)
}
