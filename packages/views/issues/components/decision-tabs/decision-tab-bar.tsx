"use client";

import { t } from "@multica/core/platform";
import { Button } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";

export type DecisionTabId =
  | "overview"
  | "snapshots"
  | "diagnosis"
  | "simulation"
  | "recommendation"
  | "approval"
  | "execution"
  | "collaboration";

export interface DecisionTabSpec {
  id: DecisionTabId;
  label: string;
}

const ALL_DECISION_TABS: DecisionTabSpec[] = [
  { id: "overview", label: "概览" },
  { id: "snapshots", label: "指标快照" },
  { id: "diagnosis", label: "诊断分析" },
  { id: "simulation", label: t("simulation") },
  { id: "recommendation", label: t("recommendation") },
  { id: "approval", label: "审批流" },
  { id: "execution", label: t("action") },
  { id: "collaboration", label: "协同记录" },
];

export function getDecisionTabs(hasDecisionMetadata: boolean): DecisionTabSpec[] {
  return hasDecisionMetadata ? ALL_DECISION_TABS : [ALL_DECISION_TABS[0]!];
}

export function DecisionTabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: DecisionTabSpec[];
  activeTab: DecisionTabId;
  onTabChange: (tab: DecisionTabId) => void;
}) {
  return (
    <div className="border-b bg-background/95 px-8">
      <div
        role="tablist"
        aria-label={`${t("issue")}详情标签`}
        className="mx-auto flex max-w-4xl gap-2 overflow-x-auto py-2"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <Button
              key={tab.id}
              type="button"
              role="tab"
              variant="ghost"
              size="sm"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                "shrink-0 rounded-full border px-3 text-sm",
                isActive
                  ? "border-border bg-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border/60 hover:text-foreground",
              )}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
