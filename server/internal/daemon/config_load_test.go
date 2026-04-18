package daemon

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigDetectsGeminiCLI(t *testing.T) {
	tempDir := t.TempDir()
	geminiPath := filepath.Join(tempDir, "gemini")
	if err := os.WriteFile(geminiPath, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatalf("write gemini stub: %v", err)
	}

	t.Setenv("PATH", tempDir)
	t.Setenv("MULTICA_WORKSPACES_ROOT", filepath.Join(tempDir, "workspaces"))
	t.Setenv("MULTICA_SERVER_URL", "http://localhost:22201")
	t.Setenv("MULTICA_CLAUDE_PATH", "claude")
	t.Setenv("MULTICA_CODEX_PATH", "codex")
	t.Setenv("MULTICA_OPENCODE_PATH", "opencode")
	t.Setenv("MULTICA_OPENCLAW_PATH", "openclaw")
	t.Setenv("MULTICA_HERMES_PATH", "hermes")
	t.Setenv("MULTICA_GEMINI_PATH", "gemini")

	cfg, err := LoadConfig(Overrides{})
	if err != nil {
		t.Fatalf("LoadConfig returned error: %v", err)
	}

	entry, ok := cfg.Agents["gemini"]
	if !ok {
		t.Fatal("expected gemini agent to be detected")
	}
	if entry.Path != "gemini" {
		t.Fatalf("gemini path = %q, want %q", entry.Path, "gemini")
	}
}
