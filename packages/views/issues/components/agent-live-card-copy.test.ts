import { describe, expect, it } from "vitest";
import { getLiveTaskEmptyStateMessage, getTaskRunEmptyStateMessage } from "./agent-live-card-copy";

describe("agent-live-card-copy", () => {
  it("uses clearer Chinese empty-state copy for live tasks", () => {
    expect(getLiveTaskEmptyStateMessage("zh-CN")).toBe(
      "当前还没有过程更新。这不一定是卡住了，部分任务会在结束时一次性显示结果或失败原因。",
    );
  });

  it("shows the failure reason when a finished run has no timeline rows", () => {
    expect(
      getTaskRunEmptyStateMessage(
        { status: "failed", error: "API Error: tothemars.top | 502: Bad gateway" },
        "zh-CN",
      ),
    ).toBe("这次执行没有过程记录。失败原因：API Error: tothemars.top | 502: Bad gateway");
  });

  it("keeps the generic copy for runs without an error", () => {
    expect(getTaskRunEmptyStateMessage({ status: "completed", error: null }, "zh-CN")).toBe("暂无执行记录。");
  });
});
