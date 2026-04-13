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
  DecisionMetricCard,
  DecisionTabLayout,
  formatDecisionDateTime,
  useDecisionDetail,
} from "./shared";

export function RecommendationTab({ issueId }: { issueId: string }) {
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
  const recommendation = decision?.latest_recommendation;

  return (
    <DecisionTabLayout
      title="推荐方案"
      description="用于展示系统最终建议的方案、预期收益和关键理由。"
      decision={decision}
    >
      {recommendation ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <DecisionMetricCard label="推荐方案" value={recommendation.title} />
            <DecisionMetricCard label="关联方案 ID" value={recommendation.scenario_option_id || "未关联"} />
            <DecisionMetricCard label="生成时间" value={formatDecisionDateTime(recommendation.created_at)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>推荐理由</CardTitle>
              <CardDescription>当前接口已经返回推荐标题和预期影响，理由正文后续可直接落到这里。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{recommendation.expected_impact}</p>
            </CardContent>
          </Card>
        </>
      ) : (
        <DecisionEmptyState
          title="暂无推荐方案"
          description="系统还没有产出可以执行的推荐结果。"
          hint="接入 `decision_recommendation` 详情后，这里会补齐理由、收益预估和约束说明。"
        />
      )}
    </DecisionTabLayout>
  );
}
