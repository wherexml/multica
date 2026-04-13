"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import {
  APPROVAL_STATUS_LABELS,
  DecisionEmptyState,
  DecisionErrorState,
  DecisionLoadingState,
  DecisionStatusBadge,
  DecisionTabLayout,
  formatDecisionDateTime,
  useDecisionDetail,
} from "./shared";

const APPROVAL_FLOW_STEPS = [
  { id: "draft", label: "草拟决策单" },
  { id: "pending", label: "提交审批" },
  { id: "approved", label: "审批结果" },
] as const;

function getApprovalStepState(stepId: string, status: string) {
  if (status === "draft") {
    return stepId === "draft" ? "current" : "pending";
  }

  if (status === "pending") {
    if (stepId === "draft") return "done";
    return stepId === "pending" ? "current" : "pending";
  }

  if (stepId === "approved") return "current";
  return "done";
}

export function ApprovalTab({ issueId }: { issueId: string }) {
  const query = useDecisionDetail(issueId);

  if (query.isLoading) return <DecisionLoadingState />;
  if (query.isError) {
    return (
      <DecisionErrorState
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const decision = query.data;
  const latestApproval = decision?.latest_approval;
  const approvalStatus = decision?.approval_status ?? "draft";

  return (
    <DecisionTabLayout
      title="审批流"
      description="用于展示当前审批状态、审批链路和最近一次审批动作。"
      decision={decision}
    >
      <Card>
        <CardHeader>
          <CardTitle>当前审批状态</CardTitle>
          <CardDescription>直接读取决策单主记录上的 `approval_status`。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <DecisionStatusBadge type="approval" value={approvalStatus} />
            <span className="text-sm text-muted-foreground">
              {APPROVAL_STATUS_LABELS[approvalStatus] ?? approvalStatus}
            </span>
          </div>
          <div className="space-y-3">
            {APPROVAL_FLOW_STEPS.map((step) => {
              const stepState = getApprovalStepState(step.id, approvalStatus);
              const stepClassName =
                stepState === "done"
                  ? "bg-success"
                  : stepState === "current"
                    ? "bg-warning"
                    : "bg-muted-foreground/30";

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <span className={`size-2 rounded-full ${stepClassName}`} />
                  <span className="text-sm">{step.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {latestApproval ? (
        <Card>
          <CardHeader>
            <CardTitle>最近一次审批动作</CardTitle>
            <CardDescription>当前详情接口只返回最近一条审批摘要，后续会补完整审批链。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <DecisionStatusBadge type="approval" value={latestApproval.status} />
              <span className="text-muted-foreground">
                {latestApproval.approver_type} · {latestApproval.approver_id}
              </span>
            </div>
            <p className="text-muted-foreground">{latestApproval.comment || "暂无审批备注"}</p>
            <p className="text-xs text-muted-foreground">
              更新时间：{formatDecisionDateTime(latestApproval.updated_at)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DecisionEmptyState
          title="暂无审批记录"
          description="审批流已经预留完成，但审批动作还没有落库。"
          hint="后续会在这里展示完整审批链、每一步审批人和审批备注。"
        />
      )}
    </DecisionTabLayout>
  );
}
