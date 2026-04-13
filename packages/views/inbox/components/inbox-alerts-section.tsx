"use client";

import { useMemo } from "react";
import { t } from "@multica/core/platform";
import { useActorName } from "@multica/core/workspace/hooks";
import type { DecisionCase, InboxItem } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@multica/ui/components/ui/select";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";

import { typeLabels } from "./inbox-detail-label";
import { timeAgo } from "./inbox-list-item";
import {
  getAlertFilterOptions,
  getAlertItems,
  getDecisionByIssueId,
  type AlertFilters,
} from "./inbox-dashboard-helpers";

const severityLabelMap = {
  action_required: "需立即处理",
  attention: "重点关注",
  info: "信息",
} as const;

const severityClassMap = {
  action_required: "border-destructive/20 bg-destructive/10 text-destructive",
  attention: "border-warning/20 bg-warning/10 text-warning",
  info: "border-border bg-muted text-muted-foreground",
} as const;

const riskLevelLabelMap: Record<string, string> = {
  critical: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

function formatDecisionValue(value: string): string {
  if (!value) return "未标注";
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRiskLevel(value: string): string {
  return riskLevelLabelMap[value] ?? formatDecisionValue(value);
}

function getAlertSource(item: InboxItem, decision: DecisionCase | undefined, getActorName: (type: string, id: string) => string) {
  if (item.actor_type && item.actor_id) {
    return getActorName(item.actor_type, item.actor_id);
  }

  if (decision?.domain) {
    return formatDecisionValue(decision.domain);
  }

  return "系统";
}

interface InboxAlertsSectionProps {
  inboxItems: InboxItem[];
  decisions: DecisionCase[];
  filters: AlertFilters;
  isLoading: boolean;
  onFiltersChange: (filters: AlertFilters) => void;
  onSelectItem: (item: InboxItem) => void;
  onCreateDecision: () => void;
}

export function InboxAlertsSection({
  inboxItems,
  decisions,
  filters,
  isLoading,
  onFiltersChange,
  onSelectItem,
  onCreateDecision,
}: InboxAlertsSectionProps) {
  const { getActorName } = useActorName();
  const decisionByIssueId = useMemo(() => getDecisionByIssueId(decisions), [decisions]);
  const filterOptions = useMemo(
    () => getAlertFilterOptions(inboxItems, decisions),
    [decisions, inboxItems],
  );
  const alertItems = useMemo(
    () => getAlertItems(inboxItems, decisions, filters),
    [decisions, filters, inboxItems],
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">异常告警</h2>
          <p className="text-xs text-muted-foreground">
            聚焦需要尽快处理的风险信号，并支持一键生成 {t("issue")}。
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={filters.domain}
            onValueChange={(domain) =>
              onFiltersChange({ ...filters, domain: domain ?? "all" })
            }
          >
            <SelectTrigger size="sm" className="w-[132px]">
              <SelectValue placeholder="业务域" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">全部业务域</SelectItem>
              {filterOptions.domains
                .filter((domain): domain is string => Boolean(domain))
                .map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {formatDecisionValue(domain)}
                </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.riskLevel}
            onValueChange={(riskLevel) =>
              onFiltersChange({ ...filters, riskLevel: riskLevel ?? "all" })
            }
          >
            <SelectTrigger size="sm" className="w-[118px]">
              <SelectValue placeholder={t("riskLevel")} />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">全部风险</SelectItem>
              {filterOptions.riskLevels
                .filter((riskLevel): riskLevel is string => Boolean(riskLevel))
                .map((riskLevel) => (
                <SelectItem key={riskLevel} value={riskLevel}>
                  {formatRiskLevel(riskLevel)}
                </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} size="sm">
              <CardHeader className="gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-9 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : alertItems.length === 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">当前没有需要升级处理的告警</CardTitle>
            <CardDescription>新的高风险动态会自动出现在这里。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {alertItems.map((item) => {
            const decision = item.issue_id ? decisionByIssueId.get(item.issue_id) : undefined;
            const preview = item.body?.trim() || typeLabels[item.type];
            const source = getAlertSource(item, decision, getActorName);

            return (
              <Card key={item.id} size="sm" className="overflow-visible">
                <CardContent className="pt-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="flex-1 space-y-3 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("rounded-full", severityClassMap[item.severity])}
                        >
                          {severityLabelMap[item.severity]}
                        </Badge>
                        {decision?.risk_level && (
                          <Badge variant="outline" className="rounded-full text-muted-foreground">
                            {formatRiskLevel(decision.risk_level)}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-medium leading-5 text-foreground">
                          {item.title}
                        </h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {preview}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{timeAgo(item.created_at)}</span>
                        <span>来源：{source}</span>
                        {decision?.domain && (
                          <span>业务域：{formatDecisionValue(decision.domain)}</span>
                        )}
                      </div>
                    </button>

                    <Button
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateDecision();
                      }}
                      className="shrink-0"
                    >
                      生成{t("issue")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
