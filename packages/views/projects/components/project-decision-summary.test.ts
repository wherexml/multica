import { describe, expect, it } from "vitest";
import type { DecisionCase } from "@multica/core/types";
import { getProjectDecisionSummary } from "./project-decision-summary";

function makeDecision(overrides: Partial<DecisionCase> = {}): DecisionCase {
  return {
    id: "decision-1",
    title: "调拨决策",
    description: null,
    status: "todo",
    priority: "high",
    assignee_type: "member",
    assignee_id: "member-1",
    created_at: "2026-04-10T00:00:00Z",
    updated_at: "2026-04-10T00:00:00Z",
    domain: "supply",
    decision_type: "inventory_rebalance",
    object_type: "sku",
    object_id: "sku-1",
    objective: "稳定供给",
    constraints: "预算",
    risk_level: "medium",
    execution_mode: "manual",
    phase: "diagnosing",
    approval_status: "pending",
    execution_status: "draft",
    project_id: "project-1",
    ...overrides,
  };
}

describe("getProjectDecisionSummary", () => {
  it("builds phase and risk summaries for linked decisions", () => {
    const summary = getProjectDecisionSummary([
      makeDecision({ id: "decision-1", phase: "diagnosing", risk_level: "high" }),
      makeDecision({ id: "decision-2", phase: "diagnosing", risk_level: "medium" }),
      makeDecision({ id: "decision-3", phase: "monitoring", risk_level: "critical" }),
      makeDecision({ id: "decision-4", phase: "closed", risk_level: "low" }),
    ]);

    expect(summary.totalCount).toBe(4);
    expect(summary.phaseStats).toEqual([
      { value: "diagnosing", label: "诊断中", count: 2 },
      { value: "monitoring", label: "监控中", count: 1 },
      { value: "closed", label: "已关闭", count: 1 },
    ]);
    expect(summary.riskStats).toEqual([
      { value: "critical", label: "紧急风险", count: 1 },
      { value: "high", label: "高风险", count: 1 },
      { value: "medium", label: "中风险", count: 1 },
      { value: "low", label: "低风险", count: 1 },
    ]);
  });

  it("ignores unknown API values instead of producing broken badges", () => {
    const summary = getProjectDecisionSummary([
      makeDecision({ phase: "unknown_phase", risk_level: "unknown_risk" }),
      makeDecision({ id: "decision-2", phase: "approved", risk_level: "high" }),
    ]);

    expect(summary.totalCount).toBe(2);
    expect(summary.phaseStats).toEqual([
      { value: "approved", label: "已批准", count: 1 },
    ]);
    expect(summary.riskStats).toEqual([
      { value: "high", label: "高风险", count: 1 },
    ]);
  });
});
