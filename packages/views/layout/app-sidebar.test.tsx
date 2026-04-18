import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "./app-sidebar";

const mockUseMyRuntimesNeedUpdate = vi.hoisted(() => vi.fn());

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  closestCenter: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  arrayMove: <T,>(items: T[]) => items,
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === "inbox") {
      return {
        data: [
          {
            id: "inbox-1",
            read: false,
            issue_id: "issue-1",
          },
        ],
      };
    }

    return { data: [] };
  },
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("../navigation", () => ({
  AppLink: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useNavigation: () => ({ pathname: "/inbox", push: vi.fn() }),
}));

vi.mock("../workspace/workspace-avatar", () => ({
  WorkspaceAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@multica/ui/components/common/actor-avatar", () => ({
  ActorAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@multica/core/issues/stores/draft-store", () => ({
  useIssueDraftStore: () => false,
}));

vi.mock("@multica/core/auth", () => ({
  useAuthStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        user: { id: "user-1", name: "Test User", email: "test@example.com" },
        logout: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        user: { id: "user-1", name: "Test User", email: "test@example.com" },
        logout: vi.fn(),
      }),
    },
  ),
}));

vi.mock("@multica/core/workspace", () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        workspace: { id: "ws-1", name: "Test Workspace" },
        workspaces: [{ id: "ws-1", name: "Test Workspace" }],
        switchWorkspace: vi.fn(),
        clearWorkspace: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        workspace: { id: "ws-1", name: "Test Workspace" },
        workspaces: [{ id: "ws-1", name: "Test Workspace" }],
        switchWorkspace: vi.fn(),
        clearWorkspace: vi.fn(),
      }),
    },
  ),
}));

vi.mock("@multica/core/inbox/queries", () => ({
  inboxKeys: {
    list: (wsId: string) => ["inbox", wsId],
  },
  deduplicateInboxItems: <T,>(items: T[]) => items,
}));

vi.mock("@multica/core/api", () => ({
  api: {
    listInbox: vi.fn().mockResolvedValue([]),
    listPins: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@multica/core/modals", () => ({
  useModalStore: Object.assign(
    () => ({ modal: null, open: vi.fn() }),
    {
      getState: () => ({ modal: null, open: vi.fn() }),
    },
  ),
}));

vi.mock("@multica/core/runtimes/hooks", () => ({
  useMyRuntimesNeedUpdate: (...args: unknown[]) => mockUseMyRuntimesNeedUpdate(...args),
}));

vi.mock("@multica/core/pins/queries", () => ({
  pinKeys: {
    list: (wsId: string) => ["pins", wsId],
  },
}));

vi.mock("@multica/core/pins/mutations", () => ({
  useDeletePin: () => ({ mutate: vi.fn() }),
  useReorderPins: () => ({ mutate: vi.fn() }),
}));

vi.mock("@multica/ui/components/ui/sidebar", async () => {
  const ReactModule = await import("react");

  const SidebarMenuItem = ReactModule.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );

  const SidebarMenuButton = ({
    render: renderProp,
    children,
    isActive: _isActive,
    ...props
  }: React.ComponentProps<"button"> & { render?: React.ReactElement; isActive?: boolean }) => {
    if (renderProp) {
      return ReactModule.cloneElement(renderProp, props, children);
    }

    return <button {...props}>{children}</button>;
  };

  return {
    Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroup: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
    SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    SidebarHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
    SidebarFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
    SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail: () => null,
  };
});

vi.mock("@multica/ui/components/ui/dropdown-menu", async () => {
  const ReactModule = await import("react");

  const DropdownMenuTrigger = ({
    render: renderProp,
    children,
    ...props
  }: React.ComponentProps<"button"> & { render?: React.ReactElement }) => {
    if (renderProp) {
      return ReactModule.cloneElement(renderProp, props, children);
    }

    return <button {...props}>{children}</button>;
  };

  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    ),
    DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuTrigger,
  };
});

vi.mock("@multica/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    document.cookie = "multica-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    mockUseMyRuntimesNeedUpdate.mockReset();
    mockUseMyRuntimesNeedUpdate.mockReturnValue(false);
  });

  it("renders navigation labels from the default zh-CN locale", () => {
    render(<AppSidebar />);

    expect(screen.getByText("工作台")).toBeInTheDocument();
    expect(screen.getByText("我的待办")).toBeInTheDocument();
    expect(screen.getByText("所有任务")).toBeInTheDocument();
    expect(screen.getByText("项目中心")).toBeInTheDocument();
    expect(screen.getByText("数字员工")).toBeInTheDocument();
    expect(screen.getByText("执行环境")).toBeInTheDocument();
    expect(screen.getByText("数据源")).toBeInTheDocument();
    expect(screen.getByText("技能包")).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "设置" && el?.tagName === "SPAN"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("退出").length).toBeGreaterThan(0);
    expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
  });

  it("renders navigation labels from the normalized English locale cookie", () => {
    document.cookie = "multica-locale=en; path=/";

    render(<AppSidebar />);

    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("My Issues")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Runtimes")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("does not show a runtime alert dot in the sidebar", () => {
    mockUseMyRuntimesNeedUpdate.mockReturnValue(true);

    render(<AppSidebar />);

    const runtimeLink = screen.getByText("执行环境").closest("a");
    expect(runtimeLink?.querySelector(".bg-destructive")).not.toBeInTheDocument();
  });
});
