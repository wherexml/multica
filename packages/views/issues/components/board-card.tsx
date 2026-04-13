"use client";

import { useCallback, memo } from "react";
import { AppLink } from "../../navigation";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import type { Issue, UpdateIssueRequest } from "@multica/core/types";
import { CalendarDays } from "lucide-react";
import { ActorAvatar } from "../../common/actor-avatar";
import { useUpdateIssue } from "@multica/core/issues/mutations";
import { PriorityIcon } from "./priority-icon";
import { PriorityPicker, AssigneePicker, DueDatePicker } from "./pickers";
import { PRIORITY_CONFIG } from "@multica/core/issues/config";
import { useViewStore } from "@multica/core/issues/stores/view-store-context";
import { ProgressRing } from "./progress-ring";
import type { ChildProgress } from "./list-row";
import {
  DecisionExecutionModeIndicator,
  DecisionPhaseIndicator,
  DecisionRiskBadge,
} from "./decision-case-meta";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Stops event from bubbling to Link/drag handlers */
function PickerWrapper({ children }: { children: React.ReactNode }) {
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  return (
    <div onClick={stop} onMouseDown={stop} onPointerDown={stop}>
      {children}
    </div>
  );
}

export const BoardCardContent = memo(function BoardCardContent({
  issue,
  editable = false,
  childProgress,
  active = false,
}: {
  issue: Issue;
  editable?: boolean;
  childProgress?: ChildProgress;
  active?: boolean;
}) {
  const storeProperties = useViewStore((s) => s.cardProperties);
  const priorityCfg = PRIORITY_CONFIG[issue.priority];

  const updateIssueMutation = useUpdateIssue();
  const handleUpdate = useCallback(
    (updates: Partial<UpdateIssueRequest>) => {
      updateIssueMutation.mutate(
        { id: issue.id, ...updates },
        { onError: () => toast.error("Failed to update issue") },
      );
    },
    [issue.id, updateIssueMutation],
  );

  const showPriority = storeProperties.priority;
  const showDescription = storeProperties.description && issue.description;
  const showAssignee = storeProperties.assignee && issue.assignee_type && issue.assignee_id;
  const showDueDate = storeProperties.dueDate && issue.due_date;

  return (
    <div className={`rounded-lg border bg-card p-3.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] transition-shadow group-hover:shadow-sm ${
      active ? "ring-2 ring-primary/35" : ""
    }`}>
      {/* Row 1: Identifier */}
      <p className="text-xs text-muted-foreground">{issue.identifier}</p>

      {/* Row 2: Title */}
      <p className="mt-1 text-sm font-medium leading-snug line-clamp-2">
        {issue.title}
      </p>

      {/* Sub-issue progress */}
      {childProgress && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5">
          <ProgressRing done={childProgress.done} total={childProgress.total} size={14} />
          <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
            {childProgress.done}/{childProgress.total}
          </span>
        </div>
      )}

      {(issue.risk_level || issue.phase || issue.execution_mode) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {issue.risk_level && <DecisionRiskBadge riskLevel={issue.risk_level} />}
          {issue.phase && <DecisionPhaseIndicator phase={issue.phase} />}
          {issue.execution_mode && (
            <DecisionExecutionModeIndicator mode={issue.execution_mode} />
          )}
        </div>
      )}

      {/* Description */}
      {showDescription && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {issue.description}
        </p>
      )}

      {/* Row 3: Assignee, priority badge, due date */}
      {(showAssignee || showPriority || showDueDate) && (
        <div className="mt-3 flex items-center gap-2">
          {showAssignee &&
            (editable ? (
              <PickerWrapper>
                <AssigneePicker
                  assigneeType={issue.assignee_type}
                  assigneeId={issue.assignee_id}
                  onUpdate={handleUpdate}
                  trigger={
                    <ActorAvatar
                      actorType={issue.assignee_type!}
                      actorId={issue.assignee_id!}
                      size={22}
                    />
                  }
                />
              </PickerWrapper>
            ) : (
              <ActorAvatar
                actorType={issue.assignee_type!}
                actorId={issue.assignee_id!}
                size={22}
              />
            ))}
          {showPriority &&
            (editable ? (
              <PickerWrapper>
                <PriorityPicker
                  priority={issue.priority}
                  onUpdate={handleUpdate}
                  trigger={
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}>
                      <PriorityIcon priority={issue.priority} className="h-3 w-3" inheritColor />
                      {priorityCfg.label}
                    </span>
                  }
                />
              </PickerWrapper>
            ) : (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}>
                <PriorityIcon priority={issue.priority} className="h-3 w-3" inheritColor />
                {priorityCfg.label}
              </span>
            ))}
          {showDueDate && (
            <div className="ml-auto">
              {editable ? (
                <PickerWrapper>
                  <DueDatePicker
                    dueDate={issue.due_date}
                    onUpdate={handleUpdate}
                    trigger={
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          new Date(issue.due_date!) < new Date()
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        <CalendarDays className="size-3" />
                        {formatDate(issue.due_date!)}
                      </span>
                    }
                  />
                </PickerWrapper>
              ) : (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    new Date(issue.due_date!) < new Date()
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  <CalendarDays className="size-3" />
                  {formatDate(issue.due_date!)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) return false;
  return defaultAnimateLayoutChanges(args);
};

export const DraggableBoardCard = memo(function DraggableBoardCard({
  issue,
  childProgress,
  active = false,
  onOpenIssue,
}: {
  issue: Issue;
  childProgress?: ChildProgress;
  active?: boolean;
  onOpenIssue?: (issueId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: { status: issue.status },
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-30" : ""}
    >
      {onOpenIssue ? (
        <button
          type="button"
          onClick={() => onOpenIssue(issue.id)}
          className={`group block w-full text-left transition-colors ${isDragging ? "pointer-events-none" : ""}`}
        >
          <BoardCardContent
            issue={issue}
            editable
            childProgress={childProgress}
            active={active}
          />
        </button>
      ) : (
        <AppLink
          href={`/issues/${issue.id}`}
          className={`group block transition-colors ${isDragging ? "pointer-events-none" : ""}`}
        >
          <BoardCardContent
            issue={issue}
            editable
            childProgress={childProgress}
            active={active}
          />
        </AppLink>
      )}
    </div>
  );
});
