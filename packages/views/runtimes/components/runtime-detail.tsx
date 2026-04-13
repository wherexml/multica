"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { AgentRuntime } from "@multica/core/types";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { memberListOptions } from "@multica/core/workspace/queries";
import { useDeleteRuntime } from "@multica/core/runtimes/mutations";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { ActorAvatar } from "../../common/actor-avatar";
import { formatLastSeen } from "../utils";
import { InfoField } from "./shared";
import { ProviderLogo } from "./provider-logo";
import { PingSection } from "./ping-section";
import { UpdateSection } from "./update-section";
import { UsageSection } from "./usage-section";

type RuntimeExecutor = {
  executor_kind?: string;
  resource_quota?: Record<string, unknown> | null;
};

type RuntimeWithExecutor = AgentRuntime & {
  executor?: RuntimeExecutor | null;
};

const statusLabelMap: Record<string, string> = {
  online: "在线",
  offline: "离线",
  connected: "已连接",
  disconnected: "已断开",
};

const providerLabelMap: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

const runtimeModeLabelMap: Record<string, string> = {
  local: "本地",
  cloud: "云端",
};

const quotaKeyLabelMap: Record<string, string> = {
  cpu: "CPU",
  memory: "Memory",
  timeout: "Timeout",
};

function getExecutor(runtime: AgentRuntime): RuntimeExecutor | null {
  return (runtime as RuntimeWithExecutor).executor ?? null;
}

function getStatusLabel(status: string): string {
  return statusLabelMap[status] ?? status;
}

function getProviderLabel(provider: string): string {
  return providerLabelMap[provider] ?? provider;
}

function getRuntimeModeLabel(mode: string): string {
  return runtimeModeLabelMap[mode] ?? mode;
}

function formatQuotaKey(key: string): string {
  return quotaKeyLabelMap[key] ?? key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatQuotaValue(value: unknown): string {
  if (value == null) return "未配置";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function StatusBadge({ status }: { status: string }) {
  const isOnline = status === "online" || status === "connected";

  return (
    <Badge
      variant="secondary"
      className={isOnline ? "bg-success/10 text-success" : ""}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}

function getCliVersion(metadata: Record<string, unknown>): string | null {
  if (
    metadata &&
    typeof metadata.cli_version === "string" &&
    metadata.cli_version
  ) {
    return metadata.cli_version;
  }
  return null;
}

export function RuntimeDetail({ runtime }: { runtime: AgentRuntime }) {
  const cliVersion =
    runtime.runtime_mode === "local" ? getCliVersion(runtime.metadata) : null;
  const executor = getExecutor(runtime);
  const quotaEntries = executor?.resource_quota
    ? Object.entries(executor.resource_quota)
    : [];

  const user = useAuthStore((s) => s.user);
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const deleteMutation = useDeleteRuntime(wsId);

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Resolve owner info
  const ownerMember = runtime.owner_id
    ? members.find((m) => m.user_id === runtime.owner_id) ?? null
    : null;

  // Permission check for delete
  const currentMember = user
    ? members.find((m) => m.user_id === user.id)
    : null;
  const isAdmin = currentMember
    ? currentMember.role === "owner" || currentMember.role === "admin"
    : false;
  const isRuntimeOwner = user && runtime.owner_id === user.id;
  const canDelete = isAdmin || isRuntimeOwner;

  const handleDelete = () => {
    deleteMutation.mutate(runtime.id, {
      onSuccess: () => {
        toast.success("执行环境已删除");
        setDeleteOpen(false);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "删除执行环境失败");
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            <ProviderLogo provider={runtime.provider} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{runtime.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={runtime.status} />
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4">
          <InfoField label="运行模式" value={getRuntimeModeLabel(runtime.runtime_mode)} />
          <InfoField label="提供方" value={getProviderLabel(runtime.provider)} />
          <InfoField label="状态" value={getStatusLabel(runtime.status)} />
          <InfoField
            label="最近在线"
            value={formatLastSeen(runtime.last_seen_at)}
          />
          {ownerMember && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">负责人</div>
              <div className="flex items-center gap-2">
                <ActorAvatar
                  actorType="member"
                  actorId={ownerMember.user_id}
                  size={20}
                />
                <span className="text-sm">{ownerMember.name}</span>
              </div>
            </div>
          )}
          {runtime.device_info && (
            <InfoField label="设备" value={runtime.device_info} />
          )}
          {runtime.daemon_id && (
            <InfoField label="Daemon ID" value={runtime.daemon_id} mono />
          )}
        </div>

        {/* Resource quota */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            资源配额
          </h3>
          <div className="rounded-lg border bg-muted/30 p-3">
            {quotaEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">未配置</div>
            ) : (
              <div className="space-y-2">
                {quotaEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-muted-foreground">{formatQuotaKey(key)}</span>
                    <span className="font-medium text-right break-all">
                      {formatQuotaValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CLI Version & Update */}
        {runtime.runtime_mode === "local" && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-3">
              CLI 版本
            </h3>
            <UpdateSection
              runtimeId={runtime.id}
              currentVersion={cliVersion}
              isOnline={runtime.status === "online"}
            />
          </div>
        )}

        {/* Connection Test */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            连接测试
          </h3>
          <PingSection runtimeId={runtime.id} />
        </div>

        {/* Usage */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Token 用量
          </h3>
          <UsageSection runtimeId={runtime.id} />
        </div>

        {/* Metadata */}
        {runtime.metadata && Object.keys(runtime.metadata).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">
              元数据
            </h3>
            <div className="rounded-lg border bg-muted/30 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(runtime.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <InfoField
            label="创建时间"
            value={new Date(runtime.created_at).toLocaleString()}
          />
          <InfoField
            label="更新时间"
            value={new Date(runtime.updated_at).toLocaleString()}
          />
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(v) => { if (!v) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除执行环境</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 &ldquo;{runtime.name}&rdquo; 吗？这个操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
