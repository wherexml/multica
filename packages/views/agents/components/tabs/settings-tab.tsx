"use client";

import { useState, useRef } from "react";
import {
  Cloud,
  Monitor,
  Loader2,
  Save,
  Globe,
  Lock,
  Camera,
  ChevronDown,
} from "lucide-react";
import type { Agent, AgentVisibility, RuntimeDevice } from "@multica/core/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { toast } from "sonner";
import { api } from "@multica/core/api";
import { useFileUpload } from "@multica/core/hooks/use-file-upload";
import { ActorAvatar } from "../../../common/actor-avatar";

export function SettingsTab({
  agent,
  runtimes,
  onSave,
}: {
  agent: Agent;
  runtimes: RuntimeDevice[];
  onSave: (updates: Partial<Agent>) => Promise<void>;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [visibility, setVisibility] = useState<AgentVisibility>(agent.visibility);
  const [maxTasks, setMaxTasks] = useState(agent.max_concurrent_tasks);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState(agent.runtime_id);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { upload, uploading } = useFileUpload(api);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRuntime = runtimes.find((d) => d.id === selectedRuntimeId) ?? null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await upload(file);
      if (!result) return;
      await onSave({ avatar_url: result.link });
      toast.success("头像已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传头像失败");
    }
  };

  const dirty =
    name !== agent.name ||
    description !== (agent.description ?? "") ||
    visibility !== agent.visibility ||
    maxTasks !== agent.max_concurrent_tasks ||
    selectedRuntimeId !== agent.runtime_id;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description,
        visibility,
        max_concurrent_tasks: maxTasks,
        runtime_id: selectedRuntimeId,
      });
      toast.success("设置已保存");
    } catch {
      toast.error("保存设置失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Label className="text-xs text-muted-foreground">头像</Label>
        <div className="mt-1.5 flex items-center gap-4">
          <button
            type="button"
            className="group relative h-16 w-16 shrink-0 rounded-full bg-muted overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ActorAvatar actorType="agent" actorId={agent.id} size={64} className="rounded-none" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div className="text-xs text-muted-foreground">
            点击上传头像
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">名称</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">职责说明</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="用一句话说明这个专家负责什么"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">可见范围</Label>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setVisibility("workspace")}
            className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              visibility === "workspace"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">工作区</div>
              <div className="text-xs text-muted-foreground">所有成员都可以指派</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              visibility === "private"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">私有</div>
              <div className="text-xs text-muted-foreground">只有你可以指派</div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">最大并发任务数</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={maxTasks}
          onChange={(e) => setMaxTasks(Number(e.target.value))}
          className="mt-1 w-24"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">执行环境</Label>
        <Popover open={runtimeOpen} onOpenChange={setRuntimeOpen}>
          <PopoverTrigger
            disabled={runtimes.length === 0}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 mt-1.5 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {selectedRuntime?.runtime_mode === "cloud" ? (
              <Cloud className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">
                  {selectedRuntime?.name ?? "暂无可用执行环境"}
                </span>
                {selectedRuntime?.runtime_mode === "cloud" && (
                  <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                    云端
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selectedRuntime?.device_info ?? "请选择执行环境"}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${runtimeOpen ? "rotate-180" : ""}`} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--anchor-width)] p-1 max-h-60 overflow-y-auto">
            {runtimes.map((device) => (
              <button
                key={device.id}
                onClick={() => {
                  setSelectedRuntimeId(device.id);
                  setRuntimeOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  device.id === selectedRuntimeId ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                {device.runtime_mode === "cloud" ? (
                  <Cloud className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{device.name}</span>
                    {device.runtime_mode === "cloud" && (
                      <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                        云端
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{device.device_info}</div>
                </div>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    device.status === "online" ? "bg-success" : "bg-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
        保存修改
      </Button>
    </div>
  );
}
