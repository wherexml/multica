"use client";

import { t } from "@multica/core/platform";
import type { Issue } from "@multica/core/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { StatusIcon } from "../../issues/components";

const statusLabelMap = {
  backlog: "待梳理",
  todo: "待处理",
  in_progress: "进行中",
  in_review: "待复核",
  done: "已完成",
  blocked: "已阻塞",
  cancelled: "已取消",
} as const;

interface InboxTodosSectionProps {
  issues: Issue[];
  isLoading: boolean;
  onOpenIssue: (issueId: string) => void;
}

export function InboxTodosSection({
  issues,
  isLoading,
  onOpenIssue,
}: InboxTodosSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">待办</h2>
        <p className="text-xs text-muted-foreground">
          展示分配给你的重点 {t("issue")}，便于快速进入处理。
        </p>
      </div>

      {isLoading ? (
        <Card size="sm">
          <CardContent className="space-y-3 pt-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : issues.length === 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">当前没有待办</CardTitle>
            <CardDescription>分配给你的 {t("issue")} 会出现在这里。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card size="sm">
          <CardContent className="space-y-2 pt-3">
            {issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => onOpenIssue(issue.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{issue.identifier}</span>
                    <span>{statusLabelMap[issue.status]}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {issue.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusIcon status={issue.status} className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">打开</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
