import type { IssuePriority } from "../../types";
import { normalizeLocale } from "../../platform/lexicon";

export const PRIORITY_ORDER: IssuePriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; bars: number; color: string; badgeBg: string; badgeText: string }
> = {
  urgent: { label: "Urgent", bars: 4, color: "text-destructive", badgeBg: "bg-priority", badgeText: "text-white" },
  high: { label: "High", bars: 3, color: "text-warning", badgeBg: "bg-priority/80", badgeText: "text-white" },
  medium: { label: "Medium", bars: 2, color: "text-warning", badgeBg: "bg-priority/15", badgeText: "text-priority" },
  low: { label: "Low", bars: 1, color: "text-info", badgeBg: "bg-priority/10", badgeText: "text-priority" },
  none: { label: "No priority", bars: 0, color: "text-muted-foreground", badgeBg: "bg-muted", badgeText: "text-muted-foreground" },
};

const PRIORITY_LABEL_KEYS: Record<IssuePriority, "urgent" | "high" | "medium" | "low" | "none"> = {
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
  none: "none",
};

const PRIORITY_LABELS = {
  "en-US": {
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
    none: "No priority",
  },
  "zh-CN": {
    urgent: "紧急",
    high: "高",
    medium: "中",
    low: "低",
    none: "无优先级",
  },
} as const;

export function getIssuePriorityLabel(priority: IssuePriority, locale?: string): string {
  const normalizedLocale = normalizeLocale(locale ?? "zh-CN");
  return PRIORITY_LABELS[normalizedLocale][PRIORITY_LABEL_KEYS[priority]];
}
