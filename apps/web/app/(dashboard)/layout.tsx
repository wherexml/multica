"use client";

import { DashboardGuard } from "@multica/views/layout";
import { AppSidebar } from "@multica/views/layout";
import { ModalRegistry } from "@multica/views/modals/registry";
import { MulticaIcon } from "@multica/ui/components/common/multica-icon";
import { SearchCommand, SearchTrigger } from "@multica/views/search";
import { ChatFab, ChatWindow } from "@multica/views/chat";
import {
  SidebarInset,
  SidebarProvider,
} from "@multica/ui/components/ui/sidebar";
import { I18nProvider } from "@/components/i18n-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <DashboardGuard
        loginPath="/"
        loadingFallback={
          <div className="flex h-svh items-center justify-center">
            <MulticaIcon className="size-6" />
          </div>
        }
      >
        <SidebarProvider defaultOpen={true} className="h-svh">
          <AppSidebar searchSlot={<SearchTrigger />} />
          <SidebarInset className="overflow-hidden">
            {children}
            <ModalRegistry />
            <SearchCommand />
            <ChatWindow />
            <ChatFab />
          </SidebarInset>
        </SidebarProvider>
      </DashboardGuard>
    </I18nProvider>
  );
}
