"use client";

import { useState, useEffect, useMemo } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Download,
} from "lucide-react";
import type { Skill, CreateSkillRequest, UpdateSkillRequest } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@multica/ui/components/ui/dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@multica/ui/components/ui/resizable";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@multica/ui/components/ui/tabs";
import { toast } from "sonner";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { api } from "@multica/core/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { skillListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { cn } from "@multica/ui/lib/utils";

import { FileTree } from "./file-tree";
import { FileViewer } from "./file-viewer";
import { detectSkillDomains, getSkillDomainBadge } from "./skill-domain-helpers";

const GENERIC_DOMAIN = "generic";

const RECOMMENDED_TEMPLATES = [
  {
    name: "供应商评估模板",
    subtitle: "Supplier Evaluation",
    description: "用于梳理供应商表现、交付能力与合作风险。",
  },
  {
    name: "库存优化模板",
    subtitle: "Inventory Optimization",
    description: "用于分析库存周转、安全库存与补货策略。",
  },
  {
    name: "需求预测模板",
    subtitle: "Demand Forecasting",
    description: "用于整理需求信号、预测假设与波动趋势。",
  },
] as const;

function getDomainBadgeClassName(color: string) {
  switch (color) {
    case "blue":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
    case "green":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300";
    case "orange":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300";
    case "purple":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300";
    case "cyan":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300";
    case "red":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "teal":
      return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function SkillDomainBadge({
  domain,
  className,
}: {
  domain: string;
  className?: string;
}) {
  const { label, color } = getSkillDomainBadge(domain);

  return (
    <Badge
      variant="outline"
      className={cn("border text-[11px] font-medium", getDomainBadgeClassName(color), className)}
    >
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Create Skill Dialog
// ---------------------------------------------------------------------------

function CreateSkillDialog({
  onClose,
  onCreate,
  onImport,
}: {
  onClose: () => void;
  onCreate: (data: CreateSkillRequest) => Promise<void>;
  onImport: (url: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"create" | "import">("create");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState("");

  const detectedSource = (() => {
    const url = importUrl.trim().toLowerCase();
    if (url.includes("clawhub.ai")) return "clawhub" as const;
    if (url.includes("skills.sh")) return "skills.sh" as const;
    return null;
  })();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() });
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setLoading(true);
    setImportError("");
    try {
      await onImport(importUrl.trim());
      onClose();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "导入失败");
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建技能包</DialogTitle>
          <DialogDescription>
            创建新的技能包，或从 ClawHub / Skills.sh 导入。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "create" | "import")}>
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">
              <Plus className="mr-1.5 h-3 w-3" />
              创建
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1">
              <Download className="mr-1.5 h-3 w-3" />
              导入
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4 min-h-[180px]">
            <div>
              <Label className="text-xs text-muted-foreground">名称</Label>
              <Input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：供应商评估、需求预测"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">描述</Label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要说明这个技能包的用途"
                className="mt-1"
              />
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4 min-h-[180px]">
            <div>
              <Label className="text-xs text-muted-foreground">技能链接</Label>
              <Input
                autoFocus
                type="text"
                value={importUrl}
                onChange={(e) => { setImportUrl(e.target.value); setImportError(""); }}
                placeholder="粘贴技能链接..."
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
              />
            </div>

            {/* Supported sources — highlight on detection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">支持来源</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  detectedSource === "clawhub"
                    ? "border-primary bg-primary/5"
                    : ""
                }`}>
                  <div className="text-xs font-medium">ClawHub</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                    clawhub.ai/owner/skill
                  </div>
                </div>
                <div className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  detectedSource === "skills.sh"
                    ? "border-primary bg-primary/5"
                    : ""
                }`}>
                  <div className="text-xs font-medium">Skills.sh</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                    skills.sh/owner/repo/skill
                  </div>
                </div>
              </div>
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {importError}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          {tab === "create" ? (
            <Button onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? "创建中..." : "创建"}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading || !importUrl.trim()}>
              {loading ? (
                detectedSource === "clawhub"
                  ? "正在从 ClawHub 导入..."
                  : detectedSource === "skills.sh"
                    ? "正在从 Skills.sh 导入..."
                    : "导入中..."
              ) : (
                <>
                  <Download className="mr-1.5 h-3 w-3" />
                  导入
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skill List Item
// ---------------------------------------------------------------------------

function SkillListItem({
  skill,
  isSelected,
  onClick,
}: {
  skill: Skill;
  isSelected: boolean;
  onClick: () => void;
}) {
  const domains = detectSkillDomains(skill.name, skill.description);
  const visibleDomains = domains.length > 0 ? domains : [GENERIC_DOMAIN];

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{skill.name}</div>
        {skill.description && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {skill.description}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {visibleDomains.map((domain) => (
            <SkillDomainBadge key={`${skill.id}-${domain}`} domain={domain} />
          ))}
        </div>
      </div>
      {(skill.files?.length ?? 0) > 0 && (
        <Badge variant="secondary">
          {skill.files.length} 文件
        </Badge>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers: virtual file list for the tree
// ---------------------------------------------------------------------------

const SKILL_MD = "SKILL.md";

/** Merge skill.content (as SKILL.md) + skill.files into a single map */
function buildFileMap(
  content: string,
  files: { path: string; content: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  map.set(SKILL_MD, content);
  for (const f of files) {
    if (f.path.trim()) map.set(f.path, f.content);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Add File Dialog
// ---------------------------------------------------------------------------

function AddFileDialog({
  existingPaths,
  onClose,
  onAdd,
}: {
  existingPaths: string[];
  onClose: () => void;
  onAdd: (path: string) => void;
}) {
  const [path, setPath] = useState("");
  const duplicate = existingPaths.includes(path.trim());

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">添加文件</DialogTitle>
          <DialogDescription className="text-xs">
            为当前技能包添加辅助文件。
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs text-muted-foreground">文件路径</Label>
          <Input
            autoFocus
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="例如：templates/review.md"
            className="mt-1 font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && path.trim() && !duplicate) {
                onAdd(path.trim());
                onClose();
              }
            }}
          />
          {duplicate && (
            <p className="mt-1 text-xs text-destructive">文件已存在</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            disabled={!path.trim() || duplicate}
            onClick={() => { onAdd(path.trim()); onClose(); }}
          >
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skill Detail — file-browser layout
// ---------------------------------------------------------------------------

function SkillDetail({
  skill,
  onUpdate,
  onDelete,
}: {
  skill: Skill;
  onUpdate: (id: string, data: UpdateSkillRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  const [activeTab, setActiveTab] = useState<"files" | "settings">("files");
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [content, setContent] = useState(skill.content);
  const [files, setFiles] = useState<{ path: string; content: string }[]>(
    (skill.files ?? []).map((f) => ({ path: f.path, content: f.content })),
  );
  const [selectedPath, setSelectedPath] = useState(SKILL_MD);
  const [saving, setSaving] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);

  // Sync basic fields from store updates
  useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setContent(skill.content);
    setActiveTab("files");
  }, [skill.id, skill.name, skill.description, skill.content]);

  // Fetch full skill (with files) on selection change
  useEffect(() => {
    setSelectedPath(SKILL_MD);
    setLoadingFiles(true);
    api.getSkill(skill.id).then((full) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      setFiles((full.files ?? []).map((f) => ({ path: f.path, content: f.content })));
    }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "加载技能包文件失败");
    }).finally(() => setLoadingFiles(false));
  }, [skill.id, qc, wsId]);

  // Build the virtual file map
  const fileMap = useMemo(() => buildFileMap(content, files), [content, files]);
  const filePaths = useMemo(() => Array.from(fileMap.keys()), [fileMap]);
  const selectedContent = fileMap.get(selectedPath) ?? "";
  const domains = useMemo(() => detectSkillDomains(name, description), [name, description]);
  const visibleDomains = domains.length > 0 ? domains : [GENERIC_DOMAIN];

  const isDirty =
    name !== skill.name ||
    description !== skill.description ||
    content !== skill.content ||
    JSON.stringify(files) !==
      JSON.stringify((skill.files ?? []).map((f) => ({ path: f.path, content: f.content })));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(skill.id, {
        name: name.trim(),
        description: description.trim(),
        content,
        files: files.filter((f) => f.path.trim()),
      });
    } catch {
      // toast handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleFileContentChange = (newContent: string) => {
    if (selectedPath === SKILL_MD) {
      setContent(newContent);
    } else {
      setFiles((prev) =>
        prev.map((f) =>
          f.path === selectedPath ? { ...f, content: newContent } : f,
        ),
      );
    }
  };

  const handleAddFile = (path: string) => {
    setFiles((prev) => [...prev, { path, content: "" }]);
    setSelectedPath(path);
  };

  const handleDeleteFile = () => {
    if (selectedPath === SKILL_MD) return;
    setFiles((prev) => prev.filter((f) => f.path !== selectedPath));
    setSelectedPath(SKILL_MD);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm font-medium"
              placeholder="技能包名称"
            />
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-sm"
              placeholder="简要描述"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {isDirty && (
            <Button onClick={handleSave} disabled={saving || !name.trim()} size="xs">
              <Save className="h-3 w-3" />
              {saving ? "保存中..." : "保存"}
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfirmDelete(true)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              }
            />
            <TooltipContent>删除技能包</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "files" | "settings")}
        className="flex flex-1 min-h-0 flex-col gap-0"
      >
        <div className="border-b px-4 py-2">
          <TabsList variant="line">
            <TabsTrigger value="files">文件</TabsTrigger>
            <TabsTrigger value="settings">设置</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="files" className="mt-0 flex min-h-0 flex-1">
          {/* File tree */}
          <div className="w-52 shrink-0 border-r flex flex-col">
            <div className="flex h-10 items-center justify-between border-b px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                文件
              </span>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowAddFile(true)}
                        className="text-muted-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>添加文件</TooltipContent>
                </Tooltip>
                {selectedPath !== SKILL_MD && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={handleDeleteFile}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>删除文件</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingFiles ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <FileTree
                  filePaths={filePaths}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                />
              )}
            </div>
          </div>

          {/* File viewer */}
          <div className="flex-1 min-w-0">
            {loadingFiles ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <FileViewer
                key={selectedPath}
                path={selectedPath}
                content={selectedContent}
                onChange={handleFileContentChange}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
            <Card>
              <CardHeader>
                <CardTitle>适用领域</CardTitle>
                <CardDescription>
                  根据技能包名称和描述自动识别当前更适合的业务领域。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {visibleDomains.map((domain) => (
                    <SkillDomainBadge
                      key={`${skill.id}-detail-${domain}`}
                      domain={domain}
                      className="text-xs"
                    />
                  ))}
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div>
                    <h3 className="text-sm font-medium">推荐模板</h3>
                    <p className="text-xs text-muted-foreground">
                      以下模板仅供参考展示，当前不会自动加载到技能包中。
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {RECOMMENDED_TEMPLATES.map((template) => (
                      <div
                        key={template.name}
                        className="rounded-lg border bg-muted/20 px-4 py-3"
                      >
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {template.subtitle}
                        </div>
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add file dialog */}
      {showAddFile && (
        <AddFileDialog
          existingPaths={filePaths}
          onClose={() => setShowAddFile(false)}
          onAdd={handleAddFile}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <Dialog open onOpenChange={(v) => { if (!v) setConfirmDelete(false); }}>
          <DialogContent className="max-w-sm" showCloseButton={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <DialogHeader className="flex-1 gap-1">
                <DialogTitle className="text-sm font-semibold">删除技能包？</DialogTitle>
                <DialogDescription className="text-xs">
                  这会永久删除 &quot;{skill.name}&quot;，并将它从所有 Agent 中移除。
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete(skill.id);
                }}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  const { data: skills = [] } = useQuery(skillListOptions(wsId));
  const [selectedId, setSelectedId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_skills_layout",
  });

  useEffect(() => {
    if (skills.length > 0 && !selectedId) {
      setSelectedId(skills[0]!.id);
    }
  }, [skills, selectedId]);

  const handleCreate = async (data: CreateSkillRequest) => {
    const skill = await api.createSkill(data);
    qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
    setSelectedId(skill.id);
    toast.success("技能包已创建");
  };

  const handleImport = async (url: string) => {
    const skill = await api.importSkill({ url });
    qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
    setSelectedId(skill.id);
    toast.success("技能包已导入");
  };

  const handleUpdate = async (id: string, data: UpdateSkillRequest) => {
    try {
      await api.updateSkill(id, data);
      qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      toast.success("技能包已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存技能包失败");
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSkill(id);
      if (selectedId === id) {
        const remaining = skills.filter((s) => s.id !== id);
        setSelectedId(remaining[0]?.id ?? "");
      }
      qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      toast.success("技能包已删除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除技能包失败");
    }
  };

  const selected = skills.find((s) => s.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0">
        {/* List skeleton */}
        <div className="w-72 border-r">
          <div className="flex h-12 items-center justify-between border-b px-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Detail skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-56" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-48 border-r p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex-1 p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1 min-h-0"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel id="list" defaultSize={280} minSize={240} maxSize={400} groupResizeBehavior="preserve-pixel-size">
        {/* Left column — skill list */}
        <div className="overflow-y-auto h-full border-r">
          <div className="flex h-12 items-center justify-between border-b px-4">
            <h1 className="text-sm font-semibold">技能包</h1>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">创建技能包</TooltipContent>
            </Tooltip>
          </div>
          {skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12">
              <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">还没有技能包</p>
              <p className="mt-1 text-xs text-muted-foreground text-center">
                技能包用于为 Agent 定义可复用的指令。
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                size="xs"
                className="mt-3"
              >
                <Plus className="h-3 w-3" />
                创建技能包
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {skills.map((skill) => (
                <SkillListItem
                  key={skill.id}
                  skill={skill}
                  isSelected={skill.id === selectedId}
                  onClick={() => setSelectedId(skill.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel id="detail" minSize="50%">
        {/* Right column — skill detail */}
        <div className="flex-1 overflow-hidden h-full">
          {selected ? (
            <SkillDetail
              key={selected.id}
              skill={selected}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Sparkles className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm">选择一个技能包查看详情</p>
              <Button
                onClick={() => setShowCreate(true)}
                size="xs"
                className="mt-3"
              >
                <Plus className="h-3 w-3" />
                创建技能包
              </Button>
            </div>
          )}
        </div>
      </ResizablePanel>

      {showCreate && (
        <CreateSkillDialog
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          onImport={handleImport}
        />
      )}
    </ResizablePanelGroup>
  );
}
