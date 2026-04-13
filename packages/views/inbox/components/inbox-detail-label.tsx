"use client";

import { STATUS_CONFIG, PRIORITY_CONFIG } from "@multica/core/issues/config";
import { useActorName } from "@multica/core/workspace/hooks";
import { StatusIcon, PriorityIcon } from "../../issues/components";
import type { InboxItem, InboxItemType, IssueStatus, IssuePriority } from "@multica/core/types";

const statusLabelMap: Record<IssueStatus, string> = {
  backlog: "待梳理",
  todo: "待处理",
  in_progress: "进行中",
  in_review: "待复核",
  done: "已完成",
  blocked: "已阻塞",
  cancelled: "已取消",
};

const priorityLabelMap: Record<IssuePriority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
  none: "无优先级",
};

const typeLabels: Record<InboxItemType, string> = {
  issue_assigned: "已分配",
  unassigned: "已取消分配",
  assignee_changed: "负责人已变更",
  status_changed: "状态已变更",
  priority_changed: "优先级已变更",
  due_date_changed: "截止时间已变更",
  new_comment: "新增协同记录",
  mentioned: "提到了你",
  review_requested: "需要你复核",
  task_completed: "任务已完成",
  task_failed: "任务执行失败",
  agent_blocked: "Agent 已阻塞",
  agent_completed: "Agent 已完成",
  reaction_added: "新增回应",
};

export { typeLabels };

function shortDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

export function InboxDetailLabel({ item }: { item: InboxItem }) {
  const { getActorName } = useActorName();
  const details = item.details ?? {};

  switch (item.type) {
    case "status_changed": {
      if (!details.to) return <span>{typeLabels[item.type]}</span>;
      const status = details.to as IssueStatus;
      const label = statusLabelMap[status] ?? STATUS_CONFIG[status]?.label ?? details.to;
      return (
        <span className="inline-flex items-center gap-1">
          状态更新为
          <StatusIcon status={status} className="h-3 w-3" />
          {label}
        </span>
      );
    }
    case "priority_changed": {
      if (!details.to) return <span>{typeLabels[item.type]}</span>;
      const priority = details.to as IssuePriority;
      const label = priorityLabelMap[priority] ?? PRIORITY_CONFIG[priority]?.label ?? details.to;
      return (
        <span className="inline-flex items-center gap-1">
          优先级更新为
          <PriorityIcon priority={priority} className="h-3 w-3" />
          {label}
        </span>
      );
    }
    case "issue_assigned": {
      if (details.new_assignee_id) {
        return <span>已分配给 {getActorName(details.new_assignee_type ?? "member", details.new_assignee_id)}</span>;
      }
      return <span>{typeLabels[item.type]}</span>;
    }
    case "unassigned":
      return <span>已移除负责人</span>;
    case "assignee_changed": {
      if (details.new_assignee_id) {
        return <span>已分配给 {getActorName(details.new_assignee_type ?? "member", details.new_assignee_id)}</span>;
      }
      return <span>{typeLabels[item.type]}</span>;
    }
    case "due_date_changed": {
      if (details.to) return <span>截止时间更新为 {shortDate(details.to)}</span>;
      return <span>已移除截止时间</span>;
    }
    case "new_comment": {
      if (item.body) return <span>{item.body}</span>;
      return <span>{typeLabels[item.type]}</span>;
    }
    case "reaction_added": {
      const emoji = details.emoji;
      if (emoji) return <span>对你的协同记录回应了 {emoji}</span>;
      return <span>{typeLabels[item.type]}</span>;
    }
    default:
      return <span>{typeLabels[item.type] ?? item.type}</span>;
  }
}
