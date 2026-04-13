"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { AppLink } from "../../navigation";
import { useNavigation } from "../../navigation";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link2,
  MoreHorizontal,
  PanelRight,
  Pin,
  PinOff,
  Plus,
  Trash2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@multica/ui/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@multica/ui/components/ui/resizable";
import { ContentEditor, type ContentEditorRef, TitleEditor, useFileDropZone, FileDropOverlay } from "../../editor";
import { FileUploadButton } from "@multica/ui/components/common/file-upload-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@multica/ui/components/ui/tooltip";
import { ActorAvatar } from "../../common/actor-avatar";
import type { Issue, UpdateIssueRequest } from "@multica/core/types";
import {
  ALL_STATUSES,
  PRIORITY_ORDER,
  PRIORITY_CONFIG,
  getIssuePriorityLabel,
  getIssueStatusLabel,
} from "@multica/core/issues/config";
import { StatusIcon, PriorityIcon, StatusPicker, PriorityPicker, DueDatePicker, AssigneePicker, canAssignAgent } from ".";
import { ProjectPicker } from "../../projects/components/project-picker";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceStore } from "@multica/core/workspace";
import { useActorName } from "@multica/core/workspace/hooks";
import { useWorkspaceId } from "@multica/core/hooks";
import { issueListOptions, issueDetailOptions, childIssuesOptions, issueUsageOptions } from "@multica/core/issues/queries";
import { memberListOptions, agentListOptions } from "@multica/core/workspace/queries";
import { useUpdateIssue, useDeleteIssue } from "@multica/core/issues/mutations";
import { useRecentIssuesStore } from "@multica/core/issues/stores";
import { useIssueReactions } from "../hooks/use-issue-reactions";
import { ReactionBar } from "@multica/ui/components/common/reaction-bar";
import { useFileUpload } from "@multica/core/hooks/use-file-upload";
import { api } from "@multica/core/api";
import { useModalStore } from "@multica/core/modals";
import { getClientLocale } from "@multica/core/platform";
import { cn } from "@multica/ui/lib/utils";
import { pinListOptions } from "@multica/core/pins";
import { useCreatePin, useDeletePin } from "@multica/core/pins";
import {
  ApprovalTab,
  CollaborationTab,
  DecisionTabBar,
  type DecisionTabId,
  DiagnosisTab,
  ExecutionTab,
  getDecisionTabs,
  OverviewTab,
  RecommendationTab,
  SimulationTab,
  SnapshotsTab,
} from "./decision-tabs";

import { ProgressRing } from "./progress-ring";

function shortDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasDecisionMetadata(issue: Issue): boolean {
  return Boolean(
    issue.phase
      || issue.risk_level
      || issue.execution_mode
      || issue.decision_type
      || issue.object_type,
  );
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Property row
// ---------------------------------------------------------------------------

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md px-2 -mx-2 hover:bg-accent/50 transition-colors">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs truncate">
        {children}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IssueDetailProps {
  issueId: string;
  onDelete?: () => void;
  defaultSidebarOpen?: boolean;
  layoutId?: string;
  showBackLink?: boolean;
  backHref?: string;
  backLabel?: string;
  /** When set, the issue detail will auto-scroll to this comment and briefly highlight it. */
  highlightCommentId?: string;
}

// ---------------------------------------------------------------------------
// IssueDetail
// ---------------------------------------------------------------------------

export function IssueDetail({
  issueId,
  onDelete,
  defaultSidebarOpen = true,
  layoutId = "multica_issue_detail_layout",
  showBackLink = false,
  backHref = "/issues",
  backLabel,
  highlightCommentId,
}: IssueDetailProps) {
  const id = issueId;
  const locale = getClientLocale();
  const isZh = locale === "zh-CN";
  const resolvedBackLabel = backLabel ?? (locale === "zh-CN" ? "返回决策单中心" : "Back to Issues");
  const router = useNavigation();
  const user = useAuthStore((s) => s.user);
  const workspace = useWorkspaceStore((s) => s.workspace);

  // Issue navigation — read from TQ list cache
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const currentMemberRole = members.find((m) => m.user_id === user?.id)?.role;
  const { data: allIssues = [] } = useQuery(issueListOptions(wsId));
  const currentIndex = allIssues.findIndex((i) => i.id === id);
  const prevIssue = currentIndex > 0 ? allIssues[currentIndex - 1] : null;
  const nextIssue = currentIndex < allIssues.length - 1 ? allIssues[currentIndex + 1] : null;
  const { getActorName } = useActorName();
  const { uploadWithToast } = useFileUpload(api);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: layoutId,
  });
  const sidebarRef = usePanelRef();
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<DecisionTabId>("overview");

  // Issue data from TQ — uses detail query, seeded from list cache if available.
  // Only seed when description is present; list API omits it, and ContentEditor
  // reads defaultValue on mount only — seeding null description shows an empty editor.
  const { data: issue = null, isLoading: issueLoading } = useQuery({
    ...issueDetailOptions(wsId, id),
    initialData: () => {
      const cached = allIssues.find((i) => i.id === id);
      return cached?.description != null ? cached : undefined;
    },
  });

  // Record recent visit
  const recordVisit = useRecentIssuesStore((s) => s.recordVisit);
  useEffect(() => {
    if (issue) {
      recordVisit({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
      });
    }
  }, [issue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    reactions: issueReactions, loading: reactionsLoading,
    toggleReaction: handleToggleIssueReaction,
  } = useIssueReactions(id, user?.id);

  // Token usage
  const { data: usage } = useQuery(issueUsageOptions(id));

  // Pinned state
  const { data: pinnedItems = [] } = useQuery(pinListOptions(wsId));
  const isPinned = pinnedItems.some((p) => p.item_type === "issue" && p.item_id === id);
  const createPin = useCreatePin();
  const deletePin = useDeletePin();

  // Sub-issue queries
  const parentIssueId = issue?.parent_issue_id;
  const { data: parentIssue = null } = useQuery({
    ...issueDetailOptions(wsId, parentIssueId ?? ""),
    enabled: !!parentIssueId,
    initialData: () => allIssues.find((i) => i.id === parentIssueId),
  });
  const { data: childIssues = [] } = useQuery({
    ...childIssuesOptions(wsId, id),
    enabled: !!issue,
  });
  // Parent's children — used to render the "x/y" progress next to the
  // "Sub-issue of …" breadcrumb under the title.
  const { data: parentChildIssues = [] } = useQuery({
    ...childIssuesOptions(wsId, parentIssueId ?? ""),
    enabled: !!parentIssueId,
  });
  const [subIssuesCollapsed, setSubIssuesCollapsed] = useState(false);

  const loading = issueLoading;
  const hasDecisionTabs = issue ? hasDecisionMetadata(issue) : false;
  const visibleTabs = getDecisionTabs(hasDecisionTabs);

  useEffect(() => {
    setActiveTab("overview");
  }, [id]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, visibleTabs]);

  // Issue field updates via TQ mutation (optimistic update + rollback in mutation hook)
  const updateIssueMutation = useUpdateIssue();
  const handleUpdateField = useCallback(
    (updates: Partial<UpdateIssueRequest>) => {
      if (!issue) return;
      updateIssueMutation.mutate(
        { id, ...updates },
        { onError: () => toast.error("Failed to update issue") },
      );
    },
    [issue, id, updateIssueMutation],
  );

  const descEditorRef = useRef<ContentEditorRef>(null);
  const { isDragOver: descDragOver, dropZoneProps: descDropZoneProps } = useFileDropZone({
    onDrop: (files) => files.forEach((f) => descEditorRef.current?.uploadFile(f)),
  });
  // Description uploads don't pass issueId — the URL lives in the markdown.
  // This avoids stale attachment records when users delete images from the editor.
  const handleDescriptionUpload = useCallback(
    (file: File) => uploadWithToast(file),
    [uploadWithToast],
  );

  const deleteIssueMutation = useDeleteIssue();
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteIssueMutation.mutateAsync(issue!.id);
      toast.success("Issue deleted");
      if (onDelete) onDelete();
      else router.push("/issues");
    } catch {
      toast.error("Failed to delete issue");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        {/* Header skeleton */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-1 min-h-0">
          {/* Content skeleton */}
          <div className="flex-1 p-8 space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            </div>
          </div>
          {/* Sidebar skeleton */}
          <div className="w-64 border-l p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
            <Skeleton className="h-px w-full" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>This issue does not exist or has been deleted in this workspace.</p>
        {!onDelete && (
          <Button variant="outline" size="sm" onClick={() => router.push(backHref)}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            {resolvedBackLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <ResizablePanel id="content" minSize="50%">
      {/* LEFT: Content area */}
      <div className="flex h-full flex-col">
        {/* Header bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4 text-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            {showBackLink && (
              <>
                <AppLink
                  href={backHref}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>{resolvedBackLabel}</span>
                </AppLink>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </>
            )}
            {workspace && (
              <>
                <AppLink
                  href="/issues"
                  className="text-muted-foreground hover:text-foreground transition-colors truncate shrink-0"
                >
                  {workspace.name}
                </AppLink>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </>
            )}
            {parentIssue && (
              <>
                <AppLink
                  href={`/issues/${parentIssue.id}`}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate shrink-0"
                >
                  {parentIssue.identifier}
                </AppLink>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </>
            )}
            <span className="truncate text-muted-foreground">
              {issue.identifier}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="truncate">{issue.title}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Issue navigation */}
            {allIssues.length > 1 && (
              <div className="flex items-center gap-0.5 mr-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
                        disabled={!prevIssue}
                        onClick={() => prevIssue && router.push(`/issues/${prevIssue.id}`)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">
                    {isZh ? "上一条决策单" : "Previous issue"}
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground tabular-nums px-0.5">
                  {currentIndex >= 0 ? currentIndex + 1 : "?"} / {allIssues.length}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
                        disabled={!nextIssue}
                        onClick={() => nextIssue && router.push(`/issues/${nextIssue.id}`)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">
                    {isZh ? "下一条决策单" : "Next issue"}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={cn("text-muted-foreground", isPinned && "text-foreground")}
                    onClick={() => {
                      if (isPinned) {
                        deletePin.mutate({ itemType: "issue", itemId: issue.id });
                      } else {
                        createPin.mutate({ item_type: "issue", item_id: issue.id });
                      }
                    }}
                  >
                    {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {isPinned
                  ? isZh
                    ? "从侧边栏取消固定"
                    : "Unpin from sidebar"
                  : isZh
                    ? "固定到侧边栏"
                    : "Pin to sidebar"}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-auto">
                {/* Status */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <StatusIcon status={issue.status} className="h-3.5 w-3.5" />
                    {isZh ? "状态" : "Status"}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {ALL_STATUSES.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => handleUpdateField({ status: s })}
                      >
                        <StatusIcon status={s} className="h-3.5 w-3.5" />
                        {getIssueStatusLabel(s, locale)}
                        {issue.status === s && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Priority */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <PriorityIcon priority={issue.priority} />
                    {isZh ? "优先级" : "Priority"}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {PRIORITY_ORDER.map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onClick={() => handleUpdateField({ priority: p })}
                      >
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_CONFIG[p].badgeBg} ${PRIORITY_CONFIG[p].badgeText}`}>
                          <PriorityIcon priority={p} className="h-3 w-3" inheritColor />
                          {getIssuePriorityLabel(p, locale)}
                        </span>
                        {issue.priority === p && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Assignee */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UserMinus className="h-3.5 w-3.5" />
                    {isZh ? "负责人" : "Assignee"}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => handleUpdateField({ assignee_type: null, assignee_id: null })}
                    >
                      <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                      {isZh ? "未分配" : "Unassigned"}
                      {!issue.assignee_type && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                    </DropdownMenuItem>
                    {members.map((m) => (
                      <DropdownMenuItem
                        key={m.user_id}
                        onClick={() => handleUpdateField({ assignee_type: "member", assignee_id: m.user_id })}
                      >
                        <ActorAvatar actorType="member" actorId={m.user_id} size={16} />
                        {m.name}
                        {issue.assignee_type === "member" && issue.assignee_id === m.user_id && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                    ))}
                    {agents.filter((a) => !a.archived_at && canAssignAgent(a, user?.id, currentMemberRole)).map((a) => (
                      <DropdownMenuItem
                        key={a.id}
                        onClick={() => handleUpdateField({ assignee_type: "agent", assignee_id: a.id })}
                      >
                        <ActorAvatar actorType="agent" actorId={a.id} size={16} />
                        {a.name}
                        {issue.assignee_type === "agent" && issue.assignee_id === a.id && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Due date */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Calendar className="h-3.5 w-3.5" />
                    Due date
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleUpdateField({ due_date: new Date().toISOString() })}>
                      Today
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() + 1);
                      handleUpdateField({ due_date: d.toISOString() });
                    }}>
                      Tomorrow
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() + 7);
                      handleUpdateField({ due_date: d.toISOString() });
                    }}>
                      Next week
                    </DropdownMenuItem>
                    {issue.due_date && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdateField({ due_date: null })}>
                          Clear date
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Create sub-issue */}
                <DropdownMenuItem onClick={() => {
                  useModalStore.getState().open("create-issue", {
                    parent_issue_id: issue.id,
                    parent_issue_identifier: issue.identifier,
                  });
                }}>
                  <Plus className="h-3.5 w-3.5" />
                  {isZh ? "新增子事项" : "Create sub-issue"}
                </DropdownMenuItem>

                {/* Pin / Unpin */}
                <DropdownMenuItem onClick={() => {
                  if (isPinned) {
                    deletePin.mutate({ itemType: "issue", itemId: issue.id });
                  } else {
                    createPin.mutate({ item_type: "issue", item_id: issue.id });
                  }
                }}>
                  {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  {isPinned
                    ? isZh
                      ? "从侧边栏取消固定"
                      : "Unpin from sidebar"
                    : isZh
                      ? "固定到侧边栏"
                      : "Pin to sidebar"}
                </DropdownMenuItem>

                {/* Copy link */}
                <DropdownMenuItem onClick={() => {
                  const url = router.getShareableUrl
                    ? router.getShareableUrl(router.pathname)
                    : window.location.href;
                  navigator.clipboard.writeText(url);
                  toast.success(isZh ? "链接已复制" : "Link copied");
                }}>
                  <Link2 className="h-3.5 w-3.5" />
                  {isZh ? "复制链接" : "Copy link"}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Delete */}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isZh ? "删除决策单" : "Delete issue"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={sidebarOpen ? "secondary" : "ghost"}
                    size="icon-xs"
                    className={sidebarOpen ? "" : "text-muted-foreground"}
                    onClick={() => {
                      const panel = sidebarRef.current;
                      if (!panel) return;
                      if (panel.isCollapsed()) panel.expand();
                      else panel.collapse();
                    }}
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {isZh ? "展开或收起侧边栏" : "Toggle sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

            {/* Delete confirmation dialog (controlled by state) */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isZh ? "删除决策单" : "Delete issue"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isZh
                      ? "这会永久删除当前决策单及其全部评论，且无法恢复。"
                      : "This will permanently delete this issue and all its comments. This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{isZh ? "取消" : "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {deleting ? (isZh ? "删除中..." : "Deleting...") : isZh ? "删除" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

        <DecisionTabBar tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content — scrollable */}
        <div className="relative flex-1 overflow-y-auto">
          {(() => {
            switch (activeTab) {
              case "snapshots":
                return <SnapshotsTab issueId={id} />;
              case "diagnosis":
                return <DiagnosisTab issueId={id} />;
              case "simulation":
                return <SimulationTab issueId={id} />;
              case "recommendation":
                return <RecommendationTab issueId={id} />;
              case "approval":
                return <ApprovalTab issueId={id} />;
              case "execution":
                return <ExecutionTab issueId={id} />;
              case "collaboration":
                return (
                  <CollaborationTab
                    issueId={id}
                    heading="协同记录"
                    highlightCommentId={highlightCommentId}
                    standalone
                  />
                );
              case "overview":
              default:
                return (
                  <OverviewTab>
                    <TitleEditor
                      key={`title-${id}`}
                      defaultValue={issue.title}
                      placeholder={isZh ? "决策单标题" : "Issue title"}
                      className="w-full text-2xl font-bold leading-snug tracking-tight"
                      onBlur={(value) => {
                        const trimmed = value.trim();
                        if (trimmed && trimmed !== issue.title) handleUpdateField({ title: trimmed });
                      }}
                    />

                    {parentIssue && (
                      <AppLink
                        href={`/issues/${parentIssue.id}`}
                        className="group/parent mt-2 inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="shrink-0 font-medium">
                          {isZh ? "所属父事项" : "Sub-issue of"}
                        </span>
                        <StatusIcon status={parentIssue.status} className="h-3.5 w-3.5 shrink-0" />
                        <span className="shrink-0 tabular-nums">{parentIssue.identifier}</span>
                        <span className="truncate group-hover/parent:text-foreground">
                          {parentIssue.title}
                        </span>
                        {parentChildIssues.length > 0 && (() => {
                          const done = parentChildIssues.filter((child) => child.status === "done").length;

                          return (
                            <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5">
                              <ProgressRing done={done} total={parentChildIssues.length} size={11} />
                              <span className="text-[10.5px] font-medium tabular-nums">
                                {done}/{parentChildIssues.length}
                              </span>
                            </span>
                          );
                        })()}
                      </AppLink>
                    )}

                    <div {...descDropZoneProps} className="relative mt-5 rounded-lg">
                      <ContentEditor
                        ref={descEditorRef}
                        key={id}
                        defaultValue={issue.description || ""}
                        placeholder={isZh ? "补充描述..." : "Add description..."}
                        onUpdate={(md) => handleUpdateField({ description: md || undefined })}
                        onUploadFile={handleDescriptionUpload}
                        debounceMs={1500}
                      />

                      <div className="mt-3 flex items-center gap-1">
                        {reactionsLoading ? (
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-7 w-14 rounded-full" />
                            <Skeleton className="h-7 w-14 rounded-full" />
                          </div>
                        ) : (
                          <ReactionBar
                            reactions={issueReactions}
                            currentUserId={user?.id}
                            onToggle={handleToggleIssueReaction}
                            getActorName={getActorName}
                          />
                        )}
                        <FileUploadButton
                          size="sm"
                          onSelect={(file) => descEditorRef.current?.uploadFile(file)}
                        />
                      </div>
                      {descDragOver ? <FileDropOverlay /> : null}
                    </div>

                    {childIssues.length === 0 ? (
                      <div className="mt-6">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() =>
                            useModalStore.getState().open("create-issue", {
                              parent_issue_id: issue.id,
                              parent_issue_identifier: issue.identifier,
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{isZh ? "新增子事项" : "Add sub-issues"}</span>
                        </button>
                      </div>
                    ) : null}

                    {childIssues.length > 0 && (() => {
                      const doneCount = childIssues.filter((child) => child.status === "done").length;

                      return (
                        <div className="mt-10">
                          <div className="mb-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSubIssuesCollapsed((value) => !value)}
                              className="flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                  subIssuesCollapsed && "-rotate-90",
                                )}
                              />
                              <span>{isZh ? "子事项" : "Sub-issues"}</span>
                            </button>
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5">
                              <ProgressRing done={doneCount} total={childIssues.length} size={11} />
                              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                                {doneCount}/{childIssues.length}
                              </span>
                            </div>
                            <Tooltip>
                              <TooltipTrigger
                                render={(
                                  <button
                                    type="button"
                                    className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    onClick={() =>
                                      useModalStore.getState().open("create-issue", {
                                        parent_issue_id: issue.id,
                                        parent_issue_identifier: issue.identifier,
                                      })
                                    }
                                    aria-label={isZh ? "新增子事项" : "Add sub-issue"}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}
                              />
                              <TooltipContent side="bottom">
                                {isZh ? "新增子事项" : "Add sub-issue"}
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          {!subIssuesCollapsed ? (
                            <div className="divide-y divide-border/60 overflow-hidden rounded-lg border bg-card/30">
                              {childIssues.map((child) => {
                                const isDone = child.status === "done" || child.status === "cancelled";

                                return (
                                  <AppLink
                                    key={child.id}
                                    href={`/issues/${child.id}`}
                                    className="group/row flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent/50"
                                  >
                                    <StatusIcon
                                      status={child.status}
                                      className="h-[15px] w-[15px] shrink-0"
                                    />
                                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                                      {child.identifier}
                                    </span>
                                    <span
                                      className={cn(
                                        "flex-1 truncate text-sm",
                                        isDone
                                          ? "text-muted-foreground"
                                          : "group-hover/row:text-foreground",
                                      )}
                                    >
                                      {child.title}
                                    </span>
                                    {child.assignee_type && child.assignee_id ? (
                                      <ActorAvatar
                                        actorType={child.assignee_type}
                                        actorId={child.assignee_id}
                                        size={20}
                                        className="shrink-0"
                                      />
                                    ) : (
                                      <span
                                        aria-hidden
                                        className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/30"
                                      />
                                    )}
                                  </AppLink>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}

                    <div className="my-8 border-t" />
                    <CollaborationTab
                      issueId={id}
                      heading={isZh ? "协同记录" : "Activity"}
                      highlightCommentId={highlightCommentId}
                    />
                  </OverviewTab>
                );
            }
          })()}
        </div>
      </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id="sidebar"
        defaultSize={defaultSidebarOpen ? 320 : 0}
        minSize={260}
        maxSize={420}
        collapsible
        groupResizeBehavior="preserve-pixel-size"
        panelRef={sidebarRef}
        onResize={(size) => setSidebarOpen(size.inPixels > 0)}
      >
      {/* RIGHT: Properties sidebar */}
      <div className="overflow-y-auto border-l h-full">
        <div className="p-4 space-y-5">
          {/* Properties section */}
          <div>
            <button
              className={`flex w-full items-center gap-1 text-xs font-medium transition-colors mb-2 ${propertiesOpen ? "" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setPropertiesOpen(!propertiesOpen)}
            >
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${propertiesOpen ? "rotate-90" : ""}`} />
              {isZh ? "属性" : "Properties"}
            </button>

            {propertiesOpen && <div className="space-y-0.5 pl-2">
              {/* Status */}
              <PropRow label={isZh ? "状态" : "Status"}>
                <StatusPicker
                  status={issue.status}
                  onUpdate={handleUpdateField}
                  align="start"
                />
              </PropRow>

              {/* Priority */}
              <PropRow label={isZh ? "优先级" : "Priority"}>
                <PriorityPicker
                  priority={issue.priority}
                  onUpdate={handleUpdateField}
                  align="start"
                />
              </PropRow>

              {/* Assignee */}
              <PropRow label={isZh ? "负责人" : "Assignee"}>
                <AssigneePicker
                  assigneeType={issue.assignee_type}
                  assigneeId={issue.assignee_id}
                  onUpdate={handleUpdateField}
                  align="start"
                />
              </PropRow>

              {/* Due date */}
              <PropRow label={isZh ? "截止时间" : "Due date"}>
                <DueDatePicker
                  dueDate={issue.due_date}
                  onUpdate={handleUpdateField}
                />
              </PropRow>

              {/* Project */}
              <PropRow label={isZh ? "项目" : "Project"}>
                <ProjectPicker
                  projectId={issue.project_id}
                  onUpdate={handleUpdateField}
                />
              </PropRow>
            </div>}
          </div>

          {/* Parent issue */}
          {parentIssue && (
            <div>
              <div className="text-xs font-medium mb-2 flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rotate-90" />
                {isZh ? "父事项" : "Parent issue"}
              </div>
              <div className="pl-2">
                <AppLink
                  href={`/issues/${parentIssue.id}`}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 -mx-2 text-xs hover:bg-accent/50 transition-colors group"
                >
                  <StatusIcon status={parentIssue.status} className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-muted-foreground shrink-0">{parentIssue.identifier}</span>
                  <span className="truncate group-hover:text-foreground">{parentIssue.title}</span>
                </AppLink>
              </div>
            </div>
          )}

          {/* Details section */}
          <div>
            <button
              className={`flex w-full items-center gap-1 text-xs font-medium transition-colors mb-2 ${detailsOpen ? "" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
              {isZh ? "详情" : "Details"}
            </button>

            {detailsOpen && <div className="space-y-0.5 pl-2">
              <PropRow label={isZh ? "创建人" : "Created by"}>
                <ActorAvatar
                  actorType={issue.creator_type}
                  actorId={issue.creator_id}
                  size={18}
                />
                <span className="truncate">{getActorName(issue.creator_type, issue.creator_id)}</span>
              </PropRow>
              <PropRow label={isZh ? "创建时间" : "Created"}>
                <span className="text-muted-foreground">{shortDate(issue.created_at)}</span>
              </PropRow>
              <PropRow label={isZh ? "更新时间" : "Updated"}>
                <span className="text-muted-foreground">{shortDate(issue.updated_at)}</span>
              </PropRow>
            </div>}
          </div>

          {/* Token usage */}
          {usage && usage.task_count > 0 && (
            <div>
              <div className="text-xs font-medium mb-2 flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rotate-90" />
                {isZh ? "Token 用量" : "Token usage"}
              </div>
              <div className="space-y-0.5 pl-2">
                <PropRow label={isZh ? "输入" : "Input"}>
                  <span className="text-muted-foreground">{formatTokenCount(usage.total_input_tokens)}</span>
                </PropRow>
                <PropRow label={isZh ? "输出" : "Output"}>
                  <span className="text-muted-foreground">{formatTokenCount(usage.total_output_tokens)}</span>
                </PropRow>
                {(usage.total_cache_read_tokens > 0 || usage.total_cache_write_tokens > 0) && (
                  <PropRow label={isZh ? "缓存" : "Cache"}>
                    <span className="text-muted-foreground">
                      {isZh
                        ? `${formatTokenCount(usage.total_cache_read_tokens)} 读 / ${formatTokenCount(usage.total_cache_write_tokens)} 写`
                        : `${formatTokenCount(usage.total_cache_read_tokens)} read / ${formatTokenCount(usage.total_cache_write_tokens)} write`}
                    </span>
                  </PropRow>
                )}
                <PropRow label={isZh ? "运行次数" : "Runs"}>
                  <span className="text-muted-foreground">{usage.task_count}</span>
                </PropRow>
              </div>
            </div>
          )}

        </div>
      </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
