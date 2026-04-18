package source

import (
	"net/url"
	"strings"
)

type ConnectionStatus string

const (
	ConnectionStatusConnected ConnectionStatus = "connected"
	ConnectionStatusNeedsAuth ConnectionStatus = "needs_auth"
	ConnectionStatusFailed    ConnectionStatus = "failed"
)

type MCPConfig struct {
	Transport string            `json:"transport"`
	URL       string            `json:"url,omitempty"`
	AuthType  string            `json:"auth_type,omitempty"`
	ClientID  string            `json:"client_id,omitempty"`
	Command   string            `json:"command,omitempty"`
	Args      []string          `json:"args,omitempty"`
	Env       map[string]string `json:"env,omitempty"`
	Headers   map[string]string `json:"headers,omitempty"`
}

type TestResult struct {
	Status       ConnectionStatus
	Message      string
	ErrorMessage string
}

func ValidateMCPConfigShape(config MCPConfig) error {
	transport := strings.TrimSpace(strings.ToLower(config.Transport))
	switch transport {
	case "http", "sse":
		rawURL := strings.TrimSpace(config.URL)
		if rawURL == "" {
			return errInvalidConfig("远程 MCP 需要填写服务地址")
		}
		parsed, err := url.Parse(rawURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return errInvalidConfig("MCP 服务地址格式不正确")
		}
	case "stdio":
		if strings.TrimSpace(config.Command) == "" {
			return errInvalidConfig("本地 MCP 需要填写启动命令")
		}
	default:
		return errInvalidConfig("暂不支持的 MCP 传输方式")
	}

	return nil
}

func TestMCPConfig(config MCPConfig, runtimeOnline bool) TestResult {
	if !runtimeOnline {
		return TestResult{
			Status:       ConnectionStatusFailed,
			Message:      "绑定的执行环境当前离线，无法完成连接测试",
			ErrorMessage: "绑定的执行环境当前离线，无法完成连接测试",
		}
	}

	if err := ValidateMCPConfigShape(config); err != nil {
		return TestResult{
			Status:       ConnectionStatusFailed,
			Message:      err.Error(),
			ErrorMessage: err.Error(),
		}
	}

	authType := strings.TrimSpace(strings.ToLower(config.AuthType))
	switch authType {
	case "", "none":
		return TestResult{
			Status:  ConnectionStatusConnected,
			Message: "配置校验通过，当前已具备基础连接条件",
		}
	case "bearer":
		if hasAuthorizationHeader(config.Headers) {
			return TestResult{
				Status:  ConnectionStatusConnected,
				Message: "Bearer 认证信息已配置，当前已具备基础连接条件",
			}
		}
		return TestResult{
			Status:  ConnectionStatusNeedsAuth,
			Message: "还缺少 Bearer Token，补充认证信息后可继续连接",
		}
	case "oauth":
		if strings.TrimSpace(config.ClientID) == "" {
			return TestResult{
				Status:  ConnectionStatusNeedsAuth,
				Message: "需要先补充 OAuth Client ID，后续才能接入授权流程",
			}
		}
		return TestResult{
			Status:  ConnectionStatusNeedsAuth,
			Message: "OAuth 字段已填写，等待二期接入真实授权流程",
		}
	default:
		return TestResult{
			Status:       ConnectionStatusFailed,
			Message:      "不支持的认证方式",
			ErrorMessage: "不支持的认证方式",
		}
	}
}

func hasAuthorizationHeader(headers map[string]string) bool {
	for key, value := range headers {
		if strings.EqualFold(key, "authorization") && strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}

type invalidConfigError struct {
	message string
}

func (e invalidConfigError) Error() string {
	return e.message
}

func errInvalidConfig(message string) error {
	return invalidConfigError{message: message}
}
