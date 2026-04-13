"use client";

import { Bot, Hand } from "lucide-react";
import type {
  DecisionExecutionMode,
  DecisionPhase,
  DecisionRiskLevel,
} from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { cn } from "@multica/ui/lib/utils";

export const DECISION_PHASE_LABELS: Record<DecisionPhase, string> = {
  identified: "已识别",
  diagnosing: "诊断中",
  simulating: "仿真中",
  recommending: "建议中",
  awaiting_approval: "待审批",
  approved: "已批准",
  executing: "执行中",
  monitoring: "监控中",
  closed: "已关闭",
};

export const DECISION_RISK_LEVEL_LABELS: Record<DecisionRiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "紧急风险",
};

export const DECISION_EXECUTION_MODE_LABELS: Record<DecisionExecutionMode, string> = {
  manual: "人工执行",
  semi_auto: "半自动",
  auto: "全自动",
};

const DECISION_RISK_LEVEL_STYLES: Record<DecisionRiskLevel, string> = {
  low: "border-success/20 bg-success/10 text-success",
  medium: "border-warning/20 bg-warning/10 text-warning",
  high: "border-priority/20 bg-priority/10 text-priority",
  critical: "border-destructive/20 bg-destructive/10 text-destructive",
};

export function DecisionExecutionModeIcon({
  mode,
  className,
}: {
  mode: DecisionExecutionMode;
  className?: string;
}) {
  const sharedClassName = cn("size-3.5 shrink-0", className);

  if (mode === "manual") {
    return <Hand className={sharedClassName} />;
  }

  if (mode === "semi_auto") {
    return <Bot className={cn(sharedClassName, "opacity-70")} />;
  }

  return <Bot className={sharedClassName} />;
}

export function DecisionRiskBadge({
  riskLevel,
  className,
}: {
  riskLevel: DecisionRiskLevel;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-full px-1.5 py-0 text-[11px] font-medium",
        DECISION_RISK_LEVEL_STYLES[riskLevel],
        className,
      )}
    >
      {DECISION_RISK_LEVEL_LABELS[riskLevel]}
    </Badge>
  );
}

export function DecisionPhaseIndicator({
  phase,
  className,
}: {
  phase: DecisionPhase;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current/50" />
      <span>{DECISION_PHASE_LABELS[phase]}</span>
    </span>
  );
}

export function DecisionExecutionModeIndicator({
  mode,
  className,
}: {
  mode: DecisionExecutionMode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
        className,
      )}
      title={DECISION_EXECUTION_MODE_LABELS[mode]}
    >
      <DecisionExecutionModeIcon mode={mode} />
      <span>{DECISION_EXECUTION_MODE_LABELS[mode]}</span>
    </span>
  );
}
