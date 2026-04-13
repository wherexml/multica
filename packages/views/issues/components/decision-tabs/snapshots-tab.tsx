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

export function SnapshotsTab({ issueId }: { issueId: string }) {
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
  const snapshot = decision?.latest_snapshot;

  return (
    <DecisionTabLayout
      title="指标快照"
      description="用于沉淀关键上下文快照，后续会承接成本、风险、库存和业务指标。"
      decision={decision}
    >
      {snapshot ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <DecisionMetricCard label="快照来源" value={snapshot.source || "未命名来源"} />
            <DecisionMetricCard label="来源引用" value={snapshot.source_ref || "暂无引用"} />
            <DecisionMetricCard label="抓取时间" value={formatDecisionDateTime(snapshot.captured_at)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>指标卡占位区</CardTitle>
              <CardDescription>快照记录已到位，下一步会把 metrics 明细接进这里。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                这里会继续展示库存、毛利、服务等级、告警数量等可直接支撑拍板的指标卡。
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <DecisionEmptyState
          title="暂无指标快照"
          description="决策上下文快照还没有生成。"
          hint="当 `decision_context_snapshot` 接入后，这里会优先展示最近一次快照及其关键指标卡。"
        />
      )}
    </DecisionTabLayout>
  );
}
