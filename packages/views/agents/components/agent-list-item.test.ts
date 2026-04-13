import { describe, expect, it } from "vitest";
import { getAgentDomainMeta, getAgentStatusLabel } from "./agent-list-item";

describe("getAgentDomainMeta", () => {
  it("returns a procurement badge for procurement keywords", () => {
    expect(getAgentDomainMeta("负责供应链采购协同")).toMatchObject({
      label: "采购",
    });
  });

  it("returns a general supply chain badge for generic supply chain descriptions", () => {
    expect(getAgentDomainMeta("专注供应链协同与流程优化")).toMatchObject({
      label: "供应链",
    });
  });

  it("returns a control tower badge for control tower keywords", () => {
    expect(getAgentDomainMeta("负责控制塔告警和异常分流")).toMatchObject({
      label: "控制塔",
    });
  });

  it("returns a governance badge for governance keywords", () => {
    expect(getAgentDomainMeta("负责审批边界和治理规则")).toMatchObject({
      label: "治理",
    });
  });

  it("falls back to the general badge when no domain keyword matches", () => {
    expect(getAgentDomainMeta("Handles general task routing")).toMatchObject({
      label: "通用",
    });
  });
});

describe("getAgentStatusLabel", () => {
  it("maps archived agents to 已归档", () => {
    expect(getAgentStatusLabel("working", true)).toBe("已归档");
  });

  it("maps offline agents to 离线", () => {
    expect(getAgentStatusLabel("offline", false)).toBe("离线");
  });

  it("maps non-offline active agents to 在线", () => {
    expect(getAgentStatusLabel("idle", false)).toBe("在线");
    expect(getAgentStatusLabel("working", false)).toBe("在线");
  });
});
