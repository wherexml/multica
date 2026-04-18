"use client";

import { useState } from "react";
import {
  Cloud,
  Monitor,
  FileText,
  DatabaseZap,
  BookOpenText,
  ListTodo,
  Trash2,
  AlertCircle,
  MoreHorizontal,
  Settings,
  Clock,
} from "lucide-react";
import type { Agent, RuntimeDevice } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@multica/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { Button } from "@multica/ui/components/ui/button";
import { getAgentPresenceConfig } from "../config";
import { AgentAvatar } from "../../common/agent-avatar";
import { getAgentDomainMeta, getAgentStatusLabel } from "./agent-meta";
import { DataSourcesTab } from "./tabs/data-sources-tab";
import { InstructionsTab } from "./tabs/instructions-tab";
import { SkillsTab } from "./tabs/skills-tab";
import { TriggersTab } from "./tabs/triggers-tab";
import { TasksTab } from "./tabs/tasks-tab";
import { SettingsTab } from "./tabs/settings-tab";

function getRuntimeDevice(agent: Agent, runtimes: RuntimeDevice[]): RuntimeDevice | undefined {
  return runtimes.find((runtime) => runtime.id === agent.runtime_id);
}

type DetailTab = "instructions" | "data-sources" | "skills" | "triggers" | "tasks" | "settings";

const capabilityLabels = ["数据分析", "仿真建模", "方案推荐", "执行操作", "风险评估"] as const;

const detailTabs: { id: DetailTab; label: string; icon: typeof FileText }[] = [
  { id: "instructions", label: "说明", icon: FileText },
  { id: "data-sources", label: "数据源", icon: DatabaseZap },
  { id: "skills", label: "技能", icon: BookOpenText },
  { id: "triggers", label: "触发器", icon: Clock },
  { id: "tasks", label: "任务", icon: ListTodo },
  { id: "settings", label: "设置", icon: Settings },
];

export function AgentDetail({
  agent,
  runtimes,
  onUpdate,
  onArchive,
  onRestore,
}: {
  agent: Agent;
  runtimes: RuntimeDevice[];
  onUpdate: (id: string, data: Partial<Agent>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) {
  const st = getAgentPresenceConfig(agent.status);
  const runtimeDevice = getRuntimeDevice(agent, runtimes);
  const [activeTab, setActiveTab] = useState<DetailTab>("instructions");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isArchived = !!agent.archived_at;
  const statusLabel = getAgentStatusLabel(agent.status, isArchived);
  const domainMeta = getAgentDomainMeta(`${agent.name} ${agent.description ?? ""}`);

  return (
    <div className="flex h-full flex-col">
      {/* Archive Banner */}
      {isArchived && (
        <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-xs text-muted-foreground border-b">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">该数字员工已归档，不能再被指派或提及。</span>
          <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onRestore(agent.id)}>
            恢复
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <AgentAvatar agent={agent} size={28} className="rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={`text-sm font-semibold truncate ${isArchived ? "text-muted-foreground" : ""}`}>{agent.name}</h2>
            {isArchived ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {statusLabel}
              </span>
            ) : (
              <span className={`flex items-center gap-1.5 text-xs ${st.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {statusLabel}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {agent.runtime_mode === "cloud" ? (
                <Cloud className="h-3 w-3" />
              ) : (
                <Monitor className="h-3 w-3" />
              )}
              {runtimeDevice?.name ?? (agent.runtime_mode === "cloud" ? "云端" : "本地")}
            </span>
          </div>
        </div>
        {!isArchived && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" />
              }
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmArchive(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                归档数字员工
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="border-b px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h3 className="text-sm font-semibold">职责说明</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {agent.description?.trim() || "这个数字员工还没有补充职责说明。"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">已绑定技能包</h3>
            {agent.skills.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {agent.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">暂未绑定技能包</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="pt-4">
            <h3 className="text-sm font-semibold">能力矩阵</h3>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {capabilityLabels.map((label, index) => {
            const isEnabled = domainMeta.capabilities[index] ?? false;

            return (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
              >
                <span className="text-xs text-foreground">{label}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isEnabled ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-6">
        {detailTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "instructions" && (
          <InstructionsTab
            agent={agent}
            onSave={(instructions) => onUpdate(agent.id, { instructions })}
          />
        )}
        {activeTab === "data-sources" && (
          <DataSourcesTab
            agent={agent}
            runtimeName={runtimeDevice?.name}
          />
        )}
        {activeTab === "skills" && (
          <SkillsTab agent={agent} />
        )}
        {activeTab === "triggers" && (
          <TriggersTab agent={agent} />
        )}
        {activeTab === "tasks" && <TasksTab agent={agent} />}
        {activeTab === "settings" && (
          <SettingsTab
            agent={agent}
            runtimes={runtimes}
            onSave={(updates) => onUpdate(agent.id, updates)}
          />
        )}
      </div>

      {/* Archive Confirmation */}
      {confirmArchive && (
        <Dialog open onOpenChange={(v) => { if (!v) setConfirmArchive(false); }}>
          <DialogContent className="max-w-sm" showCloseButton={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <DialogHeader className="flex-1 gap-1">
                <DialogTitle className="text-sm font-semibold">归档这个数字员工？</DialogTitle>
                <DialogDescription className="text-xs">
                  &quot;{agent.name}&quot; 会被归档。之后不能再被指派或提及，但历史记录会保留，后续也可以恢复。
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmArchive(false);
                  onArchive(agent.id);
                }}
              >
                归档
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
