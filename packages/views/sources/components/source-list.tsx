"use client";

import { DatabaseZap, Plus } from "lucide-react";
import type { AgentRuntime, Source } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import { formatLastTested, getSourceStatusMeta, transportLabelMap } from "./utils";

function SourceListItem({
  source,
  runtimeName,
  isSelected,
  onClick,
}: {
  source: Source;
  runtimeName: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusMeta = getSourceStatusMeta(source.connection_status);
  const transport = source.mcp?.transport ? transportLabelMap[source.mcp.transport] ?? source.mcp.transport : "MCP";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
        <DatabaseZap className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-medium">{source.name}</div>
          <Badge variant="outline" className="h-4 shrink-0 rounded-full px-1.5 text-[10px] border-info/20 bg-info/10 text-info">
            MCP
          </Badge>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{runtimeName}</span>
          <span>·</span>
          <span className="shrink-0">{transport}</span>
          <span>·</span>
          <span className="truncate">{formatLastTested(source.last_tested_at)}</span>
        </div>
      </div>
      <div className="shrink-0">
        <Badge variant="outline" className={`rounded-full text-[10px] ${statusMeta.badgeClassName}`}>
          {statusMeta.label}
        </Badge>
      </div>
    </button>
  );
}

export function SourceList({
  sources,
  runtimes,
  selectedId,
  onSelect,
  onCreate,
}: {
  sources: Source[];
  runtimes: AgentRuntime[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const runtimeNameById = new Map(runtimes.map((runtime) => [runtime.id, runtime.name]));

  return (
    <div className="h-full overflow-y-auto border-r">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">数据源</h1>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          连接数据源
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <DatabaseZap className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">还没有数据源</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            把 MCP 服务接进来后，这里会显示连接状态、测试结果和绑定的执行环境。
          </p>
          <Button className="mt-4 gap-1.5" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            连接第一个数据源
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {sources.map((source) => (
            <SourceListItem
              key={source.id}
              source={source}
              runtimeName={runtimeNameById.get(source.runtime_id) ?? "未绑定执行环境"}
              isSelected={source.id === selectedId}
              onClick={() => onSelect(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
