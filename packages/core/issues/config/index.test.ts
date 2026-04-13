import { describe, expect, it } from "vitest";
import { getIssuePriorityLabel, getIssueStatusLabel } from "./index";

describe("issue config localization", () => {
  it("returns Chinese status labels by default", () => {
    expect(getIssueStatusLabel("backlog")).toBe("待整理");
    expect(getIssueStatusLabel("in_progress")).toBe("进行中");
    expect(getIssueStatusLabel("cancelled")).toBe("已取消");
  });

  it("returns English status labels when the locale is English", () => {
    expect(getIssueStatusLabel("backlog", "en-US")).toBe("Backlog");
    expect(getIssueStatusLabel("done", "en")).toBe("Done");
  });

  it("returns localized priority labels", () => {
    expect(getIssuePriorityLabel("urgent")).toBe("紧急");
    expect(getIssuePriorityLabel("none")).toBe("无优先级");
    expect(getIssuePriorityLabel("high", "en-US")).toBe("High");
  });
});
