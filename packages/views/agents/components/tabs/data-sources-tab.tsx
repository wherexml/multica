"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { sourceListOptions } from "@multica/core/sources/queries";
import type { Agent } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { DatabaseZap, Loader2 } from "lucide-react";
import { getSourceStatusMeta, transportLabelMap } from "../../../sources/components/utils";

export function DataSourcesTab({
  agent,
  runtimeName,
}: {
  agent: Agent;
  runtimeName?: string;
}) {
  const wsId = useWorkspaceId();
  const { data: sourceList, isLoading } = useQuery(sourceListOptions(wsId));

  const sources = (sourceList?.sources ?? []).filter((source) => source.runtime_id === agent.runtime_id);
  const connectedCount = sources.filter((source) => source.connection_status === "connected").length;
  const blockedCount = sources.filter((source) => source.connection_status !== "connected").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">数据源</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            当前展示这个数字员工所在执行环境下已接入的数据源。
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            执行环境：{runtimeName ?? "未绑定执行环境"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            共 {sources.length} 个
          </Badge>
          <Badge variant="outline" className="rounded-full border-success/20 bg-success/10 text-success">
            已连接 {connectedCount}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            待处理 {blockedCount}
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载数据源...
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <DatabaseZap className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium">当前还没有可用数据源</p>
          <p className="mt-1 text-xs text-muted-foreground">
            先把数据源接到这个执行环境上，这个数字员工才能直接使用。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => {
            const statusMeta = getSourceStatusMeta(source.connection_status);
            const transport = source.mcp?.transport
              ? transportLabelMap[source.mcp.transport] ?? source.mcp.transport
              : "MCP";

            return (
              <div
                key={source.id}
                className="rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                    <DatabaseZap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">{source.name}</div>
                      <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
                        {source.source_type.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className={`rounded-full text-[10px] ${statusMeta.badgeClassName}`}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {transport}
                      {source.auth_state.auth_type !== "none" ? ` · ${source.auth_state.auth_type.toUpperCase()}` : ""}
                      {source.tool_summary ? ` · ${source.tool_summary.total} 个工具` : ""}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground">
                      {source.connection_error || source.last_test_message || "还没有测试结果"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
