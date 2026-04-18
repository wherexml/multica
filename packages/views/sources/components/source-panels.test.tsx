import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgentRuntime, Source } from "@multica/core/types";
import { SourceList } from "./source-list";
import { SourceDetail } from "./source-detail";

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockRefetchTools = vi.hoisted(() => vi.fn());
const mockUseDeleteSource = vi.hoisted(() => vi.fn());
const mockUseTestSource = vi.hoisted(() => vi.fn());
const mockUseRefreshSourceTools = vi.hoisted(() => vi.fn());
const mockUseCallSourceTool = vi.hoisted(() => vi.fn());
const mockUseUpdateSourceAuth = vi.hoisted(() => vi.fn());
const mockUseClearSourceAuth = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

vi.mock("@multica/core/hooks", () => ({
  useWorkspaceId: () => "ws-1",
}));

vi.mock("@multica/core/sources/mutations", () => ({
  useDeleteSource: () => mockUseDeleteSource(),
  useTestSource: () => mockUseTestSource(),
  useRefreshSourceTools: () => mockUseRefreshSourceTools(),
  useCallSourceTool: () => mockUseCallSourceTool(),
  useUpdateSourceAuth: () => mockUseUpdateSourceAuth(),
  useClearSourceAuth: () => mockUseClearSourceAuth(),
}));

vi.mock("../../runtimes/components/shared", () => ({
  InfoField: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

const runtime: AgentRuntime = {
  id: "runtime-1",
  workspace_id: "ws-1",
  daemon_id: "daemon-1",
  name: "内网执行节点",
  runtime_mode: "local",
  provider: "openai",
  status: "online",
  device_info: "Mac mini",
  metadata: {},
  owner_id: "user-1",
  last_seen_at: "2026-04-14T10:00:00Z",
  created_at: "2026-04-14T09:00:00Z",
  updated_at: "2026-04-14T10:00:00Z",
};

const source: Source = {
  id: "source-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "Linear MCP",
  source_type: "mcp",
  connection_status: "needs_auth",
  connection_error: "",
  last_test_message: "OAuth 字段已填写，等待二期接入真实授权流程",
  last_tested_at: "2026-04-14T10:30:00Z",
  mcp: {
    transport: "http",
    url: "https://mcp.linear.app",
    auth_type: "oauth",
    client_id: "client-id",
  },
  auth_state: {
    auth_type: "oauth",
    configured: false,
    preview: "",
    updated_at: null,
  },
  tool_summary: {
    total: 1,
    read_only: 1,
    write: 0,
    unknown: 0,
    last_seen_at: "2026-04-14T10:35:00Z",
  },
  latest_run: {
    id: "run-1",
    source_id: "source-1",
    workspace_id: "ws-1",
    runtime_id: "runtime-1",
    run_type: "test",
    status: "blocked",
    tool_name: "",
    request_payload: { action: "test" },
    result_payload: { message: "OAuth 字段已填写，等待二期接入真实授权流程" },
    summary: "OAuth 字段已填写，等待二期接入真实授权流程",
    error_message: "",
    started_at: null,
    completed_at: "2026-04-14T10:30:00Z",
    created_at: "2026-04-14T10:30:00Z",
    updated_at: "2026-04-14T10:30:00Z",
  },
  created_at: "2026-04-14T10:00:00Z",
  updated_at: "2026-04-14T10:30:00Z",
};

describe("Source panels", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({
      data: {
        tools: [
          {
            id: "tool-1",
            source_id: "source-1",
            workspace_id: "ws-1",
            name: "list_issues",
            title: "列出任务",
            description: "只读工具",
            safety: "read_only",
            input_schema: {},
            annotations: { readOnlyHint: true },
            last_seen_at: "2026-04-14T10:35:00Z",
            created_at: "2026-04-14T10:35:00Z",
            updated_at: "2026-04-14T10:35:00Z",
          },
        ],
      },
      isLoading: false,
      refetch: mockRefetchTools,
    });
    mockRefetchTools.mockReset();
    mockRefetchTools.mockResolvedValue(undefined);
    mockUseDeleteSource.mockReset();
    mockUseDeleteSource.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseTestSource.mockReset();
    mockUseTestSource.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(source.latest_run),
      isPending: false,
    });
    mockUseRefreshSourceTools.mockReset();
    mockUseRefreshSourceTools.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(source.latest_run),
      isPending: false,
    });
    mockUseCallSourceTool.mockReset();
    mockUseCallSourceTool.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(source.latest_run),
      isPending: false,
    });
    mockUseUpdateSourceAuth.mockReset();
    mockUseUpdateSourceAuth.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(source.auth_state),
      isPending: false,
    });
    mockUseClearSourceAuth.mockReset();
    mockUseClearSourceAuth.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(source.auth_state),
      isPending: false,
    });
  });

  it("renders source list labels and status badges", () => {
    render(
      <SourceList
        sources={[source]}
        runtimes={[runtime]}
        selectedId={source.id}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "数据源" })).toBeInTheDocument();
    expect(screen.getByText("连接数据源")).toBeInTheDocument();
    expect(screen.getAllByText("MCP")).not.toHaveLength(0);
    expect(screen.getByText("待认证")).toBeInTheDocument();
    expect(screen.getByText("内网执行节点")).toBeInTheDocument();
  });

  it("renders source detail with runtime, auth, and test sections", () => {
    render(
      <SourceDetail
        source={source}
        runtimes={[runtime]}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("Linear MCP")).toBeInTheDocument();
    expect(screen.getByText("HTTP")).toBeInTheDocument();
    expect(screen.getByText("OAuth")).toBeInTheDocument();
    expect(screen.getByText("内网执行节点")).toBeInTheDocument();
    expect(screen.getByText("最近一次运行")).toBeInTheDocument();
    expect(screen.getByText("OAuth 字段已填写，等待二期接入真实授权流程")).toBeInTheDocument();
    expect(screen.getByText("更新认证")).toBeInTheDocument();
    expect(screen.getByText("列出任务")).toBeInTheDocument();
    expect(screen.getByText("原始配置")).toBeInTheDocument();
    expect(screen.getByText("工具能力")).toBeInTheDocument();
  });

  it("opens the auth dialog from source detail", async () => {
    const user = userEvent.setup();

    render(
      <SourceDetail
        source={source}
        runtimes={[runtime]}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "更新认证" }));

    expect(screen.getByRole("heading", { name: "更新认证" })).toBeInTheDocument();
    expect(screen.getByText(/保存后会自动重测并刷新工具列表/)).toBeInTheDocument();
  });

  it("opens the tool run dialog for read-only tools", async () => {
    const user = userEvent.setup();

    render(
      <SourceDetail
        source={source}
        runtimes={[runtime]}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "运行" }));

    expect(screen.getByRole("heading", { name: "运行只读工具" })).toBeInTheDocument();
    expect(screen.getAllByText("列出任务")).toHaveLength(2);
  });

  it("shows a syncing hint and keeps refetching when summary is present before the tool list arrives", async () => {
    mockUseQuery.mockReturnValue({
      data: { tools: [] },
      isLoading: false,
      refetch: mockRefetchTools,
    });

    render(
      <SourceDetail
        source={source}
        runtimes={[runtime]}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("工具快照已经更新，正在同步工具列表…")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockRefetchTools).toHaveBeenCalled();
    });
  });
});
