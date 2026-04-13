"use client";

import { Cloud, Monitor } from "lucide-react";
import type { Agent, AgentStatus } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { ActorAvatar } from "../../common/actor-avatar";
import { statusConfig } from "../config";

type AgentDomainMeta = {
  label: string;
  badgeClassName: string;
  capabilities: boolean[];
};

const agentDomainMetaList: Array<{
  label: string;
  keywords: string[];
  badgeClassName: string;
  capabilities: boolean[];
}> = [
  {
    label: "控制塔",
    keywords: ["控制塔", "告警", "异常"],
    badgeClassName: "border-info/20 bg-info/10 text-info",
    capabilities: [true, true, true, false, true],
  },
  {
    label: "采购",
    keywords: ["采购"],
    badgeClassName: "border-info/20 bg-info/10 text-info",
    capabilities: [true, false, true, true, false],
  },
  {
    label: "库存",
    keywords: ["库存", "补货"],
    badgeClassName: "border-success/20 bg-success/10 text-success",
    capabilities: [true, true, true, false, true],
  },
  {
    label: "调拨",
    keywords: ["调拨", "仓间", "物流"],
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
    capabilities: [true, true, true, true, false],
  },
  {
    label: "供应商",
    keywords: ["供应商"],
    badgeClassName: "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-200",
    capabilities: [true, false, true, false, true],
  },
  {
    label: "预测",
    keywords: ["预测", "需求"],
    badgeClassName: "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-200",
    capabilities: [true, true, true, false, false],
  },
  {
    label: "治理",
    keywords: ["治理", "审批", "规则", "边界", "风险"],
    badgeClassName: "border-destructive/20 bg-destructive/10 text-destructive",
    capabilities: [true, false, false, false, true],
  },
  {
    label: "供应链",
    keywords: ["供应链"],
    badgeClassName: "border-info/20 bg-info/10 text-info",
    capabilities: [true, true, true, false, true],
  },
];

const generalAgentDomainMeta: AgentDomainMeta = {
  label: "通用",
  badgeClassName: "border-border bg-muted text-muted-foreground",
  capabilities: [true, false, true, false, false],
};

export function getAgentDomainMeta(description: string | null | undefined): AgentDomainMeta {
  const normalizedDescription = description?.trim() ?? "";

  if (!normalizedDescription) {
    return generalAgentDomainMeta;
  }

  return (
    agentDomainMetaList.find(({ keywords }) =>
      keywords.some((keyword) => normalizedDescription.includes(keyword)),
    ) ?? generalAgentDomainMeta
  );
}

export function getAgentStatusLabel(status: AgentStatus, isArchived: boolean): string {
  if (isArchived) return "已归档";
  return status === "offline" ? "离线" : "在线";
}

export function AgentListItem({
  agent,
  isSelected,
  onClick,
}: {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const st = statusConfig[agent.status];
  const isArchived = !!agent.archived_at;
  const domainMeta = getAgentDomainMeta(`${agent.name} ${agent.description ?? ""}`);
  const statusLabel = getAgentStatusLabel(agent.status, isArchived);
  const summary = agent.description?.trim() || "暂未设置职责说明";
  const skillCountLabel = agent.skills.length > 0 ? `已绑定 ${agent.skills.length} 个技能包` : "未绑定技能包";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <ActorAvatar actorType="agent" actorId={agent.id} size={32} className={`rounded-lg ${isArchived ? "opacity-50 grayscale" : ""}`} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`min-w-0 truncate text-sm font-medium ${isArchived ? "text-muted-foreground" : ""}`}>{agent.name}</span>
          <Badge
            variant="outline"
            className={`h-4 shrink-0 rounded-full px-1.5 text-[10px] ${domainMeta.badgeClassName}`}
          >
            {domainMeta.label}
          </Badge>
          {agent.runtime_mode === "cloud" ? (
            <Cloud className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <Monitor className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {summary}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {isArchived ? (
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          ) : (
            <>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              <span className={`text-xs ${st.color}`}>{statusLabel}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{skillCountLabel}</span>
        </div>
      </div>
    </button>
  );
}
