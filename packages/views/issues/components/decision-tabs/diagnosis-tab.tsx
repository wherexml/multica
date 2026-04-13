"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import {
  DecisionEmptyState,
  DecisionErrorState,
  DecisionLoadingState,
  DecisionMetaSummary,
  DecisionTabLayout,
  useDecisionDetail,
} from "./shared";

export function DiagnosisTab({ issueId }: { issueId: string }) {
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

  return (
    <DecisionTabLayout
      title="诊断分析"
      description="这里会汇总 Agent 的诊断结论、证据链和诊断日志。"
      decision={decision}
    >
      {decision ? <DecisionMetaSummary decision={decision} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>诊断状态</CardTitle>
          <CardDescription>当前阶段和风险等级已经就绪，诊断内容仍待接入。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            后续会把异常根因、影响范围、证据引用和 Agent 诊断日志统一落在这里，方便复盘和审批。
          </p>
        </CardContent>
      </Card>
      <DecisionEmptyState
        title="暂无诊断日志"
        description="诊断过程还没有输出结构化结果。"
        hint="待 Agent 诊断结果接入后，这里会展示诊断状态、关键发现和原始日志。"
      />
    </DecisionTabLayout>
  );
}
