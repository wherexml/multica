"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDefaultLayout } from "react-resizable-panels";
import { useAuthStore } from "@multica/core/auth";
import { api } from "@multica/core/api";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  useArchiveAllInbox,
  useArchiveAllReadInbox,
  useArchiveCompletedInbox,
  useArchiveInbox,
  useMarkAllInboxRead,
  useMarkInboxRead,
} from "@multica/core/inbox/mutations";
import { inboxListOptions } from "@multica/core/inbox/queries";
import { useModalStore } from "@multica/core/modals";
import { t } from "@multica/core/platform";
import type { InboxItem } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@multica/ui/components/ui/resizable";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import {
  Archive,
  ArrowLeft,
  BookCheck,
  CheckCheck,
  Inbox,
  ListChecks,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { myIssueListOptions as buildMyIssueListOptions } from "@multica/core/issues/queries";
import { IssueDetail } from "../../issues/components";
import { useNavigation } from "../../navigation";
import { InboxDashboard } from "./inbox-dashboard";
import { typeLabels } from "./inbox-detail-label";
import { getRecentActivityItems } from "./inbox-dashboard-helpers";
import { timeAgo } from "./inbox-list-item";

export function InboxPage() {
  const { push, replace, searchParams } = useNavigation();
  const urlIssue = searchParams.get("issue") ?? "";
  const user = useAuthStore((state) => state.user);
  const wsId = useWorkspaceId();
  const isMobile = useIsMobile();

  const [selectedKey, setSelectedKeyState] = useState(urlIssue);

  useEffect(() => {
    setSelectedKeyState(urlIssue);
  }, [urlIssue]);

  const setSelectedKey = useCallback(
    (key: string) => {
      setSelectedKeyState(key);
      replace(key ? `/inbox?issue=${key}` : "/inbox");
    },
    [replace],
  );

  const {
    data: rawItems = [],
    isLoading: inboxLoading,
  } = useQuery(inboxListOptions(wsId));

  const {
    data: myIssues = [],
    isLoading: todosLoading,
  } = useQuery({
    ...buildMyIssueListOptions(wsId, "dashboard-assigned", {
      assignee_id: user?.id ?? "",
    }),
    enabled: Boolean(user?.id),
  });

  const {
    data: decisions = [],
    isLoading: decisionsLoading,
  } = useQuery({
    queryKey: ["decisions", wsId, "dashboard"] as const,
    queryFn: async () => {
      const response = await api.listDecisions({
        page: 1,
        page_size: 200,
      });
      return response.decisions;
    },
  });

  const recentItems = useMemo(() => getRecentActivityItems(rawItems), [rawItems]);
  const selected = useMemo(
    () =>
      recentItems.find((item) => (item.issue_id ?? item.id) === selectedKey) ??
      rawItems.find((item) => item.id === selectedKey) ??
      null,
    [rawItems, recentItems, selectedKey],
  );
  const unreadCount = useMemo(
    () => rawItems.filter((item) => !item.archived && !item.read).length,
    [rawItems],
  );

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_inbox_layout",
  });

  const markReadMutation = useMarkInboxRead();
  const archiveMutation = useArchiveInbox();
  const markAllReadMutation = useMarkAllInboxRead();
  const archiveAllMutation = useArchiveAllInbox();
  const archiveAllReadMutation = useArchiveAllReadInbox();
  const archiveCompletedMutation = useArchiveCompletedInbox();

  const handleSelect = useCallback(
    (item: InboxItem) => {
      setSelectedKey(item.issue_id ?? item.id);
      if (!item.read) {
        markReadMutation.mutate(item.id, {
          onError: () => toast.error("标记已读失败"),
        });
      }
    },
    [markReadMutation, setSelectedKey],
  );

  const handleArchive = useCallback(
    (id: string) => {
      const archived = rawItems.find((item) => item.id === id);
      if (archived && (archived.issue_id ?? archived.id) === selectedKey) {
        setSelectedKey("");
      }

      archiveMutation.mutate(id, {
        onError: () => toast.error("归档失败"),
      });
    },
    [archiveMutation, rawItems, selectedKey, setSelectedKey],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate(undefined, {
      onError: () => toast.error("全部标记已读失败"),
    });
  }, [markAllReadMutation]);

  const handleArchiveAll = useCallback(() => {
    setSelectedKey("");
    archiveAllMutation.mutate(undefined, {
      onError: () => toast.error("全部归档失败"),
    });
  }, [archiveAllMutation, setSelectedKey]);

  const handleArchiveAllRead = useCallback(() => {
    const readKeys = rawItems
      .filter((item) => item.read)
      .map((item) => item.issue_id ?? item.id);
    if (readKeys.includes(selectedKey)) {
      setSelectedKey("");
    }

    archiveAllReadMutation.mutate(undefined, {
      onError: () => toast.error("归档已读失败"),
    });
  }, [archiveAllReadMutation, rawItems, selectedKey, setSelectedKey]);

  const handleArchiveCompleted = useCallback(() => {
    setSelectedKey("");
    archiveCompletedMutation.mutate(undefined, {
      onError: () => toast.error("归档已完成通知失败"),
    });
  }, [archiveCompletedMutation, setSelectedKey]);

  const handleCreateDecision = useCallback(() => {
    push("/issues");
    queueMicrotask(() => {
      useModalStore.getState().open("create-issue");
    });
  }, [push]);

  const handleOpenIssue = useCallback(
    (issueId: string) => {
      push(`/issues/${issueId}`);
    },
    [push],
  );

  const listHeader = (
    <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold">{t("inbox")}</h1>
        {unreadCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {unreadCount} 条未读
          </span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            全部标记已读
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleArchiveAll}>
            <Archive className="h-4 w-4" />
            全部归档
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchiveAllRead}>
            <BookCheck className="h-4 w-4" />
            归档已读
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchiveCompleted}>
            <ListChecks className="h-4 w-4" />
            归档已完成
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const detailContent = selected?.issue_id ? (
    <IssueDetail
      key={selected.id}
      issueId={selected.issue_id}
      defaultSidebarOpen={false}
      layoutId="multica_inbox_issue_detail_layout"
      highlightCommentId={selected.details?.comment_id ?? undefined}
      onDelete={() => handleArchive(selected.id)}
    />
  ) : selected ? (
    <div className="p-6">
      <h2 className="text-lg font-semibold">{selected.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {typeLabels[selected.type]} · {timeAgo(selected.created_at)}
      </p>
      {selected.body && (
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {selected.body}
        </div>
      )}
      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleArchive(selected.id)}
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          归档
        </Button>
      </div>
    </div>
  ) : null;

  const dashboardContent = (
    <InboxDashboard
      inboxItems={rawItems}
      myIssues={myIssues}
      decisions={decisions}
      inboxLoading={inboxLoading}
      todosLoading={todosLoading}
      decisionsLoading={decisionsLoading}
      selectedKey={selectedKey}
      onSelectItem={handleSelect}
      onArchiveItem={handleArchive}
      onCreateDecision={handleCreateDecision}
      onOpenIssue={handleOpenIssue}
    />
  );

  if (isMobile) {
    if (selected) {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center border-b px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedKey("")}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("inbox")}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{detailContent}</div>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {listHeader}
        <div className="min-h-0 flex-1 overflow-y-auto">{dashboardContent}</div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1 min-h-0"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel
        id="dashboard"
        defaultSize={440}
        minSize={320}
        maxSize={720}
        groupResizeBehavior="preserve-pixel-size"
      >
        <div className="flex h-full flex-col border-r">
          {listHeader}
          <div className="min-h-0 flex-1 overflow-y-auto">{dashboardContent}</div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="detail" minSize="35%">
        <div className="flex h-full min-h-0 flex-col">
          {inboxLoading && !selected ? (
            <div className="p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-4 h-4 w-28" />
              <Skeleton className="mt-8 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ) : detailContent ?? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm">
                {recentItems.length === 0 ? "当前没有可查看的动态" : "选择左侧内容查看详情"}
              </p>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
