"use client";

import { memo } from "react";
import { AppLink } from "../../navigation";
import type { Issue } from "@multica/core/types";
import { ActorAvatar } from "../../common/actor-avatar";
import { useIssueSelectionStore } from "@multica/core/issues/stores/selection-store";
import { PriorityIcon } from "./priority-icon";
import { ProgressRing } from "./progress-ring";
import {
  DECISION_EXECUTION_MODE_LABELS,
  DecisionExecutionModeIcon,
  DecisionPhaseIndicator,
  DecisionRiskBadge,
} from "./decision-case-meta";

export interface ChildProgress {
  done: number;
  total: number;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const ListRow = memo(function ListRow({
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
  const selected = useIssueSelectionStore((s) => s.selectedIds.has(issue.id));
  const toggle = useIssueSelectionStore((s) => s.toggle);
  const content = (
    <>
      <span className="w-16 shrink-0 text-xs text-muted-foreground">
        {issue.identifier}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span className="truncate">{issue.title}</span>
        {childProgress && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5">
            <ProgressRing done={childProgress.done} total={childProgress.total} size={14} />
            <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
              {childProgress.done}/{childProgress.total}
            </span>
          </span>
        )}
        {issue.risk_level && (
          <DecisionRiskBadge
            riskLevel={issue.risk_level}
            className="hidden md:inline-flex"
          />
        )}
        {issue.phase && (
          <DecisionPhaseIndicator
            phase={issue.phase}
            className="hidden lg:inline-flex"
          />
        )}
        {issue.execution_mode && (
          <span
            className="hidden shrink-0 text-muted-foreground md:inline-flex"
            title={DECISION_EXECUTION_MODE_LABELS[issue.execution_mode]}
          >
            <DecisionExecutionModeIcon mode={issue.execution_mode} />
          </span>
        )}
      </span>
      {issue.due_date && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(issue.due_date)}
        </span>
      )}
      {issue.assignee_type && issue.assignee_id && (
        <ActorAvatar
          actorType={issue.assignee_type}
          actorId={issue.assignee_id}
          size={20}
        />
      )}
    </>
  );

  return (
    <div
      className={`group/row flex h-9 items-center gap-2 px-4 text-sm transition-colors hover:bg-accent/50 ${
        selected || active ? "bg-accent/30" : ""
      }`}
    >
      <div className="relative flex shrink-0 items-center justify-center w-4 h-4">
        <PriorityIcon
          priority={issue.priority}
          className={selected ? "hidden" : "group-hover/row:hidden"}
        />
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggle(issue.id)}
          className={`absolute inset-0 cursor-pointer accent-primary ${
            selected ? "" : "hidden group-hover/row:block"
          }`}
        />
      </div>
      {onOpenIssue ? (
        <button
          type="button"
          onClick={() => onOpenIssue(issue.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {content}
        </button>
      ) : (
        <AppLink
          href={`/issues/${issue.id}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          {content}
        </AppLink>
      )}
    </div>
  );
});
