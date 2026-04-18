"use client";

import { Cloud, Monitor } from "lucide-react";
import type { Agent } from "@multica/core/types";
import { AgentAvatar } from "../../common/agent-avatar";
import { getAgentStatusLabel } from "./agent-meta";
import { getAgentPresenceConfig } from "../config";

export function AgentListItem({
  agent,
  isSelected,
  onClick,
}: {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const st = getAgentPresenceConfig(agent.status);
  const isArchived = !!agent.archived_at;
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
      <AgentAvatar
        agent={agent}
        size={32}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`min-w-0 truncate text-sm font-medium ${isArchived ? "text-muted-foreground" : ""}`}>{agent.name}</span>
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
