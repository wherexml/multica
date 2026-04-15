import { useEffect, useState } from "react";
import { Server, ArrowUpCircle, ChevronDown, Check, Download, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AgentRuntime, MemberWithUser } from "@multica/core/types";
import { useWorkspaceId } from "@multica/core/hooks";
import { memberListOptions } from "@multica/core/workspace/queries";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button, buttonVariants } from "@multica/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@multica/ui/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@multica/ui/components/ui/dropdown-menu";
import { ActorAvatar } from "../../common/actor-avatar";
import { ProviderLogo } from "./provider-logo";

type RuntimeFilter = "mine" | "all";

type RuntimeExecutor = {
  executor_kind?: string;
};

type RuntimeWithExecutor = AgentRuntime & {
  executor?: RuntimeExecutor | null;
};

const executorKindMeta: Record<string, { label: string; badgeClassName: string }> = {
  llm_agent: {
    label: "LLM 智能体",
    badgeClassName: "border-info/20 bg-info/10 text-info",
  },
  sql_runner: {
    label: "SQL 执行器",
    badgeClassName: "border-success/20 bg-success/10 text-success",
  },
  python_worker: {
    label: "Python 工作器",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
  },
  optimizer: {
    label: "优化器",
    badgeClassName: "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-200",
  },
  connector_action: {
    label: "连接器",
    badgeClassName: "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-200",
  },
};

const runtimeModeLabelMap: Record<string, string> = {
  local: "本地",
  cloud: "云端",
};

function getExecutorBadge(runtime: AgentRuntime) {
  const executor = (runtime as RuntimeWithExecutor).executor;

  if (!executor?.executor_kind) {
    return {
      label: "默认",
      badgeClassName: "border-border bg-muted text-muted-foreground",
    };
  }

  return executorKindMeta[executor.executor_kind] ?? {
    label: executor.executor_kind,
    badgeClassName: "border-border bg-muted text-muted-foreground",
  };
}

function getRuntimeModeLabel(mode: string) {
  return runtimeModeLabelMap[mode] ?? mode;
}

function RuntimeListItem({
  runtime,
  isSelected,
  ownerMember,
  hasUpdate,
  onClick,
}: {
  runtime: AgentRuntime;
  isSelected: boolean;
  ownerMember: MemberWithUser | null;
  hasUpdate: boolean;
  onClick: () => void;
}) {
  const executorBadge = getExecutorBadge(runtime);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        <ProviderLogo provider={runtime.provider} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-medium">{runtime.name}</div>
          <Badge
            variant="outline"
            className={`h-4 shrink-0 rounded-full px-1.5 text-[10px] ${executorBadge.badgeClassName}`}
          >
            {executorBadge.label}
          </Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          {ownerMember ? (
            <>
              <ActorAvatar
                actorType="member"
                actorId={ownerMember.user_id}
                size={14}
              />
              <span className="truncate">{ownerMember.name}</span>
            </>
          ) : (
            <span className="truncate">{getRuntimeModeLabel(runtime.runtime_mode)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {hasUpdate && (
          <span title="有可用更新">
            <ArrowUpCircle className="h-3.5 w-3.5 text-info" />
          </span>
        )}
        <div
          className={`h-2 w-2 rounded-full ${
            runtime.status === "online" ? "bg-success" : "bg-muted-foreground/40"
          }`}
        />
      </div>
    </button>
  );
}

export function RuntimeList({
  runtimes,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  updatableIds,
}: {
  runtimes: AgentRuntime[];
  selectedId: string;
  onSelect: (id: string) => void;
  filter: RuntimeFilter;
  onFilterChange: (filter: RuntimeFilter) => void;
  ownerFilter: string | null;
  onOwnerFilterChange: (ownerId: string | null) => void;
  updatableIds?: Set<string>;
}) {
  const [connectHost, setConnectHost] = useState("<部署 IP>");
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));

  useEffect(() => {
    if (window.location.hostname) {
      setConnectHost(window.location.hostname);
    }
  }, []);

  const getOwnerMember = (ownerId: string | null) => {
    if (!ownerId) return null;
    return members.find((m) => m.user_id === ownerId) ?? null;
  };

  // Get unique owners from runtimes for filter dropdown
  const uniqueOwners = filter === "all"
    ? Array.from(new Set(runtimes.map((r) => r.owner_id).filter(Boolean) as string[]))
        .map((id) => members.find((m) => m.user_id === id))
        .filter(Boolean) as MemberWithUser[]
    : [];

  // Count runtimes per owner
  const ownerCounts = new Map<string, number>();
  for (const r of runtimes) {
    if (r.owner_id) ownerCounts.set(r.owner_id, (ownerCounts.get(r.owner_id) ?? 0) + 1);
  }

  // Apply client-side owner filter when in "all" mode
  const filteredRuntimes = filter === "all" && ownerFilter
    ? runtimes.filter((r) => r.owner_id === ownerFilter)
    : runtimes;

  const selectedOwner = ownerFilter ? getOwnerMember(ownerFilter) : null;

  return (
    <div className="overflow-y-auto h-full border-r">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">执行环境</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filteredRuntimes.filter((r) => r.status === "online").length}/
            {filteredRuntimes.length} 在线
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" />
              }
            >
              <Plus className="h-3.5 w-3.5" />
              连接执行环境
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] space-y-3 p-4">
              <div>
                <div className="text-sm font-semibold">连接执行环境</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  执行环境就是实际干活的那台机器。连接方式都一样：下载脚本，在要执行任务的机器上运行。列表里出现“在线”后，就可以把数据源或动作交给它执行。
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium">连接脚本</div>
                  <a
                    href="/connect-runtime.sh"
                    download="connect-runtime.sh"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "h-7 gap-1.5 text-xs",
                    })}
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载连接脚本
                  </a>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  下载后放到要接入的机器上运行。脚本会自动安装缺少的 CLI，探测前后端端口，写入配置，再启动执行环境。
                </p>
                <code className="mt-2 block overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                  bash connect-runtime.sh {connectHost}
                </code>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        {/* Scope toggle */}
        <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          <button
            onClick={() => { onFilterChange("mine"); onOwnerFilterChange(null); }}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === "mine"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            我的
          </button>
          <button
            onClick={() => { onFilterChange("all"); onOwnerFilterChange(null); }}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            全部
          </button>
        </div>

        {/* Owner dropdown (only in All mode with multiple owners) */}
        {filter === "all" && uniqueOwners.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent" />
              }
            >
              {selectedOwner ? (
                <>
                  <ActorAvatar actorType="member" actorId={selectedOwner.user_id} size={16} />
                  <span className="max-w-20 truncate">{selectedOwner.name}</span>
                </>
              ) : (
                <span>负责人</span>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onOwnerFilterChange(null)}
                className="flex items-center justify-between"
              >
                <span className="text-xs">全部负责人</span>
                {!ownerFilter && <Check className="h-3.5 w-3.5 text-foreground" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {uniqueOwners.map((m) => (
                <DropdownMenuItem
                  key={m.user_id}
                  onClick={() => onOwnerFilterChange(ownerFilter === m.user_id ? null : m.user_id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ActorAvatar actorType="member" actorId={m.user_id} size={18} />
                    <span className="text-xs truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{ownerCounts.get(m.user_id) ?? 0}</span>
                  </div>
                  {ownerFilter === m.user_id && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {filteredRuntimes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <Server className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            还没有执行环境
          </p>
          <p className="mt-1 text-xs text-muted-foreground text-center">
            运行{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              multica daemon start
            </code>{" "}
            来注册本地执行环境。
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {filteredRuntimes.map((runtime) => (
            <RuntimeListItem
              key={runtime.id}
              runtime={runtime}
              isSelected={runtime.id === selectedId}
              ownerMember={getOwnerMember(runtime.owner_id)}
              hasUpdate={updatableIds?.has(runtime.id) ?? false}
              onClick={() => onSelect(runtime.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
