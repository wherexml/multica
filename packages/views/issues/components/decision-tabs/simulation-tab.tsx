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
  DecisionTabLayout,
  formatDecisionDateTime,
  useDecisionDetail,
} from "./shared";

export function SimulationTab({ issueId }: { issueId: string }) {
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
      title="场景仿真"
      description="这里会对比不同执行方案的收益、成本和风险，支持快速比较。"
      decision={decision}
    >
      {recommendation ? (
        <Card>
          <CardHeader>
            <CardTitle>当前最佳候选</CardTitle>
            <CardDescription>最近一次推荐结果已经给出候选方案，可作为仿真入口的占位展示。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{recommendation.title}</p>
            <p className="text-sm text-muted-foreground">{recommendation.expected_impact}</p>
            <p className="text-xs text-muted-foreground">
              最近更新时间：{formatDecisionDateTime(recommendation.created_at)}
            </p>
          </CardContent>
        </Card>
      ) : null}
      <DecisionEmptyState
        title="暂无场景仿真结果"
        description="还没有可比较的方案卡片。"
        hint="后续会在这里展示多个 scenario 的成本、收益、风险对比，以及推荐排序。"
      />
    </DecisionTabLayout>
  );
}
