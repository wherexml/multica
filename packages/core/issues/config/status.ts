import type { IssueStatus } from "../../types";
import { normalizeLocale } from "../../platform/lexicon";

export const STATUS_ORDER: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

export const ALL_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

/** Statuses shown as board columns (excludes cancelled). */
export const BOARD_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
];

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    label: string;
    iconColor: string;
    hoverBg: string;
    dividerColor: string;
    badgeBg: string;
    badgeText: string;
    columnBg: string;
  }
> = {
  backlog: { label: "Backlog", iconColor: "text-muted-foreground", hoverBg: "hover:bg-accent", dividerColor: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", columnBg: "bg-muted/40" },
  todo: { label: "Todo", iconColor: "text-muted-foreground", hoverBg: "hover:bg-accent", dividerColor: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", columnBg: "bg-muted/40" },
  in_progress: { label: "In Progress", iconColor: "text-warning", hoverBg: "hover:bg-warning/10", dividerColor: "bg-warning", badgeBg: "bg-warning", badgeText: "text-white", columnBg: "bg-warning/5" },
  in_review: { label: "In Review", iconColor: "text-success", hoverBg: "hover:bg-success/10", dividerColor: "bg-success", badgeBg: "bg-success", badgeText: "text-white", columnBg: "bg-success/5" },
  done: { label: "Done", iconColor: "text-info", hoverBg: "hover:bg-info/10", dividerColor: "bg-info", badgeBg: "bg-info", badgeText: "text-white", columnBg: "bg-info/5" },
  blocked: { label: "Blocked", iconColor: "text-destructive", hoverBg: "hover:bg-destructive/10", dividerColor: "bg-destructive", badgeBg: "bg-destructive", badgeText: "text-white", columnBg: "bg-destructive/5" },
  cancelled: { label: "Cancelled", iconColor: "text-muted-foreground", hoverBg: "hover:bg-accent", dividerColor: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", columnBg: "bg-muted/40" },
};

const STATUS_LABEL_KEYS: Record<IssueStatus, "backlog" | "todo" | "inProgress" | "inReview" | "done" | "blocked" | "cancelled"> = {
  backlog: "backlog",
  todo: "todo",
  in_progress: "inProgress",
  in_review: "inReview",
  done: "done",
  blocked: "blocked",
  cancelled: "cancelled",
};

const STATUS_LABELS = {
  "en-US": {
    backlog: "Backlog",
    todo: "Todo",
    inProgress: "In Progress",
    inReview: "In Review",
    done: "Done",
    blocked: "Blocked",
    cancelled: "Cancelled",
  },
  "zh-CN": {
    backlog: "待整理",
    todo: "待处理",
    inProgress: "进行中",
    inReview: "评审中",
    done: "已完成",
    blocked: "已阻塞",
    cancelled: "已取消",
  },
} as const;

export function getIssueStatusLabel(status: IssueStatus, locale?: string): string {
  const normalizedLocale = normalizeLocale(locale ?? "zh-CN");
  return STATUS_LABELS[normalizedLocale][STATUS_LABEL_KEYS[status]];
}
