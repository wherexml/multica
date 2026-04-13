"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { api } from "@multica/core/api";
import { t } from "@multica/core/platform";
import type {
  DecisionDetail,
  DecisionExecutionMode,
  DecisionPhase,
  DecisionRiskLevel,
} from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";
import {
  DecisionExecutionModeIndicator,
  DecisionPhaseIndicator,
  DecisionRiskBadge,
} from "../decision-case-meta";

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: "草拟中",
  pending: "待审批",
  approved: "已批准",
  rejected: "已驳回",
  cancelled: "已取消",
};

export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  pending: "未执行",
  running: "执行中",
  completed: "已完成",
  failed: "执行失败",
  rolled_back: "已回滚",
};

const APPROVAL_STATUS_STYLES: Record<string, string> = {
  draft: "border-muted-foreground/20 bg-muted text-muted-foreground",
  pending: "border-warning/20 bg-warning/10 text-warning",
  approved: "border-success/20 bg-success/10 text-success",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
  cancelled: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  pending: "border-muted-foreground/20 bg-muted text-muted-foreground",
  running: "border-info/20 bg-info/10 text-info",
  completed: "border-success/20 bg-success/10 text-success",
  failed: "border-destructive/20 bg-destructive/10 text-destructive",
  rolled_back: "border-warning/20 bg-warning/10 text-warning",
};

export function useDecisionDetail(issueId: string, enabled = true) {
  return useQuery({
    queryKey: ["decisions", issueId, "detail"] as const,
    queryFn: () => api.getDecision(issueId),
    enabled,
  });
}

export function formatDecisionDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DecisionTabLayout({
  title,
  description,
  decision,
  children,
}: {
  title: string;
  description: string;
  decision?: DecisionDetail | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {decision ? (
          <div className="flex flex-wrap items-center gap-2">
            <DecisionPhaseIndicator phase={decision.phase as DecisionPhase} />
            <DecisionRiskBadge riskLevel={decision.risk_level as DecisionRiskLevel} />
            <DecisionExecutionModeIndicator mode={decision.execution_mode as DecisionExecutionMode} />
          </div>
        ) : null}
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

export function DecisionLoadingState() {
  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <div className="space-y-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}

export function DecisionErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <DecisionTabLayout
      title="数据加载失败"
      description="决策详情暂时无法读取，请稍后重试。"
    >
      <Card className="border-destructive/20">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-destructive/10 p-2 text-destructive">
              <AlertCircle className="size-4" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">当前标签页没有拿到最新决策数据</p>
              <p className="text-sm text-muted-foreground">{message ?? "请确认后端接口可用，或稍后刷新页面。"}</p>
            </div>
          </div>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-1.5 size-4" />
              重新加载
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </DecisionTabLayout>
  );
}

export function DecisionEmptyState({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function DecisionMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-lg font-semibold">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function DecisionStatusBadge({
  value,
  type,
}: {
  value: string;
  type: "approval" | "execution";
}) {
  const labels = type === "approval" ? APPROVAL_STATUS_LABELS : EXECUTION_STATUS_LABELS;
  const styles = type === "approval" ? APPROVAL_STATUS_STYLES : EXECUTION_STATUS_STYLES;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        styles[value] ?? "border-muted-foreground/20 bg-muted text-muted-foreground",
      )}
    >
      {labels[value] ?? value}
    </Badge>
  );
}

export function DecisionMetaSummary({
  decision,
  className,
}: {
  decision: DecisionDetail;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("decision")}概况</CardTitle>
        <CardDescription>当前决策单已接入的核心元信息。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <DecisionMetricCard label={t("decisionType")} value={decision.decision_type || "未设置"} />
        <DecisionMetricCard label={t("objectType")} value={decision.object_type || "未设置"} />
        <DecisionMetricCard label={t("phase")} value={decision.phase || "未设置"} />
      </CardContent>
    </Card>
  );
}
