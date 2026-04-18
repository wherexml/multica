package daemon

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	sourcepkg "github.com/multica-ai/multica/server/internal/source"
)

const sourceRunTimeout = 90 * time.Second

func (d *Daemon) sourcePollLoop(ctx context.Context) {
	sem := make(chan struct{}, maxInt(1, minInt(4, d.cfg.MaxConcurrentTasks)))
	var wg sync.WaitGroup
	pollOffset := 0

	for {
		select {
		case <-ctx.Done():
			waitDone := make(chan struct{})
			go func() { wg.Wait(); close(waitDone) }()
			select {
			case <-waitDone:
			case <-time.After(15 * time.Second):
				d.logger.Warn("timed out waiting for source runs")
			}
			return
		default:
		}

		runtimeIDs := d.allRuntimeIDs()
		if len(runtimeIDs) == 0 {
			if err := sleepWithContext(ctx, d.cfg.PollInterval); err != nil {
				return
			}
			continue
		}

		claimed := false
		for i := 0; i < len(runtimeIDs); i++ {
			select {
			case sem <- struct{}{}:
			default:
				goto sleep
			}

			runtimeID := runtimeIDs[(pollOffset+i)%len(runtimeIDs)]
			run, err := d.client.ClaimSourceRun(ctx, runtimeID)
			if err != nil {
				<-sem
				d.logger.Warn("claim source run failed", "runtime_id", runtimeID, "error", err)
				continue
			}
			if run == nil {
				<-sem
				continue
			}

			wg.Add(1)
			go func(job SourceRunJob) {
				defer wg.Done()
				defer func() { <-sem }()
				d.handleSourceRun(ctx, job)
			}(*run)
			claimed = true
			pollOffset = (pollOffset + i + 1) % len(runtimeIDs)
			break
		}

	sleep:
		if !claimed {
			pollOffset = (pollOffset + 1) % len(runtimeIDs)
			if err := sleepWithContext(ctx, d.cfg.PollInterval); err != nil {
				return
			}
		}
	}
}

func (d *Daemon) handleSourceRun(ctx context.Context, run SourceRunJob) {
	log := d.logger.With("source_run", shortID(run.ID), "run_type", run.RunType)
	if run.Source == nil || run.Source.MCP == nil {
		_ = d.client.FailSourceRun(ctx, run.ID, "source payload is incomplete", "source payload is incomplete", map[string]any{
			"connection_status": "failed",
		}, "failed")
		return
	}

	secret := daemonSecretToPayload(run.Source.Auth)
	config := sourcepkg.MCPConfig{
		Transport: run.Source.MCP.Transport,
		URL:       run.Source.MCP.URL,
		AuthType:  run.Source.MCP.AuthType,
		ClientID:  run.Source.MCP.ClientID,
		Command:   run.Source.MCP.Command,
		Args:      run.Source.MCP.Args,
		Env:       run.Source.MCP.Env,
		Headers:   run.Source.MCP.Headers,
	}

	opCtx, cancel := context.WithTimeout(ctx, sourceRunTimeout)
	defer cancel()

	var (
		outcome sourcepkg.OperationOutcome
		err     error
	)

	switch run.RunType {
	case "test":
		outcome, err = sourcepkg.TestMCPConnection(opCtx, config, secret)
	case "discover_tools":
		outcome, err = sourcepkg.DiscoverMCPTools(opCtx, config, secret)
	case "call_tool":
		args := map[string]any{}
		if payload, ok := run.RequestPayload.(map[string]any); ok {
			if rawArgs, ok := payload["arguments"].(map[string]any); ok {
				args = rawArgs
			}
		}
		outcome, err = sourcepkg.CallMCPTool(opCtx, config, secret, run.ToolName, args)
	default:
		err = fmt.Errorf("unsupported source run type %q", run.RunType)
	}

	if err != nil {
		status := "failed"
		connectionStatus := "failed"
		if msg, ok := sourcepkg.IsAuthRequired(err); ok {
			status = "blocked"
			connectionStatus = "needs_auth"
			log.Warn("source run blocked", "error", msg)
			_ = d.client.FailSourceRun(ctx, run.ID, msg, msg, map[string]any{
				"connection_status": connectionStatus,
				"message":           msg,
			}, status)
			return
		}

		log.Warn("source run failed", "error", err)
		_ = d.client.FailSourceRun(ctx, run.ID, err.Error(), err.Error(), map[string]any{
			"connection_status": connectionStatus,
			"message":           err.Error(),
		}, status)
		return
	}

	resultPayload := map[string]any{
		"connection_status": string(outcome.ConnectionStatus),
		"message":           outcome.Message,
	}
	if outcome.ErrorMessage != "" {
		resultPayload["error_message"] = outcome.ErrorMessage
	}
	if outcome.Server != nil {
		resultPayload["server"] = outcome.Server
	}
	if len(outcome.Tools) > 0 {
		resultPayload["tools"] = outcome.Tools
	}
	if outcome.ToolName != "" {
		resultPayload["tool_name"] = outcome.ToolName
	}
	if outcome.ToolResult != nil {
		resultPayload["tool_result"] = outcome.ToolResult
	}
	if outcome.IsToolError {
		resultPayload["is_tool_error"] = true
	}

	if outcome.IsToolError {
		log.Warn("source tool returned error", "tool_name", run.ToolName)
		_ = d.client.FailSourceRun(ctx, run.ID, firstNonEmpty(outcome.Message, "tool returned error"), firstNonEmpty(outcome.ErrorMessage, outcome.Message), resultPayload, "failed")
		return
	}

	log.Info("source run completed", "tool_name", run.ToolName)
	_ = d.client.CompleteSourceRun(ctx, run.ID, resultPayload, firstNonEmpty(outcome.Message, "completed"))
}

func daemonSecretToPayload(auth *SourceRunAuth) *sourcepkg.AuthSecretPayload {
	if auth == nil {
		return nil
	}

	payload := &sourcepkg.AuthSecretPayload{
		AuthType: strings.TrimSpace(auth.AuthType),
	}
	if auth.BearerToken != "" {
		payload.Bearer = &sourcepkg.BearerSecretPayload{
			Token: auth.BearerToken,
		}
	}
	if auth.OAuth != nil {
		payload.OAuth = &sourcepkg.OAuthSecretPayload{
			AccessToken:  auth.OAuth.AccessToken,
			RefreshToken: auth.OAuth.RefreshToken,
			TokenType:    auth.OAuth.TokenType,
			ExpiresAt:    auth.OAuth.ExpiresAt,
			Metadata:     auth.OAuth.Metadata,
		}
	}
	return payload
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

var _ = slog.LevelInfo
