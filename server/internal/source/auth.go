package source

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

type ToolSafety string

const (
	ToolSafetyReadOnly ToolSafety = "read_only"
	ToolSafetyWrite    ToolSafety = "write"
	ToolSafetyUnknown  ToolSafety = "unknown"
)

type BearerSecretPayload struct {
	Token string `json:"token"`
}

type OAuthSecretPayload struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token,omitempty"`
	TokenType    string         `json:"token_type,omitempty"`
	ExpiresAt    string         `json:"expires_at,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
}

type AuthSecretPayload struct {
	AuthType string               `json:"auth_type"`
	Bearer   *BearerSecretPayload `json:"bearer,omitempty"`
	OAuth    *OAuthSecretPayload  `json:"oauth,omitempty"`
}

type EncryptedSecret struct {
	Ciphertext []byte
	Nonce      []byte
}

type SecretCipher struct {
	key [32]byte
}

type authRequiredError struct {
	message string
}

func (e authRequiredError) Error() string {
	return e.message
}

func NewSecretCipher(secret string) *SecretCipher {
	sum := sha256.Sum256([]byte(strings.TrimSpace(secret)))
	return &SecretCipher{key: sum}
}

func LoadSecretCipherFromEnv() (*SecretCipher, error) {
	secret := strings.TrimSpace(os.Getenv("SOURCE_SECRET_KEY"))
	if secret == "" {
		return nil, fmt.Errorf("SOURCE_SECRET_KEY is not configured")
	}
	return NewSecretCipher(secret), nil
}

func (c *SecretCipher) EncryptPayload(payload AuthSecretPayload) (EncryptedSecret, error) {
	plain, err := json.Marshal(payload)
	if err != nil {
		return EncryptedSecret{}, err
	}

	block, err := aes.NewCipher(c.key[:])
	if err != nil {
		return EncryptedSecret{}, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return EncryptedSecret{}, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return EncryptedSecret{}, err
	}

	return EncryptedSecret{
		Ciphertext: gcm.Seal(nil, nonce, plain, nil),
		Nonce:      nonce,
	}, nil
}

func (c *SecretCipher) DecryptPayload(ciphertext, nonce []byte, out *AuthSecretPayload) error {
	block, err := aes.NewCipher(c.key[:])
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return err
	}

	return json.Unmarshal(plain, out)
}

func SanitizeMCPConfig(config MCPConfig) MCPConfig {
	headers := make(map[string]string, len(config.Headers))
	for key, value := range config.Headers {
		if strings.EqualFold(key, "authorization") {
			continue
		}
		headers[key] = value
	}

	config.Headers = headers
	return config
}

func ClassifyToolSafety(annotations map[string]any) ToolSafety {
	if len(annotations) == 0 {
		return ToolSafetyUnknown
	}

	if readOnly, ok := boolAnnotation(annotations, "readOnlyHint"); ok && readOnly {
		return ToolSafetyReadOnly
	}

	if _, ok := boolAnnotation(annotations, "destructiveHint"); ok {
		return ToolSafetyWrite
	}
	if _, ok := boolAnnotation(annotations, "idempotentHint"); ok {
		return ToolSafetyWrite
	}

	return ToolSafetyUnknown
}

func ClassifyToolSafetyForTool(name, description string, annotations map[string]any) ToolSafety {
	safety := ClassifyToolSafety(annotations)
	if safety != ToolSafetyUnknown {
		return safety
	}
	return inferToolSafety(name, description)
}

func inferToolSafety(name, description string) ToolSafety {
	normalizedName := normalizeToolName(name)
	if normalizedName != "" {
		if hasToolPrefix(normalizedName, writeToolPrefixes) {
			return ToolSafetyWrite
		}
		if hasToolPrefix(normalizedName, readOnlyToolPrefixes) {
			return ToolSafetyReadOnly
		}
	}

	normalizedDescription := strings.ToLower(strings.TrimSpace(description))
	if normalizedDescription == "" {
		return ToolSafetyUnknown
	}
	if strings.Contains(normalizedDescription, "read-only") || strings.Contains(normalizedDescription, "readonly") {
		return ToolSafetyReadOnly
	}
	if strings.Contains(normalizedDescription, "write") ||
		strings.Contains(normalizedDescription, "mutate") ||
		strings.Contains(normalizedDescription, "create") ||
		strings.Contains(normalizedDescription, "update") ||
		strings.Contains(normalizedDescription, "delete") ||
		strings.Contains(normalizedDescription, "remove") ||
		strings.Contains(normalizedDescription, "save") {
		return ToolSafetyWrite
	}
	return ToolSafetyUnknown
}

func normalizeToolName(name string) string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.NewReplacer("-", "_", ".", "_", ":", "_", "/", "_").Replace(normalized)
	return normalized
}

func hasToolPrefix(name string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

var readOnlyToolPrefixes = []string{
	"analyze_",
	"check_",
	"describe_",
	"fetch_",
	"find_",
	"get_",
	"inspect_",
	"is_",
	"list_",
	"lookup_",
	"parse_",
	"qcc_company_get_",
	"qcc_company_verify_",
	"qcc_ipr_get_",
	"qcc_operation_get_",
	"qcc_risk_get_",
	"query_",
	"read_",
	"scan_",
	"screen_",
	"search_",
	"ts2_get_",
	"ts_get_",
	"ts_screen_",
	"validate_",
	"verify_",
	"xtick_get_",
}

var writeToolPrefixes = []string{
	"add_",
	"approve_",
	"archive_",
	"cancel_",
	"create_",
	"delete_",
	"execute_",
	"extract_and_update_",
	"mutate_",
	"patch_",
	"post_",
	"put_",
	"record_",
	"reject_",
	"remove_",
	"run_",
	"save_",
	"send_",
	"set_",
	"start_",
	"stop_",
	"submit_",
	"trigger_",
	"update_",
	"upsert_",
	"write_",
}

func boolAnnotation(annotations map[string]any, key string) (bool, bool) {
	raw, ok := annotations[key]
	if !ok {
		return false, false
	}

	value, ok := raw.(bool)
	return value, ok
}

func ErrAuthRequired(message string) error {
	return authRequiredError{message: message}
}

func IsAuthRequired(err error) (string, bool) {
	target, ok := err.(authRequiredError)
	if !ok {
		return "", false
	}
	return target.message, true
}

func BuildSecretPreview(payload AuthSecretPayload) string {
	switch strings.ToLower(strings.TrimSpace(payload.AuthType)) {
	case "bearer":
		if payload.Bearer == nil {
			return ""
		}
		return "Bearer " + maskSecretValue(payload.Bearer.Token)
	case "oauth":
		if payload.OAuth == nil {
			return ""
		}
		tokenType := strings.TrimSpace(payload.OAuth.TokenType)
		if tokenType == "" {
			tokenType = "Bearer"
		}
		return tokenType + " " + maskSecretValue(payload.OAuth.AccessToken)
	default:
		return ""
	}
}

func maskSecretValue(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) <= 4 {
		return "••••"
	}
	return "••••" + trimmed[len(trimmed)-4:]
}
