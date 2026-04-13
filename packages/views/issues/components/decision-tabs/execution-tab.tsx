"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import {
  DecisionEmptyState,
  DecisionErrorState,
  DecisionLoadingState,
  DecisionStatusBadge,
  DecisionTabLayout,
  EXECUTION_STATUS_LABELS,
  useDecisionDetail,
} from "./shared";

export function ExecutionTab({ issueId }: { issueId: string }) {
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
  const executionStatus = decision?.execution_status ?? "pending";

  return (
    <DecisionTabLayout
      title="动作执行"
      description="用于沉淀执行状态、执行日志和回滚预案。"
      decision={decision}
    >
      <Card>
        <CardHeader>
          <CardTitle>执行状态</CardTitle>
          <CardDescription>执行态直接读取决策单主记录上的 `execution_status`。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <DecisionStatusBadge type="execution" value={executionStatus} />
          <span className="text-sm text-muted-foreground">
            {EXECUTION_STATUS_LABELS[executionStatus] ?? executionStatus}
          </span>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <span className="text-xs text-muted-foreground">执行日志与回滚入口后续会接入 action_run。</span>
          <Button variant="outline" size="sm" disabled>
            <RotateCcw className="mr-1.5 size-4" />
            回滚入口待接入
          </Button>
        </CardFooter>
      </Card>
      <DecisionEmptyState
        title="暂无执行日志"
        description="还没有 action run 记录可展示。"
        hint="后续会在这里展示执行日志、任务结果、失败原因以及回滚动作。"
      />
    </DecisionTabLayout>
  );
}
