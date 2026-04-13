import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsPage } from "./settings-page";

vi.mock("@multica/ui/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./account-tab", () => ({
  AccountTab: () => <div>Account Tab Content</div>,
}));

vi.mock("./appearance-tab", () => ({
  AppearanceTab: () => <div>Appearance Tab Content</div>,
}));

vi.mock("./tokens-tab", () => ({
  TokensTab: () => <div>Tokens Tab Content</div>,
}));

vi.mock("./workspace-tab", () => ({
  WorkspaceTab: () => <div>Workspace Tab Content</div>,
}));

vi.mock("./members-tab", () => ({
  MembersTab: () => <div>Members Tab Content</div>,
}));

vi.mock("./repositories-tab", () => ({
  RepositoriesTab: () => <div>Repositories Tab Content</div>,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    document.cookie = "multica-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("renders Chinese labels by default", () => {
    render(<SettingsPage />);

    expect(screen.getByText("平台设置")).toBeInTheDocument();
    expect(screen.getByText("我的账户")).toBeInTheDocument();
    expect(screen.getByText("个人资料")).toBeInTheDocument();
    expect(screen.getByText("外观")).toBeInTheDocument();
    expect(screen.getByText("API 令牌")).toBeInTheDocument();
    expect(screen.getByText("业务空间")).toBeInTheDocument();
    expect(screen.getByText("通用设置")).toBeInTheDocument();
    expect(screen.getByText("代码仓库")).toBeInTheDocument();
    expect(screen.getByText("成员管理")).toBeInTheDocument();
  });

  it("renders English labels when the locale cookie is en-US", () => {
    document.cookie = "multica-locale=en-US; path=/";

    render(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("My Account")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("API Tokens")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
  });
});
