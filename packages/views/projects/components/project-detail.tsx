"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { Check, ChevronRight, Link2, ListTodo, MoreHorizontal, PanelRight, Pin, PinOff, Trash2, UserMinus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@multica/ui/lib/utils";
import { toast } from "sonner";
import type { Issue, IssueStatus, ProjectStatus, ProjectPriority } from "@multica/core/types";
import { projectDetailOptions } from "@multica/core/projects/queries";
import { useUpdateProject, useDeleteProject } from "@multica/core/projects/mutations";
import { pinListOptions } from "@multica/core/pins";
import { useCreatePin, useDeletePin } from "@multica/core/pins";
import { issueListOptions } from "@multica/core/issues/queries";
import { useUpdateIssue } from "@multica/core/issues/mutations";
import { memberListOptions, agentListOptions } from "@multica/core/workspace/queries";
import { useWorkspaceId } from "@multica/core/hooks";
import { useActorName } from "@multica/core/workspace/hooks";
import { t } from "@multica/core/platform";
import { PROJECT_STATUS_ORDER, PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_ORDER, PROJECT_PRIORITY_CONFIG } from "@multica/core/projects/config";
import { BOARD_STATUSES } from "@multica/core/issues/config";
import { createIssueViewStore } from "@multica/core/issues/stores/view-store";
import { ViewStoreProvider, useViewStore } from "@multica/core/issues/stores/view-store-context";
import { filterIssues } from "../../issues/utils/filter";
import { getProjectIssueMetrics } from "./project-issue-metrics";
import { getProjectDecisionSummary, isDecisionPhase, isDecisionRiskLevel } from "./project-decision-summary";
import { ActorAvatar } from "../../common/actor-avatar";
import { AppLink, useNavigation } from "../../navigation";
import { TitleEditor, ContentEditor, type ContentEditorRef } from "../../editor";
import { PriorityIcon } from "../../issues/components/priority-icon";
import { IssuesHeader } from "../../issues/components/issues-header";
import { BoardView } from "../../issues/components/board-view";
import { ListView } from "../../issues/components/list-view";
import { BatchActionToolbar } from "../../issues/components/batch-action-toolbar";
import { DecisionPhaseIndicator, DecisionRiskBadge } from "../../issues/components/decision-case-meta";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@multica/ui/components/ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@multica/ui/components/ui/tooltip";
import { EmojiPicker } from "@multica/ui/components/common/emoji-picker";
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

// ---------------------------------------------------------------------------
// Property row — sidebar property display
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
// Decision association summary
// ---------------------------------------------------------------------------

function DecisionSummaryGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ value: string; label: string; count: number }>;
}) {
  return (
    <Card size="sm" className="bg-background/80">
      <CardHeader className="gap-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 ? (
            items.map((item) => (
              <span
                key={item.value}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground"
              >
                <span>{item.label}</span>
                <span className="font-medium text-foreground">{item.count}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">暂无统计</span>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

function ProjectDecisionSection({
  projectIssues,
  getActorName,
}: {
  projectIssues: Issue[];
  getActorName: (type: "member" | "agent", id: string) => string;
}) {
  const summary = useMemo(
    () => getProjectDecisionSummary(projectIssues),
    [projectIssues],
  );
  const decisionCards = useMemo(
    () =>
      [...projectIssues].sort(
        (left, right) =>
          new Date(right.updated_at).getTime() -
          new Date(left.updated_at).getTime(),
      ),
    [projectIssues],
  );

  return (
    <div className="border-b bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">关联决策案例</p>
          <p className="text-xs text-muted-foreground">
            查看当前专题下的风险分布、推进阶段和负责人。
          </p>
        </div>
        <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
          {summary.totalCount} 个
        </span>
      </div>

      {decisionCards.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          暂无关联决策案例，可在{t("issue")}详情中把它关联到当前{t("project")}。
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <DecisionSummaryGroup title="按阶段" items={summary.phaseStats} />
            <DecisionSummaryGroup title="按风险等级" items={summary.riskStats} />
          </div>

          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {decisionCards.map((issue) => (
              <AppLink
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="min-w-[280px] max-w-[320px] flex-none"
              >
                <Card size="sm" className="h-full transition-colors hover:bg-accent/30">
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-2">
                        <CardTitle className="truncate text-sm">
                          {issue.title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          {isDecisionRiskLevel(issue.risk_level) && (
                            <DecisionRiskBadge riskLevel={issue.risk_level} />
                          )}
                          {isDecisionPhase(issue.phase) && (
                            <DecisionPhaseIndicator phase={issue.phase} />
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    </div>
                    <CardDescription className="line-clamp-2 text-xs leading-5">
                      {issue.description || "查看该决策的详细背景、动作和协同进展。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">负责人</span>
                    {issue.assignee_type && issue.assignee_id ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <ActorAvatar
                          actorType={issue.assignee_type}
                          actorId={issue.assignee_id}
                          size={16}
                        />
                        <span className="truncate font-medium">
                          {getActorName(issue.assignee_type, issue.assignee_id)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">未分配</span>
                    )}
                  </CardContent>
                </Card>
              </AppLink>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Issues — reuses the existing issues list/board components
// ---------------------------------------------------------------------------

const projectViewStore = createIssueViewStore("project_issues_view");

function ProjectIssuesContent({ projectIssues }: { projectIssues: Issue[] }) {
  const viewMode = useViewStore((s) => s.viewMode);
  const statusFilters = useViewStore((s) => s.statusFilters);
  const priorityFilters = useViewStore((s) => s.priorityFilters);
  const assigneeFilters = useViewStore((s) => s.assigneeFilters);
  const includeNoAssignee = useViewStore((s) => s.includeNoAssignee);
  const creatorFilters = useViewStore((s) => s.creatorFilters);
  const phaseFilters = useViewStore((s) => s.phaseFilters);
  const riskLevelFilters = useViewStore((s) => s.riskLevelFilters);
  const executionModeFilters = useViewStore((s) => s.executionModeFilters);
  const decisionTypeFilters = useViewStore((s) => s.decisionTypeFilters);
  const objectTypeFilters = useViewStore((s) => s.objectTypeFilters);

  const issues = useMemo(
    () =>
      filterIssues(projectIssues, {
        statusFilters,
        priorityFilters,
        assigneeFilters,
        includeNoAssignee,
        creatorFilters,
        projectFilters: [],
        includeNoProject: false,
        phaseFilters,
        riskLevelFilters,
        executionModeFilters,
        decisionTypeFilters,
        objectTypeFilters,
      }),
    [
      projectIssues,
      statusFilters,
      priorityFilters,
      assigneeFilters,
      includeNoAssignee,
      creatorFilters,
      phaseFilters,
      riskLevelFilters,
      executionModeFilters,
      decisionTypeFilters,
      objectTypeFilters,
    ],
  );
  const doneColumnCount = useMemo(
    () => projectIssues.filter((issue) => issue.status === "done").length,
    [projectIssues],
  );

  const childProgressMap = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const issue of projectIssues) {
      if (!issue.parent_issue_id) continue;
      const entry = map.get(issue.parent_issue_id);
      const isDone = issue.status === "done" || issue.status === "cancelled";
      if (entry) {
        entry.total++;
        if (isDone) entry.done++;
      } else {
        map.set(issue.parent_issue_id, { done: isDone ? 1 : 0, total: 1 });
      }
    }
    return map;
  }, [projectIssues]);

  const visibleStatuses = useMemo(() => {
    if (statusFilters.length > 0)
      return BOARD_STATUSES.filter((s) => statusFilters.includes(s));
    return BOARD_STATUSES;
  }, [statusFilters]);

  const hiddenStatuses = useMemo(
    () => BOARD_STATUSES.filter((s) => !visibleStatuses.includes(s)),
    [visibleStatuses],
  );

  const updateIssueMutation = useUpdateIssue();
  const handleMoveIssue = useCallback(
    (issueId: string, newStatus: IssueStatus, newPosition?: number) => {
      const viewState = projectViewStore.getState();
      if (viewState.sortBy !== "position") {
        viewState.setSortBy("position");
        viewState.setSortDirection("asc");
      }
      const updates: Partial<{ status: IssueStatus; position: number }> = { status: newStatus };
      if (newPosition !== undefined) updates.position = newPosition;
      updateIssueMutation.mutate(
        { id: issueId, ...updates },
        { onError: () => toast.error(`移动${t("issue")}失败`) },
      );
    },
    [updateIssueMutation],
  );

  if (projectIssues.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 text-muted-foreground">
        <ListTodo className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm">暂无关联{t("issue")}</p>
        <p className="text-xs">可在{t("issue")}详情中把它关联到当前{t("project")}。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {viewMode === "board" ? (
        <BoardView
          issues={issues}
          allIssues={projectIssues}
          visibleStatuses={visibleStatuses}
          hiddenStatuses={hiddenStatuses}
          onMoveIssue={handleMoveIssue}
          childProgressMap={childProgressMap}
          doneTotal={doneColumnCount}
        />
      ) : (
        <ListView
          issues={issues}
          visibleStatuses={visibleStatuses}
          childProgressMap={childProgressMap}
          doneTotal={doneColumnCount}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectDetail
// ---------------------------------------------------------------------------

export function ProjectDetail({ projectId }: { projectId: string }) {
  const wsId = useWorkspaceId();
  const router = useNavigation();
  const { data: project, isLoading } = useQuery(projectDetailOptions(wsId, projectId));
  const { data: allIssues = [] } = useQuery(issueListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { getActorName } = useActorName();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: pinnedItems = [] } = useQuery(pinListOptions(wsId));
  const isPinned = pinnedItems.some((p) => p.item_type === "project" && p.item_id === projectId);
  const createPin = useCreatePin();
  const deletePinMut = useDeletePin();
  const descEditorRef = useRef<ContentEditorRef>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  // Sidebar panel
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_project_detail_layout",
  });
  const sidebarRef = usePanelRef();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Lead popover
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadFilter, setLeadFilter] = useState("");
  const leadQuery = leadFilter.toLowerCase();
  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(leadQuery));
  const filteredAgents = agents.filter((a) => !a.archived_at && a.name.toLowerCase().includes(leadQuery));

  const projectIssues = useMemo(
    () => allIssues.filter((i) => i.project_id === projectId),
    [allIssues, projectId],
  );

  const handleUpdateField = useCallback(
    (data: Parameters<typeof updateProject.mutate>[0] extends { id: string } & infer R ? R : never) => {
      if (!project) return;
      updateProject.mutate({ id: project.id, ...data });
    },
    [project, updateProject],
  );

  const handleDelete = useCallback(() => {
    if (!project) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast.success("专题已删除");
        router.push("/projects");
      },
    });
  }, [project, deleteProject, router]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-8 py-10 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-40 w-full mt-8" />
      </div>
    );
  }

  if (!project) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">未找到专题</div>;
  }

  const issueMetrics = getProjectIssueMetrics(project, projectIssues);
  const statusCfg = PROJECT_STATUS_CONFIG[project.status];
  const priorityCfg = PROJECT_PRIORITY_CONFIG[project.priority];

  return (
    <div className="flex h-full flex-col">
      {/* Header bar — breadcrumb */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4 text-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <AppLink href="/projects" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            {t("projectsCenter")}
          </AppLink>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span className="truncate">{project.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-xs" className="text-muted-foreground shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => {
                if (isPinned) {
                  deletePinMut.mutate({ itemType: "project", itemId: projectId });
                } else {
                  createPin.mutate({ item_type: "project", item_id: projectId });
                }
              }}>
                {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                {isPinned ? "从侧栏取消固定" : "固定到侧栏"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("链接已复制");
              }}>
                <Link2 className="h-3.5 w-3.5" />
                复制链接
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除专题
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn("text-muted-foreground", isPinned && "text-foreground")}
            title={isPinned ? "从侧栏取消固定" : "固定到侧栏"}
            onClick={() => {
              if (isPinned) {
                deletePinMut.mutate({ itemType: "project", itemId: projectId });
              } else {
                createPin.mutate({ item_type: "project", item_id: projectId });
              }
            }}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("链接已复制");
            }}
          >
            <Link2 className="h-4 w-4" />
          </Button>
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
            <TooltipContent side="bottom">切换侧栏</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main content — issues list + sidebar */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
        <ResizablePanel id="content" minSize="50%">
          <div className="flex h-full flex-col">
            <ViewStoreProvider store={projectViewStore}>
              <ProjectDecisionSection
                projectIssues={projectIssues}
                getActorName={getActorName}
              />
              <IssuesHeader scopedIssues={projectIssues} />
              <ProjectIssuesContent projectIssues={projectIssues} />
              <BatchActionToolbar />
            </ViewStoreProvider>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          id="sidebar"
          defaultSize={sidebarOpen ? 320 : 0}
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
              {/* Icon + Title */}
              <div>
                <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="text-2xl cursor-pointer rounded-lg p-1 -ml-1 hover:bg-accent/60 transition-colors"
                        title="更换图标"
                      >
                        {project.icon || "📁"}
                      </button>
                    }
                  />
                  <PopoverContent align="start" className="w-auto p-0">
                    <EmojiPicker
                      onSelect={(emoji) => {
                        handleUpdateField({ icon: emoji });
                        setIconPickerOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <TitleEditor
                  key={`title-${projectId}`}
                  defaultValue={project.title}
                  placeholder="专题名称"
                  className="mt-2 w-full text-base font-semibold leading-snug tracking-tight"
                  onBlur={(value) => {
                    const trimmed = value.trim();
                    if (trimmed && trimmed !== project.title) handleUpdateField({ title: trimmed });
                  }}
                />
              </div>

              {/* Properties section */}
              <div>
                <button
                  className={`flex w-full items-center gap-1 text-xs font-medium transition-colors mb-2 ${propertiesOpen ? "" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setPropertiesOpen(!propertiesOpen)}
                >
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${propertiesOpen ? "rotate-90" : ""}`} />
                  专题信息
                </button>

                {propertiesOpen && <div className="space-y-0.5 pl-2">
                  {/* Status */}
                  <PropRow label="状态">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" className="inline-flex items-center gap-1.5 text-xs hover:text-foreground transition-colors">
                            <span className={cn("size-2 rounded-full", statusCfg.dotColor)} />
                            <span>{statusCfg.label}</span>
                          </button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-44">
                        {PROJECT_STATUS_ORDER.map((s) => (
                          <DropdownMenuItem key={s} onClick={() => handleUpdateField({ status: s as ProjectStatus })}>
                            <span className={cn("size-2 rounded-full", PROJECT_STATUS_CONFIG[s].dotColor)} />
                            <span>{PROJECT_STATUS_CONFIG[s].label}</span>
                            {s === project.status && <Check className="ml-auto h-3.5 w-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PropRow>

                  {/* Priority */}
                  <PropRow label="优先级">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" className="inline-flex items-center gap-1.5 text-xs hover:text-foreground transition-colors">
                            <PriorityIcon priority={project.priority} />
                            <span>{priorityCfg.label}</span>
                          </button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-44">
                        {PROJECT_PRIORITY_ORDER.map((p) => (
                          <DropdownMenuItem key={p} onClick={() => handleUpdateField({ priority: p as ProjectPriority })}>
                            <PriorityIcon priority={p} />
                            <span>{PROJECT_PRIORITY_CONFIG[p].label}</span>
                            {p === project.priority && <Check className="ml-auto h-3.5 w-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PropRow>

                  {/* Lead */}
                  <PropRow label="负责人">
                    <Popover open={leadOpen} onOpenChange={(v) => { setLeadOpen(v); if (!v) setLeadFilter(""); }}>
                      <PopoverTrigger
                        render={
                          <button type="button" className="inline-flex items-center gap-1.5 text-xs hover:text-foreground transition-colors">
                            {project.lead_type && project.lead_id ? (
                              <>
                                <ActorAvatar actorType={project.lead_type} actorId={project.lead_id} size={16} />
                                <span>{getActorName(project.lead_type, project.lead_id)}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">未设置负责人</span>
                            )}
                          </button>
                        }
                      />
                      <PopoverContent align="start" className="w-52 p-0">
                        <div className="px-2 py-1.5 border-b">
                          <input
                            type="text"
                            value={leadFilter}
                            onChange={(e) => setLeadFilter(e.target.value)}
                            placeholder="搜索负责人..."
                            className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none"
                          />
                        </div>
                        <div className="p-1 max-h-60 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => { handleUpdateField({ lead_type: null, lead_id: null }); setLeadOpen(false); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                          >
                            <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">未设置负责人</span>
                          </button>
                          {filteredMembers.length > 0 && (
                            <>
                              <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">成员</div>
                              {filteredMembers.map((m) => (
                                <button
                                  type="button"
                                  key={m.user_id}
                                  onClick={() => { handleUpdateField({ lead_type: "member", lead_id: m.user_id }); setLeadOpen(false); }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                                >
                                  <ActorAvatar actorType="member" actorId={m.user_id} size={16} />
                                  <span>{m.name}</span>
                                </button>
                              ))}
                            </>
                          )}
                          {filteredAgents.length > 0 && (
                            <>
                              <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("agent")}</div>
                              {filteredAgents.map((a) => (
                                <button
                                  type="button"
                                  key={a.id}
                                  onClick={() => { handleUpdateField({ lead_type: "agent", lead_id: a.id }); setLeadOpen(false); }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                                >
                                  <ActorAvatar actorType="agent" actorId={a.id} size={16} />
                                  <span>{a.name}</span>
                                </button>
                              ))}
                            </>
                          )}
                          {filteredMembers.length === 0 && filteredAgents.length === 0 && leadFilter && (
                            <div className="px-2 py-3 text-center text-sm text-muted-foreground">暂无匹配结果</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </PropRow>
                </div>}
              </div>

              {/* Progress */}
              {issueMetrics.totalCount > 0 && (() => {
                const pct = Math.round((issueMetrics.completedCount / issueMetrics.totalCount) * 100);
                return (
                  <div>
                    <div className="text-xs font-medium mb-2 flex items-center gap-1">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rotate-90" />
                      决策进展
                    </div>
                    <div className="pl-2 flex items-center gap-3">
                      <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {issueMetrics.completedCount}/{issueMetrics.totalCount}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Description */}
              <div>
                <h3 className="text-xs font-medium mb-2 flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rotate-90" />
                  专题说明
                </h3>
                <div className="pl-2">
                  <ContentEditor
                    ref={descEditorRef}
                    key={projectId}
                    defaultValue={project.description || ""}
                    placeholder="补充专题背景、目标和协同说明..."
                    onUpdate={(md) => handleUpdateField({ description: md || null })}
                    debounceMs={1500}
                  />
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除专题</AlertDialogTitle>
            <AlertDialogDescription>
              删除后仅解除与{t("issue")}的关联，不会删除已经存在的{t("issue")}。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
