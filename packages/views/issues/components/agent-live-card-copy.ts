import type { AgentTask } from "@multica/core/types/agent";

export function getLiveTaskEmptyStateMessage(locale: string): string {
  if (locale === "zh-CN") {
    return "当前还没有过程更新。这不一定是卡住了，部分任务会在结束时一次性显示结果或失败原因。";
  }
  return "No progress update yet. This does not necessarily mean the task is stuck. Some runs only return a result or error when they finish.";
}

export function getTaskRunEmptyStateMessage(
  task: Pick<AgentTask, "status" | "error">,
  locale: string,
): string {
  const isZh = locale === "zh-CN";
  const errorText = task.error?.trim();

  if (task.status === "failed" && errorText) {
    return isZh
      ? `这次执行没有过程记录。失败原因：${errorText}`
      : `No execution trace was recorded. Failure reason: ${errorText}`;
  }

  if (task.status === "cancelled") {
    return isZh ? "这次执行已停止，没有留下过程记录。" : "This run was stopped before any execution trace was recorded.";
  }

  return isZh ? "暂无执行记录。" : "No execution data recorded.";
}
