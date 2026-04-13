"use client";

import { useMemo, useState } from "react";
import { t } from "@multica/core/platform";
import type { DecisionCase, InboxItem, Issue } from "@multica/core/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { InboxListItem } from "./inbox-list-item";
import { InboxAlertsSection } from "./inbox-alerts-section";
import { InboxTodosSection } from "./inbox-todos-section";
import {
  getDashboardStats,
  getRecentActivityItems,
  getTodoItems,
  type AlertFilters,
} from "./inbox-dashboard-helpers";

interface InboxDashboardProps {
  inboxItems: InboxItem[];
  myIssues: Issue[];
  decisions: DecisionCase[];
  inboxLoading: boolean;
  todosLoading: boolean;
  decisionsLoading: boolean;
  selectedKey: string;
  onSelectItem: (item: InboxItem) => void;
  onArchiveItem: (id: string) => void;
  onCreateDecision: () => void;
  onOpenIssue: (issueId: string) => void;
}

export function InboxDashboard({
  inboxItems,
  myIssues,
  decisions,
  inboxLoading,
  todosLoading,
  decisionsLoading,
  selectedKey,
  onSelectItem,
  onArchiveItem,
  onCreateDecision,
  onOpenIssue,
}: InboxDashboardProps) {
  const [alertFilters, setAlertFilters] = useState<AlertFilters>({
    domain: "all",
    riskLevel: "all",
  });

  const stats = useMemo(
    () =>
      getDashboardStats({
        inboxItems,
        myIssues,
        decisions,
      }),
    [decisions, inboxItems, myIssues],
  );
  const recentItems = useMemo(() => getRecentActivityItems(inboxItems), [inboxItems]);
  const todoItems = useMemo(() => getTodoItems(myIssues), [myIssues]);

  const statCards = [
    {
      key: "todos",
      label: "待办",
      description: "分配给我的待处理事项",
      value: stats.todos,
    },
    {
      key: "alerts",
      label: "异常告警",
      description: "未读且需要关注的告警",
      value: stats.alerts,
    },
    {
      key: "approval",
      label: "待审批",
      description: `仍待拍板的${t("decision")}`,
      value: stats.pendingApproval,
    },
    {
      key: "active-decisions",
      label: "在途决策",
      description: "仍在推进中的决策事项",
      value: stats.activeDecisions,
    },
  ];

  return (
    <div className="space-y-6 px-4 py-4">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">工作总览</h2>
          <p className="text-xs text-muted-foreground">
            先看待办、风险和审批，再进入具体的 {t("issue")} 处理。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {statCards.map((card) => (
            <Card key={card.key} size="sm">
              <CardHeader className="gap-1">
                <CardDescription>{card.label}</CardDescription>
                {inboxLoading || todosLoading || decisionsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {card.value}
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {card.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <InboxAlertsSection
        inboxItems={inboxItems}
        decisions={decisions}
        filters={alertFilters}
        isLoading={inboxLoading || decisionsLoading}
        onFiltersChange={setAlertFilters}
        onSelectItem={onSelectItem}
        onCreateDecision={onCreateDecision}
      />

      <InboxTodosSection
        issues={todoItems}
        isLoading={todosLoading}
        onOpenIssue={onOpenIssue}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">最近动态</h2>
          <p className="text-xs text-muted-foreground">
            保留原有通知流，便于继续查看已读、归档和上下文详情。
          </p>
        </div>

        {inboxLoading ? (
          <Card size="sm">
            <CardContent className="space-y-3 pt-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-1 py-1">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : recentItems.length === 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">当前没有动态</CardTitle>
              <CardDescription>新的通知会自动出现在这里。</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card size="sm" className="overflow-hidden">
            <CardContent className="px-0 pt-0">
              {recentItems.map((item) => (
                <InboxListItem
                  key={item.id}
                  item={item}
                  isSelected={(item.issue_id ?? item.id) === selectedKey}
                  onClick={() => onSelectItem(item)}
                  onArchive={() => onArchiveItem(item.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
