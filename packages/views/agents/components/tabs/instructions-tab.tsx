"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import type { Agent } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";

export function InstructionsTab({
  agent,
  onSave,
}: {
  agent: Agent;
  onSave: (instructions: string) => Promise<void>;
}) {
  const [value, setValue] = useState(agent.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const isDirty = value !== (agent.instructions ?? "");

  // Sync when switching between agents.
  useEffect(() => {
    setValue(agent.instructions ?? "");
  }, [agent.id, agent.instructions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
    } catch {
      // toast handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">专家说明</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          这里定义这个专家的角色、判断方式和工作规则。系统在每次分配任务时都会把这段说明带给它。
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`请用业务语言说明这个专家要负责什么、怎么判断、输出什么。\n\n示例：\n你是供应链控制塔专家，负责识别库存、需求和供应异常，并把告警整理成决策单。\n\n## 输出要求\n- 先写结论，再写依据\n- 缺失数据必须单独列出\n- 必须说明建议 / 审批 / 自动三种模式里该选哪一种\n\n## 边界\n- 没有数字证据时不能下结论\n- 不直接触发高风险外部写操作`}
        className="w-full min-h-[300px] rounded-md border bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {value.length > 0 ? `已填写 ${value.length} 个字符` : "还没有填写专家说明"}
        </span>
        <Button
          size="xs"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          保存
        </Button>
      </div>
    </div>
  );
}
