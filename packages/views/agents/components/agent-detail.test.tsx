import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Agent, RuntimeDevice, Source } from "@multica/core/types";
import { AgentDetail } from "./agent-detail";

const mockUseQuery = vi.hoisted(() => vi.fn());

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

const runtime: RuntimeDevice = {
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

const agent: Agent = {
  id: "agent-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "采购策略数字员工",
  description: "负责采购分析与方案建议",
  instructions: "Handle procurement analysis",
  avatar_url: null,
  runtime_mode: "local",
  runtime_config: {},
  visibility: "private",
  status: "idle",
  max_concurrent_tasks: 6,
  owner_id: "user-1",
  skills: [],
  triggers: [],
  created_at: "2026-04-14T09:00:00Z",
  updated_at: "2026-04-14T10:00:00Z",
  archived_at: null,
  archived_by: null,
};

const matchingSource: Source = {
  id: "source-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "Linear MCP",
  source_type: "mcp",
  connection_status: "connected",
  connection_error: "",
  last_test_message: "连接正常",
  last_tested_at: "2026-04-14T10:30:00Z",
  mcp: {
    transport: "http",
    url: "https://mcp.linear.app",
    auth_type: "oauth",
    client_id: "client-id",
  },
  auth_state: {
    auth_type: "oauth",
    configured: true,
    preview: "Bearer ••••abcd",
    updated_at: "2026-04-14T10:20:00Z",
  },
  tool_summary: {
    total: 3,
    read_only: 2,
    write: 1,
    unknown: 0,
    last_seen_at: "2026-04-14T10:31:00Z",
  },
  latest_run: null,
  created_at: "2026-04-14T10:00:00Z",
  updated_at: "2026-04-14T10:31:00Z",
};

const otherSource: Source = {
  ...matchingSource,
  id: "source-2",
  runtime_id: "runtime-2",
  name: "GitHub MCP",
};

describe("AgentDetail", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({
      data: {
        sources: [matchingSource, otherSource],
        total: 2,
      },
      isLoading: false,
    });
  });

  it("shows the data sources tab before the skills tab and filters sources by runtime", async () => {
    const user = userEvent.setup();

    render(
      <AgentDetail
        agent={agent}
        runtimes={[runtime]}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onRestore={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const instructionsTab = screen.getByRole("button", { name: "说明" });
    const tabsRow = instructionsTab.parentElement;
    expect(tabsRow).not.toBeNull();

    const tabLabels = within(tabsRow!).getAllByRole("button").map((button) => button.textContent?.trim());
    expect(tabLabels).toEqual(["说明", "数据源", "技能", "触发器", "任务", "设置"]);

    await user.click(screen.getByRole("button", { name: "数据源" }));

    expect(screen.getByRole("heading", { name: "数据源" })).toBeInTheDocument();
    expect(screen.getByText("执行环境：内网执行节点")).toBeInTheDocument();
    expect(screen.getByText("Linear MCP")).toBeInTheDocument();
    expect(screen.getByText("连接正常")).toBeInTheDocument();
    expect(screen.queryByText("GitHub MCP")).not.toBeInTheDocument();
  });
});
