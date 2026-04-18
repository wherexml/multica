"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, Loader2, ShieldCheck, SquareTerminal, WandSparkles, Workflow } from "lucide-react";
import type { AgentRuntime, CreateSourceRequest, Source, UpdateSourceRequest, McpAuthType, McpTransport } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { Badge } from "@multica/ui/components/ui/badge";
import { toast } from "sonner";
import { ProviderLogo } from "../../runtimes/components/provider-logo";
import { authTypeLabelMap, transportLabelMap } from "./utils";

const stepTitles = [
  "选择执行环境",
  "选择传输方式",
  "填写连接信息",
  "填写认证信息",
  "确认并保存",
  "自动测试",
] as const;

function parseJsonRecord(text: string, label: string): Record<string, string> {
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

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );
}

function buildDefaultHeaders(source?: Source | null) {
  if (!source?.mcp?.headers) return "{}";

  const headers = { ...source.mcp.headers };
  if ("Authorization" in headers) {
    delete headers.Authorization;
  }
  return JSON.stringify(headers, null, 2);
}

function extractBearerToken(source?: Source | null) {
  const authHeader = source?.mcp?.headers?.Authorization ?? source?.mcp?.headers?.authorization;
  if (!authHeader) return "";
  return authHeader.replace(/^Bearer\s+/i, "");
}

export function CreateSourceDialog({
  runtimes,
  source,
  onClose,
  onSubmit,
}: {
  runtimes: AgentRuntime[];
  source?: Source | null;
  onClose: () => void;
  onSubmit: (data: CreateSourceRequest | UpdateSourceRequest) => Promise<void>;
}) {
  const isEditing = !!source;
  const allRuntimesOffline = runtimes.length > 0 && runtimes.every((runtime) => runtime.status !== "online");
  const [step, setStep] = useState(1);
  const [runtimeId, setRuntimeId] = useState(source?.runtime_id ?? runtimes[0]?.id ?? "");
  const [transport, setTransport] = useState<McpTransport>(source?.mcp?.transport ?? "http");
  const [name, setName] = useState(source?.name ?? "");
  const [url, setUrl] = useState(source?.mcp?.url ?? "");
  const [command, setCommand] = useState(source?.mcp?.command ?? "");
  const [argsText, setArgsText] = useState(source?.mcp?.args?.join(", ") ?? "");
  const [envText, setEnvText] = useState(
    source?.mcp?.env ? JSON.stringify(source.mcp.env, null, 2) : "{}",
  );
  const [authType, setAuthType] = useState<McpAuthType>(source?.mcp?.auth_type ?? "none");
  const [clientId, setClientId] = useState(source?.mcp?.client_id ?? "");
  const [bearerToken, setBearerToken] = useState(extractBearerToken(source));
  const [headersText, setHeadersText] = useState(buildDefaultHeaders(source));
  const [saving, setSaving] = useState(false);

  const selectedRuntime = useMemo(
    () => runtimes.find((runtime) => runtime.id === runtimeId) ?? null,
    [runtimeId, runtimes],
  );

  const validateCurrentStep = () => {
    if (step === 1 && !runtimeId) {
      throw new Error("请先选择一个执行环境");
    }

    if (step === 3) {
      if (!name.trim()) throw new Error("请填写数据源名称");
      if (transport === "stdio" && !command.trim()) {
        throw new Error("stdio 方式需要填写启动命令");
      }
      if ((transport === "http" || transport === "sse") && !url.trim()) {
        throw new Error("远程 MCP 需要填写服务地址");
      }
      parseJsonRecord(envText, "环境变量");
    }

    if (step === 4) {
      parseJsonRecord(headersText, "附加请求头");
    }
  };

  const handleNext = () => {
    try {
      validateCurrentStep();
      setStep((current) => Math.min(current + 1, 5));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "请检查当前步骤填写内容");
    }
  };

  const handleSubmit = async () => {
    try {
      validateCurrentStep();
      const env = parseJsonRecord(envText, "环境变量");
      const extraHeaders = parseJsonRecord(headersText, "附加请求头");
      const headers = {
        ...extraHeaders,
        ...(authType === "bearer" && bearerToken.trim()
          ? { Authorization: `Bearer ${bearerToken.trim()}` }
          : {}),
      };

      const payload = {
        ...(runtimeId ? { runtime_id: runtimeId } : {}),
        name: name.trim(),
        source_type: "mcp" as const,
        mcp: {
          transport,
          ...(transport === "stdio"
            ? {
                command: command.trim(),
                args: argsText
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              }
            : {
                url: url.trim(),
              }),
          auth_type: authType,
          ...(authType === "oauth" && clientId.trim() ? { client_id: clientId.trim() } : {}),
          ...(Object.keys(env).length > 0 ? { env } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
      };

      setSaving(true);
      setStep(6);
      await onSubmit(payload);
      onClose();
    } catch (error) {
      setSaving(false);
      setStep(5);
      toast.error(error instanceof Error ? error.message : `${isEditing ? "更新" : "连接"}数据源失败`);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑数据源" : "连接数据源"}</DialogTitle>
          <DialogDescription>
            按步骤完成执行环境绑定、MCP 连接配置和认证信息设置。保存后会自动跑一次连接测试。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 pr-8">
          {stepTitles.map((title, index) => {
            const currentStep = index + 1;
            const active = step === currentStep;
            const done = currentStep < step;

            return (
              <Badge
                key={title}
                variant="outline"
                className={
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : done
                      ? "border-success/20 bg-success/10 text-success"
                      : "text-muted-foreground"
                }
              >
                {currentStep}. {title}
              </Badge>
            );
          })}
        </div>

        <div className="min-h-[360px] space-y-4 overflow-y-auto pr-1">
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">执行环境</Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  选择哪台机器去访问这个数据源。只有能访问目标网络或目标服务的机器，后面的测试和调用才会成功。
                </p>
              </div>
              {allRuntimesOffline && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
                  当前所有执行环境都处于离线状态。通常是 daemon 没启动，或者 daemon 连接到了错误的后端地址。先让至少一台机器恢复在线，再继续绑定数据源会更稳妥。
                </div>
              )}
              {runtimes.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  当前还没有可用执行环境。请先去“执行环境”页面把机器接进来，再回来连接数据源。
                </div>
              ) : (
                <div className="max-w-full space-y-2 overflow-hidden">
                  {runtimes.map((runtime) => (
                    <button
                      key={runtime.id}
                      type="button"
                      onClick={() => setRuntimeId(runtime.id)}
                      className={`flex w-full max-w-full items-center gap-3 overflow-hidden rounded-lg border px-4 py-3 text-left transition-colors ${
                        runtime.id === runtimeId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <ProviderLogo provider={runtime.provider} className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium">{runtime.name}</div>
                        <div className="truncate text-xs text-muted-foreground" title={runtime.device_info}>
                          {runtime.device_info}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${runtime.status === "online" ? "border-success/20 bg-success/10 text-success" : ""}`}
                      >
                        {runtime.status === "online" ? "在线" : "离线"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">MCP 传输方式</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {([
                  { value: "http", title: "HTTP", description: "适合标准远程 MCP 服务", icon: Workflow },
                  { value: "sse", title: "SSE", description: "适合流式事件连接", icon: WandSparkles },
                  { value: "stdio", title: "stdio", description: "适合本地命令启动的 MCP", icon: SquareTerminal },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTransport(option.value)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      transport === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <option.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="mt-3 text-sm font-medium">{option.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">数据源名称</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：Linear MCP / 财务知识库 / 仓储调度服务"
                  className="mt-1.5"
                />
              </div>

              {(transport === "http" || transport === "sse") && (
                <div>
                  <Label className="text-xs text-muted-foreground">服务地址</Label>
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://mcp.example.com"
                    className="mt-1.5"
                  />
                </div>
              )}

              {transport === "stdio" && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">启动命令</Label>
                    <Input
                      value={command}
                      onChange={(event) => setCommand(event.target.value)}
                      placeholder="npx"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">参数（逗号分隔）</Label>
                    <Input
                      value={argsText}
                      onChange={(event) => setArgsText(event.target.value)}
                      placeholder="-y, @modelcontextprotocol/server-filesystem"
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">环境变量（JSON）</Label>
                <Textarea
                  value={envText}
                  onChange={(event) => setEnvText(event.target.value)}
                  rows={5}
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Label className="text-xs text-muted-foreground">认证方式</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {([
                  { value: "none", title: "无需认证", icon: ShieldCheck, description: "当前连接只做基础连通性校验" },
                  { value: "bearer", title: "Bearer", icon: KeyRound, description: "适合 API Token / PAT" },
                  { value: "oauth", title: "OAuth", icon: KeyRound, description: "保留二期 OAuth 接入位" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAuthType(option.value)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      authType === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <option.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="mt-3 text-sm font-medium">{option.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>

              {authType === "bearer" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Bearer Token（可选）</Label>
                  <Input
                    value={bearerToken}
                    onChange={(event) => setBearerToken(event.target.value)}
                    placeholder="留空也可以，保存后会显示“待认证”"
                    className="mt-1.5"
                  />
                </div>
              )}

              {authType === "oauth" && (
                <div>
                  <Label className="text-xs text-muted-foreground">OAuth Client ID（可选）</Label>
                  <Input
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="保存后会保留 OAuth 占位，并标记为待认证"
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">附加请求头（JSON）</Label>
                <Textarea
                  value={headersText}
                  onChange={(event) => setHeadersText(event.target.value)}
                  rows={6}
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">数据源名称</div>
                    <div className="mt-1 text-sm font-medium">{name || "未填写"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">执行环境</div>
                    <div className="mt-1 text-sm font-medium">{selectedRuntime?.name ?? "未选择"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">传输方式</div>
                    <div className="mt-1 text-sm font-medium">{transportLabelMap[transport]}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">认证方式</div>
                    <div className="mt-1 text-sm font-medium">{authTypeLabelMap[authType]}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground">连接目标</div>
                    <div className="mt-1 break-all text-sm font-medium">
                      {transport === "stdio" ? command || "未填写命令" : url || "未填写地址"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                保存后系统会立即发起一次连接测试，并把状态写回列表和详情页。
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h3 className="mt-5 text-base font-semibold">正在保存并测试连接</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                我们会先保存数据源配置，再自动跑一次连通性校验，把结果回写到页面里。
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="justify-between">
          <div>
            {step > 1 && step < 6 && (
              <Button variant="ghost" onClick={() => setStep((current) => Math.max(current - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              取消
            </Button>
            {step < 5 && (
              <Button onClick={handleNext} disabled={runtimes.length === 0}>
                下一步
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 5 && (
              <Button onClick={handleSubmit} disabled={saving || !selectedRuntime}>
                {isEditing ? "保存并测试" : "连接并测试"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
