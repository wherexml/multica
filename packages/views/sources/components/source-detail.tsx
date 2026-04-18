"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatabaseZap, KeyRound, Loader2, Pencil, Play, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  AgentRuntime,
  Source,
  SourceRun,
  SourceTool,
  UpdateSourceAuthRequest,
} from "@multica/core/types";
import { useWorkspaceId } from "@multica/core/hooks";
import { sourceToolsOptions } from "@multica/core/sources/queries";
import {
  useCallSourceTool,
  useClearSourceAuth,
  useDeleteSource,
  useRefreshSourceTools,
  useTestSource,
  useUpdateSourceAuth,
} from "@multica/core/sources/mutations";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import { Input } from "@multica/ui/components/ui/input";
import { Textarea } from "@multica/ui/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { InfoField } from "../../runtimes/components/shared";
import { authTypeLabelMap, getSourceStatusMeta, transportLabelMap } from "./utils";

function parseJSONObject(text: string, label: string): Record<string, unknown> {
  const raw = text.trim();
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} 必须是合法的 JSON 对象`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} 必须是合法的 JSON 对象`);
  }

  return parsed as Record<string, unknown>;
}

function runStatusMeta(status?: string) {
  switch (status) {
    case "pending":
      return { label: "排队中", className: "border-border bg-muted text-muted-foreground" };
    case "running":
      return { label: "执行中", className: "border-info/20 bg-info/10 text-info" };
    case "completed":
      return { label: "已完成", className: "border-success/20 bg-success/10 text-success" };
    case "failed":
      return { label: "失败", className: "border-destructive/20 bg-destructive/10 text-destructive" };
    case "blocked":
      return { label: "已阻断", className: "border-warning/20 bg-warning/10 text-warning" };
    default:
      return { label: "未运行", className: "border-border bg-muted text-muted-foreground" };
  }
}

function toolSafetyMeta(safety: SourceTool["safety"]) {
  switch (safety) {
    case "read_only":
      return { label: "只读", className: "border-success/20 bg-success/10 text-success" };
    case "write":
      return { label: "写入", className: "border-destructive/20 bg-destructive/10 text-destructive" };
    default:
      return { label: "未知", className: "border-warning/20 bg-warning/10 text-warning" };
  }
}

function formatRunLabel(run?: SourceRun | null) {
  if (!run) return "还没有运行记录";
  if (run.run_type === "test") return "连接测试";
  if (run.run_type === "discover_tools") return "刷新工具";
  if (run.run_type === "call_tool") return run.tool_name ? `运行工具 · ${run.tool_name}` : "运行工具";
  return run.run_type;
}

function AuthDialog({
  source,
  open,
  saving,
  onClose,
  onSubmit,
}: {
  source: Source;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateSourceAuthRequest) => Promise<void>;
}) {
  const authType = source.mcp?.auth_type ?? "none";
  const [bearerToken, setBearerToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [tokenType, setTokenType] = useState("Bearer");
  const [expiresAt, setExpiresAt] = useState("");
  const [metadataText, setMetadataText] = useState("{}");

  const handleSubmit = async () => {
    try {
      if (authType === "bearer") {
        await onSubmit({
          auth_type: "bearer",
          bearer_token: bearerToken.trim(),
        });
        return;
      }

      if (authType === "oauth") {
        await onSubmit({
          auth_type: "oauth",
          oauth: {
            access_token: accessToken.trim(),
            refresh_token: refreshToken.trim() || undefined,
            token_type: tokenType.trim() || undefined,
            expires_at: expiresAt.trim() || undefined,
            metadata: parseJSONObject(metadataText, "OAuth metadata"),
          },
        });
        return;
      }

      await onSubmit({ auth_type: "none" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存认证失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>更新认证</DialogTitle>
          <DialogDescription>
            当前数据源使用 {authTypeLabelMap[authType] ?? authType}。保存后会自动重测并刷新工具列表。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {authType === "bearer" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Bearer Token</div>
              <Input
                value={bearerToken}
                onChange={(event) => setBearerToken(event.target.value)}
                placeholder="粘贴 Bearer Token"
              />
            </div>
          )}

          {authType === "oauth" && (
            <>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Access Token</div>
                <Input
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  placeholder="粘贴 access token"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Refresh Token</div>
                <Input
                  value={refreshToken}
                  onChange={(event) => setRefreshToken(event.target.value)}
                  placeholder="可选"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Token Type</div>
                  <Input
                    value={tokenType}
                    onChange={(event) => setTokenType(event.target.value)}
                    placeholder="Bearer"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Expires At</div>
                  <Input
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    placeholder="2026-04-14T10:00:00Z"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Metadata JSON</div>
                <Textarea
                  className="min-h-[120px] font-mono text-xs"
                  value={metadataText}
                  onChange={(event) => setMetadataText(event.target.value)}
                />
              </div>
            </>
          )}

          {authType === "none" && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              当前数据源配置为无需认证，不需要额外保存 token。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : "保存并重测"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunToolDialog({
  tool,
  open,
  running,
  onClose,
  onSubmit,
}: {
  tool: SourceTool | null;
  open: boolean;
  running: boolean;
  onClose: () => void;
  onSubmit: (args: Record<string, unknown>) => Promise<void>;
}) {
  const [argsText, setArgsText] = useState("{}");

  const handleSubmit = async () => {
    try {
      await onSubmit(parseJSONObject(argsText, "工具参数"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "运行工具失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>运行只读工具</DialogTitle>
          <DialogDescription>
            {tool?.title || tool?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {tool?.description && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {tool.description}
            </div>
          )}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">参数 JSON</div>
            <Textarea
              className="min-h-[180px] font-mono text-xs"
              value={argsText}
              onChange={(event) => setArgsText(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={running}>
            {running ? "提交中..." : "运行工具"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SourceDetail({
  source,
  runtimes,
  onEdit,
}: {
  source: Source;
  runtimes: AgentRuntime[];
  onEdit: (source: Source) => void;
}) {
  const wsId = useWorkspaceId();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<SourceTool | null>(null);

  const { data: toolData, isLoading: toolsLoading, refetch: refetchTools } = useQuery({
    ...sourceToolsOptions(wsId, source.id),
  });

  const deleteMutation = useDeleteSource();
  const testMutation = useTestSource();
  const refreshToolsMutation = useRefreshSourceTools();
  const callToolMutation = useCallSourceTool();
  const updateAuthMutation = useUpdateSourceAuth();
  const clearAuthMutation = useClearSourceAuth();

  const tools = toolData?.tools ?? [];
  const runtime = runtimes.find((item) => item.id === source.runtime_id) ?? null;
  const statusMeta = getSourceStatusMeta(source.connection_status);
  const latestRunMeta = runStatusMeta(source.latest_run?.status);
  const transport = source.mcp?.transport ? transportLabelMap[source.mcp.transport] ?? source.mcp.transport : "MCP";
  const authType = source.mcp?.auth_type ? authTypeLabelMap[source.mcp.auth_type] ?? source.mcp.auth_type : "无需认证";
  const targetValue = source.mcp?.transport === "stdio"
    ? source.mcp.command ?? "未配置"
    : source.mcp?.url ?? "未配置";
  const toolListSyncing = !toolsLoading && tools.length === 0 && (source.tool_summary?.total ?? 0) > 0;
  const toolSummaryTotal = source.tool_summary?.total ?? 0;
  const needsToolSync = toolSummaryTotal > tools.length
    || (source.latest_run?.run_type === "discover_tools"
      && (source.latest_run.status === "pending" || source.latest_run.status === "running"));

  useEffect(() => {
    if (!needsToolSync) return undefined;

    void refetchTools();
    const timer = window.setInterval(() => {
      void refetchTools();
    }, 1500);

    return () => {
      window.clearInterval(timer);
    };
  }, [needsToolSync, refetchTools]);

  const handleDelete = () => {
    deleteMutation.mutate(source.id, {
      onSuccess: () => {
        toast.success("数据源已删除");
        setDeleteOpen(false);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "删除数据源失败");
      },
    });
  };

  const handleTest = async () => {
    try {
      const run = await testMutation.mutateAsync(source.id);
      toast.success(run.summary || "已发起连接测试");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "连接测试失败");
    }
  };

  const handleRefreshTools = async () => {
    try {
      const run = await refreshToolsMutation.mutateAsync(source.id);
      toast.success(run.summary || "已开始刷新工具列表");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新工具列表失败");
    }
  };

  const handleSaveAuth = async (data: UpdateSourceAuthRequest) => {
    await updateAuthMutation.mutateAsync({ sourceId: source.id, data });
    await Promise.all([
      testMutation.mutateAsync(source.id),
      refreshToolsMutation.mutateAsync(source.id),
    ]);
    setAuthDialogOpen(false);
    toast.success("认证信息已更新");
  };

  const handleClearAuth = async () => {
    try {
      await clearAuthMutation.mutateAsync(source.id);
      await testMutation.mutateAsync(source.id);
      setAuthDialogOpen(false);
      toast.success("认证信息已清除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清除认证失败");
    }
  };

  const handleRunTool = async (args: Record<string, unknown>) => {
    if (!selectedTool) return;
    await callToolMutation.mutateAsync({
      sourceId: source.id,
      toolName: selectedTool.name,
      data: { arguments: args },
    });
    setToolDialogOpen(false);
    toast.success("工具已开始运行");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
            <DatabaseZap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{source.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`rounded-full text-[10px] ${statusMeta.badgeClassName}`}>
            {statusMeta.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${testMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onEdit(source)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          <InfoField label="类型" value="MCP" />
          <InfoField label="传输方式" value={transport} />
          <InfoField label="认证方式" value={authType} />
          <InfoField label="连接状态" value={statusMeta.label} />
          <InfoField label="执行环境" value={runtime?.name ?? "未绑定"} />
          <InfoField label="执行环境状态" value={runtime?.status === "online" ? "在线" : "离线"} />
        </div>

        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">连接信息</h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-xs text-muted-foreground">
              {source.mcp?.transport === "stdio" ? "启动命令" : "服务地址"}
            </div>
            <div className="mt-1 break-all text-sm font-medium">{targetValue}</div>
            {source.mcp?.args && source.mcp.args.length > 0 && (
              <>
                <div className="mt-4 text-xs text-muted-foreground">命令参数</div>
                <div className="mt-1 text-sm">{source.mcp.args.join(", ")}</div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground">认证信息</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setAuthDialogOpen(true)}
                disabled={source.mcp?.auth_type === "none"}
              >
                <KeyRound className="h-3.5 w-3.5" />
                更新认证
              </Button>
              {source.auth_state.configured && source.mcp?.auth_type !== "none" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={handleClearAuth}
                  disabled={clearAuthMutation.isPending}
                >
                  清除
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {source.auth_state.configured ? "认证已配置" : "认证未完成"}
              </span>
              <Badge
                variant="outline"
                className={source.auth_state.configured ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"}
              >
                {source.auth_state.configured ? "可用" : "待补充"}
              </Badge>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {source.auth_state.preview || (source.mcp?.auth_type === "none" ? "当前数据源无需认证" : "还没有保存任何 token")}
            </div>
            {source.auth_state.updated_at && (
              <div className="mt-2 text-xs text-muted-foreground">
                最近更新：{new Date(source.auth_state.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">最近一次运行</h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium">{formatRunLabel(source.latest_run)}</div>
              <Badge variant="outline" className={latestRunMeta.className}>
                {latestRunMeta.label}
              </Badge>
            </div>
            <div className="mt-3 text-sm">
              {source.latest_run?.summary || "还没有运行记录"}
            </div>
            {source.latest_run?.error_message && (
              <div className="mt-2 text-sm text-destructive">{source.latest_run.error_message}</div>
            )}
            {!!source.latest_run?.result_payload && (
              <pre className="mt-4 overflow-x-auto rounded-md bg-background p-3 text-xs">
                {JSON.stringify(source.latest_run.result_payload, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground">工具能力</h3>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleRefreshTools}
              disabled={refreshToolsMutation.isPending}
            >
              {refreshToolsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新工具
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            {source.tool_summary && source.tool_summary.total > 0 && (
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">总数 {source.tool_summary.total}</Badge>
                <Badge variant="outline" className="border-success/20 bg-success/10 text-success">只读 {source.tool_summary.read_only}</Badge>
                <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">写入 {source.tool_summary.write}</Badge>
                <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">未知 {source.tool_summary.unknown}</Badge>
              </div>
            )}

            {toolsLoading ? (
              <div className="text-sm text-muted-foreground">正在加载工具列表...</div>
            ) : toolListSyncing ? (
              <div className="text-sm text-muted-foreground">
                工具快照已经更新，正在同步工具列表…
              </div>
            ) : tools.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                还没有工具快照。先完成认证并点一次“刷新工具”，这里才会显示真实工具列表。
              </div>
            ) : (
              <div className="space-y-3">
                {tools.map((tool) => {
                  const safetyMeta = toolSafetyMeta(tool.safety);
                  const blockedText = tool.safety === "write"
                    ? "这个工具会改外部系统，当前版本先不放行。"
                    : tool.safety === "unknown"
                      ? "这个工具的安全级别还不明确，当前版本先不放行。"
                      : "";

                  return (
                    <div key={tool.id} className="rounded-lg border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{tool.title || tool.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{tool.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={safetyMeta.className}>
                            {safetyMeta.label}
                          </Badge>
                          <Button
                            size="sm"
                            variant={tool.safety === "read_only" ? "default" : "outline"}
                            className="h-8 gap-1.5 text-xs"
                            disabled={tool.safety !== "read_only" || callToolMutation.isPending}
                            onClick={() => {
                              setSelectedTool(tool);
                              setToolDialogOpen(true);
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            {tool.safety === "read_only" ? "运行" : "已阻断"}
                          </Button>
                        </div>
                      </div>
                      {tool.description && (
                        <div className="mt-3 text-sm text-muted-foreground">{tool.description}</div>
                      )}
                      {blockedText && (
                        <div className="mt-3 text-sm text-muted-foreground">{blockedText}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">原始配置</h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-all text-xs font-mono">
              {JSON.stringify(source.mcp ?? {}, null, 2)}
            </pre>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <InfoField label="创建时间" value={new Date(source.created_at).toLocaleString()} />
          <InfoField label="更新时间" value={new Date(source.updated_at).toLocaleString()} />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除数据源</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 “{source.name}” 吗？这个操作无法撤销。
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

      <AuthDialog
        source={source}
        open={authDialogOpen}
        saving={updateAuthMutation.isPending || testMutation.isPending || refreshToolsMutation.isPending}
        onClose={() => setAuthDialogOpen(false)}
        onSubmit={handleSaveAuth}
      />

      <RunToolDialog
        tool={selectedTool}
        open={toolDialogOpen}
        running={callToolMutation.isPending}
        onClose={() => setToolDialogOpen(false)}
        onSubmit={handleRunTool}
      />
    </div>
  );
}
