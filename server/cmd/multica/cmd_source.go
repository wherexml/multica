package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/multica-ai/multica/server/internal/cli"
)

var sourceCmd = &cobra.Command{
	Use:   "source",
	Short: "Work with workspace data sources",
}

var sourceListCmd = &cobra.Command{
	Use:   "list",
	Short: "List data sources in the workspace",
	RunE:  runSourceList,
}

var sourceGetCmd = &cobra.Command{
	Use:   "get <source-id>",
	Short: "Get data source details",
	Args:  exactArgs(1),
	RunE:  runSourceGet,
}

var sourceToolsCmd = &cobra.Command{
	Use:   "tools <source-id>",
	Short: "List tools discovered from a data source",
	Args:  exactArgs(1),
	RunE:  runSourceTools,
}

var sourceTestCmd = &cobra.Command{
	Use:   "test <source-id>",
	Short: "Run a data source connection test",
	Args:  exactArgs(1),
	RunE:  runSourceTest,
}

var sourceRefreshToolsCmd = &cobra.Command{
	Use:   "refresh-tools <source-id>",
	Short: "Refresh tool discovery for a data source",
	Args:  exactArgs(1),
	RunE:  runSourceRefreshTools,
}

var sourceCallCmd = &cobra.Command{
	Use:   "call <source-id> <tool-name>",
	Short: "Call a read-only tool exposed by a data source",
	Args:  exactArgs(2),
	RunE:  runSourceCall,
}

var sourceRunCmd = &cobra.Command{
	Use:   "run <source-id> <run-id>",
	Short: "Get a data source run result",
	Args:  exactArgs(2),
	RunE:  runSourceRun,
}

func init() {
	sourceCmd.AddCommand(sourceListCmd)
	sourceCmd.AddCommand(sourceGetCmd)
	sourceCmd.AddCommand(sourceToolsCmd)
	sourceCmd.AddCommand(sourceTestCmd)
	sourceCmd.AddCommand(sourceRefreshToolsCmd)
	sourceCmd.AddCommand(sourceCallCmd)
	sourceCmd.AddCommand(sourceRunCmd)

	sourceListCmd.Flags().String("output", "table", "Output format: table or json")
	sourceListCmd.Flags().String("source-type", "", "Filter by source type")
	sourceListCmd.Flags().String("runtime-id", "", "Filter by runtime ID")

	sourceGetCmd.Flags().String("output", "json", "Output format: table or json")
	sourceToolsCmd.Flags().String("output", "table", "Output format: table or json")

	for _, cmd := range []*cobra.Command{sourceTestCmd, sourceRefreshToolsCmd, sourceCallCmd} {
		cmd.Flags().String("output", "json", "Output format: table or json")
		cmd.Flags().Bool("wait", true, "Wait for the source run to finish")
		cmd.Flags().Int("timeout", 90, "Maximum seconds to wait when --wait is true")
	}
	sourceCallCmd.Flags().String("arguments", "{}", "Tool arguments as a JSON object")
	sourceRunCmd.Flags().String("output", "json", "Output format: table or json")
}

func runSourceList(cmd *cobra.Command, _ []string) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}
	if _, err := requireWorkspaceID(cmd); err != nil {
		return err
	}

	params := url.Values{}
	params.Set("workspace_id", client.WorkspaceID)
	if sourceType, _ := cmd.Flags().GetString("source-type"); strings.TrimSpace(sourceType) != "" {
		params.Set("source_type", strings.TrimSpace(sourceType))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var resp map[string]any
	if err := client.GetJSON(ctx, "/api/sources?"+params.Encode(), &resp); err != nil {
		return fmt.Errorf("list sources: %w", err)
	}

	sources := sourceItems(resp)
	if runtimeID, _ := cmd.Flags().GetString("runtime-id"); strings.TrimSpace(runtimeID) != "" {
		sources = filterSourcesByRuntime(sources, strings.TrimSpace(runtimeID))
		resp["sources"] = sources
		resp["total"] = len(sources)
	}

	output, _ := cmd.Flags().GetString("output")
	if output == "json" {
		return cli.PrintJSON(os.Stdout, resp)
	}

	headers := []string{"ID", "NAME", "TYPE", "STATUS", "RUNTIME", "TOOLS"}
	rows := make([][]string, 0, len(sources))
	for _, source := range sources {
		rows = append(rows, []string{
			strVal(source, "id"),
			strVal(source, "name"),
			strVal(source, "source_type"),
			strVal(source, "connection_status"),
			strVal(source, "runtime_id"),
			sourceToolCount(source),
		})
	}
	cli.PrintTable(os.Stdout, headers, rows)
	return nil
}

func runSourceGet(cmd *cobra.Command, args []string) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var source map[string]any
	if err := client.GetJSON(ctx, "/api/sources/"+url.PathEscape(args[0]), &source); err != nil {
		return fmt.Errorf("get source: %w", err)
	}

	output, _ := cmd.Flags().GetString("output")
	if output == "json" {
		return cli.PrintJSON(os.Stdout, source)
	}

	rows := [][]string{
		{"ID", strVal(source, "id")},
		{"NAME", strVal(source, "name")},
		{"TYPE", strVal(source, "source_type")},
		{"STATUS", strVal(source, "connection_status")},
		{"RUNTIME", strVal(source, "runtime_id")},
		{"LAST_TEST", strVal(source, "last_test_message")},
	}
	cli.PrintTable(os.Stdout, []string{"FIELD", "VALUE"}, rows)
	return nil
}

func runSourceTools(cmd *cobra.Command, args []string) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var resp map[string]any
	if err := client.GetJSON(ctx, "/api/sources/"+url.PathEscape(args[0])+"/tools", &resp); err != nil {
		return fmt.Errorf("list source tools: %w", err)
	}

	tools := toolItems(resp)
	output, _ := cmd.Flags().GetString("output")
	if output == "json" {
		return cli.PrintJSON(os.Stdout, resp)
	}

	headers := []string{"NAME", "TITLE", "SAFETY", "DESCRIPTION"}
	rows := make([][]string, 0, len(tools))
	for _, tool := range tools {
		rows = append(rows, []string{
			strVal(tool, "name"),
			strVal(tool, "title"),
			strVal(tool, "safety"),
			strVal(tool, "description"),
		})
	}
	cli.PrintTable(os.Stdout, headers, rows)
	return nil
}

func runSourceTest(cmd *cobra.Command, args []string) error {
	return runSourceOperation(cmd, args[0], func(ctx context.Context, client *cli.APIClient) (map[string]any, error) {
		var run map[string]any
		err := client.PostJSON(ctx, "/api/sources/"+url.PathEscape(args[0])+"/test", map[string]any{}, &run)
		return run, err
	})
}

func runSourceRefreshTools(cmd *cobra.Command, args []string) error {
	return runSourceOperation(cmd, args[0], func(ctx context.Context, client *cli.APIClient) (map[string]any, error) {
		var run map[string]any
		err := client.PostJSON(ctx, "/api/sources/"+url.PathEscape(args[0])+"/tools/refresh", map[string]any{}, &run)
		return run, err
	})
}

func runSourceCall(cmd *cobra.Command, args []string) error {
	toolArgs, err := parseSourceToolArguments(cmd)
	if err != nil {
		return err
	}

	sourceID := args[0]
	toolName := args[1]
	return runSourceOperation(cmd, sourceID, func(ctx context.Context, client *cli.APIClient) (map[string]any, error) {
		var run map[string]any
		err := client.PostJSON(
			ctx,
			"/api/sources/"+url.PathEscape(sourceID)+"/tools/"+url.PathEscape(toolName)+"/call",
			map[string]any{"arguments": toolArgs},
			&run,
		)
		return run, err
	})
}

func runSourceRun(cmd *cobra.Command, args []string) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	run, err := getSourceRun(ctx, client, args[0], args[1])
	if err != nil {
		return err
	}
	return printSourceRun(cmd, run)
}

func runSourceOperation(cmd *cobra.Command, sourceID string, enqueue func(context.Context, *cli.APIClient) (map[string]any, error)) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	timeoutSeconds, _ := cmd.Flags().GetInt("timeout")
	if timeoutSeconds < 1 {
		return fmt.Errorf("--timeout must be at least 1")
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	run, err := enqueue(ctx, client)
	if err != nil {
		return err
	}

	wait, _ := cmd.Flags().GetBool("wait")
	if wait {
		run, err = waitForSourceRun(ctx, client, sourceID, strVal(run, "id"))
		if err != nil {
			return err
		}
	}

	return printSourceRun(cmd, run)
}

func printSourceRun(cmd *cobra.Command, run map[string]any) error {
	output, _ := cmd.Flags().GetString("output")
	if output == "json" {
		return cli.PrintJSON(os.Stdout, run)
	}

	rows := [][]string{
		{"ID", strVal(run, "id")},
		{"TYPE", strVal(run, "run_type")},
		{"STATUS", strVal(run, "status")},
		{"TOOL", strVal(run, "tool_name")},
		{"SUMMARY", strVal(run, "summary")},
		{"ERROR", strVal(run, "error_message")},
	}
	cli.PrintTable(os.Stdout, []string{"FIELD", "VALUE"}, rows)
	return nil
}

func waitForSourceRun(ctx context.Context, client *cli.APIClient, sourceID, runID string) (map[string]any, error) {
	if runID == "" {
		return nil, fmt.Errorf("source run response missing id")
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		run, err := getSourceRun(ctx, client, sourceID, runID)
		if err != nil {
			return nil, err
		}
		switch strVal(run, "status") {
		case "completed", "failed", "blocked", "cancelled":
			return run, nil
		}

		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("source run %s did not finish before timeout", runID)
		case <-ticker.C:
		}
	}
}

func getSourceRun(ctx context.Context, client *cli.APIClient, sourceID, runID string) (map[string]any, error) {
	var run map[string]any
	if err := client.GetJSON(
		ctx,
		"/api/sources/"+url.PathEscape(sourceID)+"/runs/"+url.PathEscape(runID),
		&run,
	); err != nil {
		return nil, fmt.Errorf("get source run: %w", err)
	}
	return run, nil
}

func parseSourceToolArguments(cmd *cobra.Command) (map[string]any, error) {
	raw, _ := cmd.Flags().GetString("arguments")
	raw = strings.TrimSpace(raw)
	if raw == "" {
		raw = "{}"
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, fmt.Errorf("--arguments must be a JSON object: %w", err)
	}
	if payload == nil {
		payload = map[string]any{}
	}
	return payload, nil
}

func sourceItems(resp map[string]any) []map[string]any {
	raw, _ := resp["sources"].([]any)
	items := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if source, ok := item.(map[string]any); ok {
			items = append(items, source)
		}
	}
	return items
}

func filterSourcesByRuntime(sources []map[string]any, runtimeID string) []map[string]any {
	filtered := make([]map[string]any, 0, len(sources))
	for _, source := range sources {
		if strVal(source, "runtime_id") == runtimeID {
			filtered = append(filtered, source)
		}
	}
	return filtered
}

func toolItems(resp map[string]any) []map[string]any {
	raw, _ := resp["tools"].([]any)
	items := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if tool, ok := item.(map[string]any); ok {
			items = append(items, tool)
		}
	}
	return items
}

func sourceToolCount(source map[string]any) string {
	summary, _ := source["tool_summary"].(map[string]any)
	if summary == nil {
		return ""
	}
	return strVal(summary, "total")
}
