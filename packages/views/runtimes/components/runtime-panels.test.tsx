import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AgentRuntime } from "@multica/core/types";
import { RuntimeList } from "./runtime-list";
import { RuntimeDetail } from "./runtime-detail";

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseDeleteRuntime = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@multica/core/hooks", () => ({
  useWorkspaceId: () => "ws-1",
}));

vi.mock("@multica/core/auth", () => ({
  useAuthStore: (selector?: (state: { user: { id: string } | null }) => unknown) => {
    const state = { user: { id: "user-1" } };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@multica/core/workspace/queries", () => ({
  memberListOptions: vi.fn(() => ({})),
}));

vi.mock("@multica/core/runtimes/mutations", () => ({
  useDeleteRuntime: () => mockUseDeleteRuntime(),
}));

vi.mock("../../common/actor-avatar", () => ({
  ActorAvatar: ({ actorId }: { actorId: string }) => <div data-testid={`avatar-${actorId}`} />,
}));

vi.mock("./ping-section", () => ({
  PingSection: () => <div>Ping Section</div>,
}));

vi.mock("./update-section", () => ({
  UpdateSection: () => <div>Update Section</div>,
}));

vi.mock("./usage-section", () => ({
  UsageSection: () => <div>Usage Section</div>,
}));

type RuntimeWithExecutor = AgentRuntime & {
  executor?: {
    executor_kind?: string;
    resource_quota?: Record<string, unknown> | null;
  } | null;
};

const baseRuntime: AgentRuntime = {
  id: "runtime-1",
  workspace_id: "ws-1",
  daemon_id: "daemon-1",
  name: "Claude Sonnet",
  runtime_mode: "local",
  provider: "openai",
  status: "online",
  device_info: "MacBook Pro",
  metadata: {},
  owner_id: "user-1",
  last_seen_at: "2026-04-13T09:00:00Z",
  created_at: "2026-04-12T09:00:00Z",
  updated_at: "2026-04-13T09:00:00Z",
};

describe("Runtime panels", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseDeleteRuntime.mockReset();
    mockUseDeleteRuntime.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseQuery.mockReturnValue({
      data: [
        {
          user_id: "user-1",
          name: "Steve",
          role: "owner",
        },
      ],
    });
  });

  it("renders Chinese runtime list labels and executor badges", () => {
    const runtime: RuntimeWithExecutor = {
      ...baseRuntime,
      executor: {
        executor_kind: "llm_agent",
        resource_quota: null,
      },
    };

    render(
      <RuntimeList
        runtimes={[runtime]}
        selectedId={runtime.id}
        onSelect={vi.fn()}
        filter="mine"
        onFilterChange={vi.fn()}
        ownerFilter={null}
        onOwnerFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "执行环境" })).toBeInTheDocument();
    expect(screen.getByText("1/1 在线")).toBeInTheDocument();
    expect(screen.getByText("LLM 智能体")).toBeInTheDocument();
  });

  it("renders Chinese detail labels and resource quota content", () => {
    const runtime: RuntimeWithExecutor = {
      ...baseRuntime,
      executor: {
        executor_kind: "llm_agent",
        resource_quota: {
          cpu: "2",
          memory: "4Gi",
          timeout: "300s",
        },
      },
    };

    render(<RuntimeDetail runtime={runtime} />);

    expect(screen.getAllByText("在线")).toHaveLength(2);
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("资源配额")).toBeInTheDocument();
    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("4Gi")).toBeInTheDocument();
    expect(screen.getByText("Timeout")).toBeInTheDocument();
    expect(screen.getByText("300s")).toBeInTheDocument();
  });

  it("renders Chinese empty states for missing runtime data", () => {
    render(
      <RuntimeList
        runtimes={[]}
        selectedId=""
        onSelect={vi.fn()}
        filter="mine"
        onFilterChange={vi.fn()}
        ownerFilter={null}
        onOwnerFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText("还没有执行环境")).toBeInTheDocument();

    render(
      <RuntimeList
        runtimes={[baseRuntime as RuntimeWithExecutor]}
        selectedId={baseRuntime.id}
        onSelect={vi.fn()}
        filter="mine"
        onFilterChange={vi.fn()}
        ownerFilter={null}
        onOwnerFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText("默认")).toBeInTheDocument();

    render(<RuntimeDetail runtime={baseRuntime as RuntimeWithExecutor} />);

    expect(screen.getByText("未配置")).toBeInTheDocument();
  });
});
