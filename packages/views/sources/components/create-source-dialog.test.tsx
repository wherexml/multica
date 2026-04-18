import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AgentRuntime } from "@multica/core/types";
import { CreateSourceDialog } from "./create-source-dialog";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../runtimes/components/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => <div>{provider}</div>,
}));

const baseRuntime: AgentRuntime = {
  id: "runtime-1",
  workspace_id: "ws-1",
  daemon_id: "daemon-1",
  name: "Claude (Steves-Mac-Studio.local)",
  runtime_mode: "local",
  provider: "claude",
  status: "online",
  device_info:
    "Steves-Mac-Studio.local · Hermes Agent v0.8.0 (2026.4.8) Project: /Users/steve/.hermes/hermes-agent Python: 3.11.14 OpenAI SDK: 2.31.0 Update available: 80 commits behind",
  metadata: {},
  owner_id: "user-1",
  last_seen_at: "2026-04-14T10:00:00Z",
  created_at: "2026-04-14T09:00:00Z",
  updated_at: "2026-04-14T10:00:00Z",
};

describe("CreateSourceDialog", () => {
  it("explains the runtime choice more directly and constrains long runtime rows", () => {
    render(
      <CreateSourceDialog
        runtimes={[baseRuntime]}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText(/选择哪台机器去访问这个数据源/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("overflow-hidden");

    const runtimeMeta = screen.getByText(baseRuntime.device_info);
    expect(runtimeMeta).toHaveClass("truncate");
    expect(runtimeMeta.closest("button")).toHaveClass("overflow-hidden");
  });

  it("warns when every runtime is offline", () => {
    render(
      <CreateSourceDialog
        runtimes={[{ ...baseRuntime, id: "runtime-2", status: "offline" }]}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText(/当前所有执行环境都处于离线状态/)).toBeInTheDocument();
  });
});
