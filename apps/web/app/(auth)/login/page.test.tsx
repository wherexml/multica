import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockPush,
  mockReplace,
  mockSetUser,
  mockHydrateWorkspace,
  mockLogin,
  mockListWorkspaces,
  mockSetToken,
  mockSetLoggedInCookie,
  mockSearchParams,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSetUser: vi.fn(),
  mockHydrateWorkspace: vi.fn(),
  mockLogin: vi.fn(),
  mockListWorkspaces: vi.fn(),
  mockSetToken: vi.fn(),
  mockSetLoggedInCookie: vi.fn(),
  mockSearchParams: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams.current,
}));

vi.mock("@multica/core/auth", () => {
  const authState = {
    user: null,
    isLoading: false,
    setUser: mockSetUser,
  };
  const useAuthStore = Object.assign(
    (selector: (s: typeof authState) => unknown) => selector(authState),
    { getState: () => authState },
  );
  return { useAuthStore };
});

vi.mock("@multica/core/workspace", () => {
  const wsState = {
    hydrateWorkspace: mockHydrateWorkspace,
  };
  const useWorkspaceStore = Object.assign(
    (selector: (s: typeof wsState) => unknown) => selector(wsState),
    { getState: () => wsState },
  );
  return { useWorkspaceStore };
});

vi.mock("@multica/core/api", () => ({
  api: {
    login: mockLogin,
    listWorkspaces: mockListWorkspaces,
    setToken: mockSetToken,
  },
}));

vi.mock("@/features/auth/auth-cookie", () => ({
  setLoggedInCookie: mockSetLoggedInCookie,
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.current = new URLSearchParams();
    localStorage.clear();
  });

  it("renders the password login form", () => {
    render(<LoginPage />);

    expect(screen.getByText("OptiONE Platform")).toBeInTheDocument();
    expect(screen.getByText("请输入邮箱和密码以继续")).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  it("stores the session, hydrates workspace, updates auth state, and navigates after login", async () => {
    const loginResponse = {
      token: "token-123",
      user: {
        id: "user-1",
        name: "Steve",
        email: "admin@local",
        avatar_url: null,
        created_at: "2026-04-13T00:00:00Z",
        updated_at: "2026-04-13T00:00:00Z",
      },
    };
    const workspaces = [
      {
        id: "ws-1",
        name: "Local Dev",
        slug: "local-dev",
        description: null,
        context: null,
        settings: {},
        repos: [],
        issue_prefix: "LOC",
        created_at: "2026-04-13T00:00:00Z",
        updated_at: "2026-04-13T00:00:00Z",
      },
    ];
    mockLogin.mockResolvedValueOnce(loginResponse);
    mockListWorkspaces.mockResolvedValueOnce(workspaces);

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("邮箱"), "admin@local");
    await user.type(screen.getByLabelText("密码"), "admin123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin@local", "admin123");
    });

    await waitFor(() => {
      expect(mockSetToken).toHaveBeenCalledWith("token-123");
      expect(mockSetLoggedInCookie).toHaveBeenCalled();
      expect(mockSetUser).toHaveBeenCalledWith(loginResponse.user);
      expect(mockHydrateWorkspace).toHaveBeenCalledWith(workspaces, null);
      expect(mockPush).toHaveBeenCalledWith("/issues");
    });

    expect(localStorage.getItem("multica_token")).toBe("token-123");
  });

  it("redirects to a private-network CLI callback after password login", async () => {
    mockSearchParams.current = new URLSearchParams({
      cli_callback: "http://10.0.0.206:39937/callback",
      cli_state: "state-123",
    });
    const loginResponse = {
      token: "token-123",
      user: {
        id: "user-1",
        name: "Steve",
        email: "admin@local",
        avatar_url: null,
        created_at: "2026-04-13T00:00:00Z",
        updated_at: "2026-04-13T00:00:00Z",
      },
    };
    mockLogin.mockResolvedValueOnce(loginResponse);
    const originalLocation = window.location;
    const locationAssign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "", assign: locationAssign },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("邮箱"), "admin@local");
    await user.type(screen.getByLabelText("密码"), "admin123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith(
        "http://10.0.0.206:39937/callback?token=token-123&state=state-123",
      );
    });

    expect(mockListWorkspaces).not.toHaveBeenCalled();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("shows a service error when the backend is unreachable", async () => {
    mockLogin.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("邮箱"), "admin@local");
    await user.type(screen.getByLabelText("密码"), "admin123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(
      await screen.findByText("服务暂时不可用，请确认后端已启动"),
    ).toBeInTheDocument();
  });
});
