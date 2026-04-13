import { describe, expect, it } from "vitest";
import {
  PROJECT_PRIORITY_CONFIG,
  PROJECT_PRIORITY_ORDER,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_ORDER,
} from "./config";

describe("project config", () => {
  it("keeps the existing topic status order and exposes Chinese labels", () => {
    expect(PROJECT_STATUS_ORDER).toEqual([
      "planned",
      "in_progress",
      "paused",
      "completed",
      "cancelled",
    ]);

    expect(PROJECT_STATUS_CONFIG.planned.label).toBe("已规划");
    expect(PROJECT_STATUS_CONFIG.in_progress.label).toBe("进行中");
    expect(PROJECT_STATUS_CONFIG.paused.label).toBe("已暂停");
    expect(PROJECT_STATUS_CONFIG.completed.label).toBe("已完成");
    expect(PROJECT_STATUS_CONFIG.cancelled.label).toBe("已取消");
  });

  it("keeps the existing topic priority order and exposes Chinese labels", () => {
    expect(PROJECT_PRIORITY_ORDER).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
      "none",
    ]);

    expect(PROJECT_PRIORITY_CONFIG.urgent.label).toBe("紧急");
    expect(PROJECT_PRIORITY_CONFIG.high.label).toBe("高");
    expect(PROJECT_PRIORITY_CONFIG.medium.label).toBe("中");
    expect(PROJECT_PRIORITY_CONFIG.low.label).toBe("低");
    expect(PROJECT_PRIORITY_CONFIG.none.label).toBe("无");
  });
});
