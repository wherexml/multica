export type SourceType = "mcp" | "api" | "local";

export type SourceConnectionStatus = "connected" | "needs_auth" | "failed" | "untested";
export type SourceToolSafety = "read_only" | "write" | "unknown";
export type SourceRunType = "test" | "discover_tools" | "call_tool";
export type SourceRunStatus = "pending" | "running" | "completed" | "failed" | "blocked";

export type McpTransport = "http" | "sse" | "stdio";

export type McpAuthType = "oauth" | "bearer" | "none";

export interface McpSourceConfig {
  transport: McpTransport;
  url?: string;
  auth_type?: McpAuthType;
  client_id?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface Source {
  id: string;
  workspace_id: string;
  runtime_id: string;
  name: string;
  source_type: SourceType;
  connection_status: SourceConnectionStatus;
  connection_error: string;
  last_test_message: string;
  last_tested_at: string | null;
  mcp?: McpSourceConfig | null;
  auth_state: SourceAuthState;
  tool_summary?: SourceToolSummary | null;
  latest_run?: SourceRun | null;
  created_at: string;
  updated_at: string;
}

export interface SourceAuthState {
  auth_type: McpAuthType;
  configured: boolean;
  preview: string;
  updated_at?: string | null;
}

export interface SourceToolSummary {
  total: number;
  read_only: number;
  write: number;
  unknown: number;
  last_seen_at?: string | null;
}

export interface SourceTool {
  id: string;
  source_id: string;
  workspace_id: string;
  name: string;
  title: string;
  description: string;
  safety: SourceToolSafety;
  input_schema: Record<string, unknown>;
  annotations: Record<string, unknown>;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface SourceRun {
  id: string;
  source_id: string;
  workspace_id: string;
  runtime_id: string;
  run_type: SourceRunType;
  status: SourceRunStatus;
  tool_name: string;
  request_payload: unknown;
  result_payload: unknown;
  summary: string;
  error_message: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListSourceToolsResponse {
  tools: SourceTool[];
}

export interface UpdateSourceAuthRequest {
  auth_type: McpAuthType;
  bearer_token?: string;
  oauth?: {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_at?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SourceToolCallRequest {
  arguments?: Record<string, unknown>;
}

export interface CreateSourceRequest {
  name: string;
  runtime_id: string;
  source_type: SourceType;
  mcp?: McpSourceConfig;
}

export interface UpdateSourceRequest {
  name?: string;
  runtime_id?: string;
  source_type?: SourceType;
  mcp?: McpSourceConfig;
}

export interface ListSourcesResponse {
  sources: Source[];
  total: number;
}

export type TestSourceResponse = SourceRun;
