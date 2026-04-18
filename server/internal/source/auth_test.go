package source

import "testing"

func TestSecretCipherRoundTrip(t *testing.T) {
	cipher := NewSecretCipher("test-secret-key")
	payload := AuthSecretPayload{
		AuthType: "bearer",
		Bearer: &BearerSecretPayload{
			Token: "super-secret-token",
		},
	}

	encrypted, err := cipher.EncryptPayload(payload)
	if err != nil {
		t.Fatalf("EncryptPayload: %v", err)
	}

	var decoded AuthSecretPayload
	if err := cipher.DecryptPayload(encrypted.Ciphertext, encrypted.Nonce, &decoded); err != nil {
		t.Fatalf("DecryptPayload: %v", err)
	}

	if decoded.AuthType != "bearer" {
		t.Fatalf("expected auth type bearer, got %q", decoded.AuthType)
	}
	if decoded.Bearer == nil || decoded.Bearer.Token != "super-secret-token" {
		t.Fatalf("expected bearer token round-trip, got %+v", decoded.Bearer)
	}
}

func TestSanitizeMCPConfigStripsAuthorizationHeader(t *testing.T) {
	config := SanitizeMCPConfig(MCPConfig{
		Transport: "http",
		URL:       "https://mcp.example.com",
		AuthType:  "bearer",
		Headers: map[string]string{
			"Authorization": "Bearer secret",
			"X-Test":        "value",
		},
	})

	if _, ok := config.Headers["Authorization"]; ok {
		t.Fatal("expected Authorization header to be removed")
	}
	if got := config.Headers["X-Test"]; got != "value" {
		t.Fatalf("expected X-Test header to remain, got %q", got)
	}
}

func TestClassifyToolSafety(t *testing.T) {
	t.Run("read only hint wins", func(t *testing.T) {
		if got := ClassifyToolSafety(map[string]any{"readOnlyHint": true}); got != ToolSafetyReadOnly {
			t.Fatalf("expected read_only, got %q", got)
		}
	})

	t.Run("explicit destructive false still treated as write when not read only", func(t *testing.T) {
		if got := ClassifyToolSafety(map[string]any{"destructiveHint": false}); got != ToolSafetyWrite {
			t.Fatalf("expected write, got %q", got)
		}
	})

	t.Run("missing hints defaults to unknown", func(t *testing.T) {
		if got := ClassifyToolSafety(nil); got != ToolSafetyUnknown {
			t.Fatalf("expected unknown, got %q", got)
		}
	})
}

func TestClassifyToolSafetyForTool(t *testing.T) {
	t.Run("annotation wins over inferred write name", func(t *testing.T) {
		got := ClassifyToolSafetyForTool("update_report", "", map[string]any{"readOnlyHint": true})
		if got != ToolSafetyReadOnly {
			t.Fatalf("expected read_only, got %q", got)
		}
	})

	t.Run("infers read only query tools without annotations", func(t *testing.T) {
		cases := []string{
			"get_market_quote",
			"search_news",
			"list_condition_orders",
			"ts_get_daily",
			"ts_screen_by_daily_basic",
			"qcc_risk_get_tax_violation",
			"is_trading_day",
			"screen_by_ma",
		}
		for _, name := range cases {
			if got := ClassifyToolSafetyForTool(name, "", nil); got != ToolSafetyReadOnly {
				t.Fatalf("expected %q to be read_only, got %q", name, got)
			}
		}
	})

	t.Run("infers write tools without annotations", func(t *testing.T) {
		cases := []string{
			"add_to_watchlist",
			"create_condition_order",
			"delete_condition_order",
			"extract_and_update_strategy",
			"record_evolution_event",
			"save_digest_template",
			"set_screen_rule_active",
			"trigger_tracking_task",
			"update_strategy",
			"upsert_screen_rule",
		}
		for _, name := range cases {
			if got := ClassifyToolSafetyForTool(name, "", nil); got != ToolSafetyWrite {
				t.Fatalf("expected %q to be write, got %q", name, got)
			}
		}
	})

	t.Run("keeps ambiguous tools unknown", func(t *testing.T) {
		if got := ClassifyToolSafetyForTool("sync_market_state", "", nil); got != ToolSafetyUnknown {
			t.Fatalf("expected unknown, got %q", got)
		}
	})

	t.Run("uses explicit read only description for ambiguous tools", func(t *testing.T) {
		got := ClassifyToolSafetyForTool("company_profile", "Read-only tool for company profile", nil)
		if got != ToolSafetyReadOnly {
			t.Fatalf("expected read_only, got %q", got)
		}
	})
}
