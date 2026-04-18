package source

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type ToolSnapshot struct {
	Name        string         `json:"name"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Safety      ToolSafety     `json:"safety"`
	InputSchema map[string]any `json:"input_schema"`
	Annotations map[string]any `json:"annotations"`
}

type ServerInfo struct {
	Name    string `json:"name"`
	Title   string `json:"title,omitempty"`
	Version string `json:"version"`
}

type OperationOutcome struct {
	ConnectionStatus ConnectionStatus `json:"connection_status"`
	Message          string           `json:"message"`
	ErrorMessage     string           `json:"error_message,omitempty"`
	Server           *ServerInfo      `json:"server,omitempty"`
	Tools            []ToolSnapshot   `json:"tools,omitempty"`
	ToolName         string           `json:"tool_name,omitempty"`
	ToolResult       any              `json:"tool_result,omitempty"`
	IsToolError      bool             `json:"is_tool_error,omitempty"`
}

type headerTransport struct {
	base    http.RoundTripper
	headers http.Header
}

func (t *headerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	cloned := req.Clone(req.Context())
	cloned.Header = req.Header.Clone()
	for key, values := range t.headers {
		cloned.Header.Del(key)
		for _, value := range values {
			cloned.Header.Add(key, value)
		}
	}
	return t.base.RoundTrip(cloned)
}

func TestMCPConnection(ctx context.Context, config MCPConfig, secret *AuthSecretPayload) (OperationOutcome, error) {
	session, info, err := connectSession(ctx, config, secret)
	if err != nil {
		return OperationOutcome{}, err
	}
	defer session.Close()

	if err := session.Ping(ctx, nil); err != nil {
		return OperationOutcome{}, normalizeTransportError(config, err)
	}

	return OperationOutcome{
		ConnectionStatus: ConnectionStatusConnected,
		Message:          "连接测试通过，MCP 会话已成功建立",
		Server:           info,
	}, nil
}

func DiscoverMCPTools(ctx context.Context, config MCPConfig, secret *AuthSecretPayload) (OperationOutcome, error) {
	session, info, err := connectSession(ctx, config, secret)
	if err != nil {
		return OperationOutcome{}, err
	}
	defer session.Close()

	tools, err := listTools(ctx, session)
	if err != nil {
		return OperationOutcome{}, normalizeTransportError(config, err)
	}

	return OperationOutcome{
		ConnectionStatus: ConnectionStatusConnected,
		Message:          fmt.Sprintf("已发现 %d 个工具", len(tools)),
		Server:           info,
		Tools:            tools,
	}, nil
}

func CallMCPTool(ctx context.Context, config MCPConfig, secret *AuthSecretPayload, toolName string, args map[string]any) (OperationOutcome, error) {
	session, info, err := connectSession(ctx, config, secret)
	if err != nil {
		return OperationOutcome{}, err
	}
	defer session.Close()

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      toolName,
		Arguments: args,
	})
	if err != nil {
		return OperationOutcome{}, normalizeTransportError(config, err)
	}

	payload := map[string]any{
		"is_error":           result.IsError,
		"content":            marshalContentList(result.Content),
		"structured_content": normalizeJSONValue(result.StructuredContent),
	}

	message := "工具调用成功"
	if result.IsError {
		message = "工具返回了错误结果"
	}

	return OperationOutcome{
		ConnectionStatus: ConnectionStatusConnected,
		Message:          message,
		Server:           info,
		ToolName:         toolName,
		ToolResult:       payload,
		IsToolError:      result.IsError,
	}, nil
}

func connectSession(ctx context.Context, rawConfig MCPConfig, secret *AuthSecretPayload) (*mcp.ClientSession, *ServerInfo, error) {
	config := SanitizeMCPConfig(rawConfig)
	if err := ValidateMCPConfigShape(config); err != nil {
		return nil, nil, err
	}

	client := mcp.NewClient(&mcp.Implementation{
		Name:    "multica-source-client",
		Title:   "Multica Sources",
		Version: "1.0.0",
	}, nil)

	transport, err := buildTransport(ctx, config, secret)
	if err != nil {
		return nil, nil, err
	}

	session, err := client.Connect(ctx, transport, nil)
	if err != nil {
		return nil, nil, normalizeTransportError(config, err)
	}

	info := serverInfoFromSession(session)
	return session, info, nil
}

func buildTransport(ctx context.Context, config MCPConfig, secret *AuthSecretPayload) (mcp.Transport, error) {
	switch strings.ToLower(strings.TrimSpace(config.Transport)) {
	case "http":
		httpClient, err := buildHTTPClient(config, secret)
		if err != nil {
			return nil, err
		}
		return &mcp.StreamableClientTransport{
			Endpoint:             config.URL,
			HTTPClient:           httpClient,
			DisableStandaloneSSE: true,
			MaxRetries:           1,
		}, nil
	case "sse":
		httpClient, err := buildHTTPClient(config, secret)
		if err != nil {
			return nil, err
		}
		return &mcp.SSEClientTransport{
			Endpoint:   config.URL,
			HTTPClient: httpClient,
		}, nil
	case "stdio":
		cmd := exec.CommandContext(ctx, config.Command, config.Args...)
		cmd.Env = buildCommandEnv(config, secret)
		return &mcp.CommandTransport{
			Command:           cmd,
			TerminateDuration: 3 * time.Second,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported MCP transport %q", config.Transport)
	}
}

func buildHTTPClient(config MCPConfig, secret *AuthSecretPayload) (*http.Client, error) {
	headers := http.Header{}
	for key, value := range config.Headers {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		headers.Set(key, trimmed)
	}

	if authHeader, err := authorizationHeader(config, secret); err != nil {
		return nil, err
	} else if authHeader != "" {
		headers.Set("Authorization", authHeader)
	}

	base := http.DefaultTransport
	if transport, ok := http.DefaultTransport.(*http.Transport); ok {
		base = transport.Clone()
	}

	return &http.Client{
		Transport: &headerTransport{
			base:    base,
			headers: headers,
		},
	}, nil
}

func buildCommandEnv(config MCPConfig, secret *AuthSecretPayload) []string {
	env := append([]string{}, os.Environ()...)
	for key, value := range config.Env {
		env = append(env, key+"="+value)
	}
	if secret == nil {
		return env
	}
	switch strings.ToLower(strings.TrimSpace(secret.AuthType)) {
	case "bearer":
		if secret.Bearer != nil && strings.TrimSpace(secret.Bearer.Token) != "" {
			env = append(env, "MCP_AUTH_TYPE=bearer", "MCP_BEARER_TOKEN="+secret.Bearer.Token)
		}
	case "oauth":
		if secret.OAuth != nil {
			env = append(env, "MCP_AUTH_TYPE=oauth")
			if secret.OAuth.AccessToken != "" {
				env = append(env, "MCP_OAUTH_ACCESS_TOKEN="+secret.OAuth.AccessToken)
			}
			if secret.OAuth.RefreshToken != "" {
				env = append(env, "MCP_OAUTH_REFRESH_TOKEN="+secret.OAuth.RefreshToken)
			}
			if secret.OAuth.TokenType != "" {
				env = append(env, "MCP_OAUTH_TOKEN_TYPE="+secret.OAuth.TokenType)
			}
			if secret.OAuth.ExpiresAt != "" {
				env = append(env, "MCP_OAUTH_EXPIRES_AT="+secret.OAuth.ExpiresAt)
			}
		}
	}
	return env
}

func authorizationHeader(config MCPConfig, secret *AuthSecretPayload) (string, error) {
	switch strings.ToLower(strings.TrimSpace(config.AuthType)) {
	case "", "none":
		return "", nil
	case "bearer":
		if secret == nil || secret.Bearer == nil || strings.TrimSpace(secret.Bearer.Token) == "" {
			return "", ErrAuthRequired("还缺少 Bearer Token，请先补充认证信息")
		}
		return "Bearer " + strings.TrimSpace(secret.Bearer.Token), nil
	case "oauth":
		if secret == nil || secret.OAuth == nil || strings.TrimSpace(secret.OAuth.AccessToken) == "" {
			return "", ErrAuthRequired("还缺少 OAuth token bundle，请先补充认证信息")
		}
		tokenType := strings.TrimSpace(secret.OAuth.TokenType)
		if tokenType == "" {
			tokenType = "Bearer"
		}
		return tokenType + " " + strings.TrimSpace(secret.OAuth.AccessToken), nil
	default:
		return "", fmt.Errorf("unsupported auth type %q", config.AuthType)
	}
}

func normalizeTransportError(config MCPConfig, err error) error {
	if msg, ok := IsAuthRequired(err); ok {
		return ErrAuthRequired(msg)
	}

	raw := strings.ToLower(err.Error())
	authType := strings.ToLower(strings.TrimSpace(config.AuthType))
	if authType != "none" && authType != "" {
		if strings.Contains(raw, "401") || strings.Contains(raw, "403") ||
			strings.Contains(raw, "unauthorized") || strings.Contains(raw, "forbidden") {
			return ErrAuthRequired("认证信息无效或已过期，请更新后重试")
		}
	}
	return err
}

func listTools(ctx context.Context, session *mcp.ClientSession) ([]ToolSnapshot, error) {
	cursor := ""
	var results []ToolSnapshot
	for {
		result, err := session.ListTools(ctx, &mcp.ListToolsParams{Cursor: cursor})
		if err != nil {
			return nil, err
		}
		for _, tool := range result.Tools {
			results = append(results, toolToSnapshot(tool))
		}
		if result.NextCursor == "" {
			return results, nil
		}
		cursor = result.NextCursor
	}
}

func toolToSnapshot(tool *mcp.Tool) ToolSnapshot {
	annotations := toolAnnotationsMap(tool.Annotations)
	title := strings.TrimSpace(tool.Title)
	if title == "" && tool.Annotations != nil {
		title = strings.TrimSpace(tool.Annotations.Title)
	}
	if title == "" {
		title = tool.Name
	}

	return ToolSnapshot{
		Name:        tool.Name,
		Title:       title,
		Description: tool.Description,
		Safety:      ClassifyToolSafetyForTool(tool.Name, tool.Description, annotations),
		InputSchema: normalizeJSONObject(tool.InputSchema),
		Annotations: annotations,
	}
}

func toolAnnotationsMap(annotations *mcp.ToolAnnotations) map[string]any {
	if annotations == nil {
		return map[string]any{}
	}
	data, err := json.Marshal(annotations)
	if err != nil {
		return map[string]any{}
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return map[string]any{}
	}
	return result
}

func normalizeJSONObject(value any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	data, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return map[string]any{}
	}
	return result
}

func normalizeJSONValue(value any) any {
	if value == nil {
		return nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var result any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}
	return result
}

func marshalContentList(content []mcp.Content) []any {
	if len(content) == 0 {
		return []any{}
	}
	result := make([]any, 0, len(content))
	for _, item := range content {
		data, err := item.MarshalJSON()
		if err != nil {
			continue
		}
		var decoded any
		if err := json.Unmarshal(data, &decoded); err != nil {
			continue
		}
		result = append(result, decoded)
	}
	return result
}

func serverInfoFromSession(session *mcp.ClientSession) *ServerInfo {
	result := session.InitializeResult()
	if result == nil || result.ServerInfo == nil {
		return nil
	}
	return &ServerInfo{
		Name:    result.ServerInfo.Name,
		Title:   result.ServerInfo.Title,
		Version: result.ServerInfo.Version,
	}
}
