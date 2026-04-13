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
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSetUser: vi.fn(),
  mockHydrateWorkspace: vi.fn(),
  mockLogin: vi.fn(),
  mockListWorkspaces: vi.fn(),
  mockSetToken: vi.fn(),
  mockSetLoggedInCookie: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
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
    localStorage.clear();
  });

  it("renders the password login form", () => {
    render(<LoginPage />);

    expect(screen.getByText("Sign in to Multica")).toBeInTheDocument();
    expect(
      screen.getByText("Enter your email and password to continue"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
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

    await user.type(screen.getByLabelText("Email"), "admin@local");
    await user.type(screen.getByLabelText("Password"), "admin123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

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
});
