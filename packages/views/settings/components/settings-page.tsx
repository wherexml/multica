"use client";

import { User, Palette, Key, Settings, Users, FolderGit2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@multica/ui/components/ui/tabs";
import { getSettingsLocale, settingsT } from "@multica/core/platform";
import { AccountTab } from "./account-tab";
import { AppearanceTab } from "./appearance-tab";
import { TokensTab } from "./tokens-tab";
import { WorkspaceTab } from "./workspace-tab";
import { MembersTab } from "./members-tab";
import { RepositoriesTab } from "./repositories-tab";

export function SettingsPage() {
  const locale = getSettingsLocale();
  const accountTabs = [
    { value: "profile", label: settingsT("settings.tabs.profile", locale), icon: User },
    { value: "appearance", label: settingsT("settings.tabs.appearance", locale), icon: Palette },
    { value: "tokens", label: settingsT("settings.tabs.tokens", locale), icon: Key },
  ];
  const workspaceTabs = [
    { value: "workspace", label: settingsT("settings.tabs.workspace", locale), icon: Settings },
    { value: "repositories", label: settingsT("settings.tabs.repositories", locale), icon: FolderGit2 },
    { value: "members", label: settingsT("settings.tabs.members", locale), icon: Users },
  ];

  return (
    <Tabs defaultValue="profile" orientation="vertical" className="flex-1 min-h-0 gap-0">
      {/* Left nav */}
      <div className="w-52 shrink-0 border-r overflow-y-auto p-4">
        <h1 className="text-sm font-semibold mb-4 px-2">{settingsT("settings.title", locale)}</h1>
        <TabsList variant="line" className="flex-col items-stretch">
          {/* My Account group */}
          <span className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            {settingsT("settings.groups.account", locale)}
          </span>
          {accountTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}

          {/* Workspace group */}
          <span className="px-2 pb-1 pt-4 text-xs font-medium text-muted-foreground truncate">
            {settingsT("settings.groups.workspace", locale)}
          </span>
          {workspaceTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Right content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto p-6">
          <TabsContent value="profile"><AccountTab /></TabsContent>
          <TabsContent value="appearance"><AppearanceTab /></TabsContent>
          <TabsContent value="tokens"><TokensTab /></TabsContent>
          <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
          <TabsContent value="repositories"><RepositoriesTab /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
