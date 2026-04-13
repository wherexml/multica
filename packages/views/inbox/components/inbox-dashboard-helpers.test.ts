import { describe, expect, it } from "vitest";

import type { DecisionCase, InboxItem, Issue } from "@multica/core/types";

import {
  getAlertItems,
  getAlertFilterOptions,
  getDashboardStats,
  getTodoItems,
} from "./inbox-dashboard-helpers";

const inboxItems: InboxItem[] = [
  {
    id: "inbox-1",
    workspace_id: "ws-1",
    recipient_type: "member",
    recipient_id: "user-1",
    actor_type: "member",
    actor_id: "actor-1",
    type: "task_failed",
    severity: "action_required",
    issue_id: "issue-1",
    title: "供应链价格波动超阈值",
    body: "建议立即复盘采购策略",
    issue_status: "blocked",
    read: false,
    archived: false,
    created_at: "2026-04-13T09:00:00.000Z",
    details: null,
  },
  {
    id: "inbox-2",
    workspace_id: "ws-1",
    recipient_type: "member",
    recipient_id: "user-1",
    actor_type: "agent",
    actor_id: "agent-1",
    type: "agent_blocked",
    severity: "attention",
    issue_id: "issue-2",
    title: "库存预测出现偏差",
    body: "模型建议补充校验口径",
    issue_status: "in_progress",
    read: false,
    archived: false,
    created_at: "2026-04-13T08:00:00.000Z",
    details: null,
  },
  {
    id: "inbox-3",
    workspace_id: "ws-1",
    recipient_type: "member",
    recipient_id: "user-1",
    actor_type: "member",
    actor_id: "actor-2",
    type: "mentioned",
    severity: "info",
    issue_id: "issue-3",
    title: "补充会议纪要",
    body: "请查看最新备注",
    issue_status: "todo",
    read: false,
    archived: false,
    created_at: "2026-04-13T07:00:00.000Z",
    details: null,
  },
  {
    id: "inbox-4",
    workspace_id: "ws-1",
    recipient_type: "member",
    recipient_id: "user-1",
    actor_type: "member",
    actor_id: "actor-3",
    type: "task_failed",
    severity: "action_required",
    issue_id: "issue-4",
    title: "历史归档告警",
    body: "这条数据不该被统计",
    issue_status: "blocked",
    read: false,
    archived: true,
    created_at: "2026-04-13T06:00:00.000Z",
    details: null,
  },
];

const decisions: DecisionCase[] = [
  {
    id: "issue-1",
    title: "供应链策略调整",
    description: null,
    status: "in_progress",
    priority: "high",
    assignee_type: "member",
    assignee_id: "user-1",
    created_at: "2026-04-13T09:00:00.000Z",
    updated_at: "2026-04-13T09:30:00.000Z",
    domain: "supply_chain",
    decision_type: "strategy",
    object_type: "project",
    object_id: "project-1",
    objective: "控制采购波动",
    constraints: "预算稳定",
    risk_level: "high",
    execution_mode: "manual",
    phase: "evaluating",
    approval_status: "pending",
    execution_status: "not_started",
    project_id: null,
  },
  {
    id: "issue-2",
    title: "库存预测修正",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_type: "member",
    assignee_id: "user-1",
    created_at: "2026-04-13T08:00:00.000Z",
    updated_at: "2026-04-13T08:30:00.000Z",
    domain: "finance",
    decision_type: "ops",
    object_type: "metric",
    object_id: "metric-1",
    objective: "降低库存偏差",
    constraints: "不影响交付",
    risk_level: "critical",
    execution_mode: "auto",
    phase: "identified",
    approval_status: "approved",
    execution_status: "running",
    project_id: null,
  },
  {
    id: "issue-5",
    title: "渠道投放复盘",
    description: null,
    status: "todo",
    priority: "low",
    assignee_type: "member",
    assignee_id: "user-2",
    created_at: "2026-04-12T08:00:00.000Z",
    updated_at: "2026-04-12T08:30:00.000Z",
    domain: "marketing",
    decision_type: "ops",
    object_type: "project",
    object_id: "project-2",
    objective: "优化线索成本",
    constraints: "维持转化率",
    risk_level: "medium",
    execution_mode: "manual",
    phase: "closed",
    approval_status: "pending",
    execution_status: "completed",
    project_id: null,
  },
];

const myIssues: Issue[] = Array.from({ length: 7 }, (_, index) => ({
  id: `todo-${index + 1}`,
  workspace_id: "ws-1",
  number: index + 1,
  identifier: `ISS-${index + 1}`,
  title: `待办 ${index + 1}`,
  description: null,
  status: index === 5 ? "done" : index === 6 ? "cancelled" : "todo",
  priority: "medium",
  assignee_type: "member",
  assignee_id: "user-1",
  creator_type: "member",
  creator_id: "user-1",
  parent_issue_id: null,
  project_id: null,
  position: index,
  due_date: null,
  created_at: "2026-04-13T09:00:00.000Z",
  updated_at: "2026-04-13T09:00:00.000Z",
}));

describe("inbox dashboard helpers", () => {
  it("computes stats with the expected business rules", () => {
    expect(
      getDashboardStats({
        inboxItems,
        myIssues,
        decisions,
      }),
    ).toEqual({
      todos: 5,
      alerts: 2,
      pendingApproval: 2,
      activeDecisions: 1,
    });
  });

  it("filters alert cards by business domain and risk level", () => {
    expect(
      getAlertItems(inboxItems, decisions, {
        domain: "supply_chain",
        riskLevel: "all",
      }).map((item) => item.id),
    ).toEqual(["inbox-1"]);

    expect(
      getAlertItems(inboxItems, decisions, {
        domain: "all",
        riskLevel: "critical",
      }).map((item) => item.id),
    ).toEqual(["inbox-2"]);
  });

  it("builds dropdown options from decision-linked alerts", () => {
    expect(getAlertFilterOptions(inboxItems, decisions)).toEqual({
      domains: ["finance", "supply_chain"],
      riskLevels: ["critical", "high"],
    });
  });

  it("returns only the top five actionable todos", () => {
    expect(getTodoItems(myIssues).map((issue) => issue.id)).toEqual([
      "todo-1",
      "todo-2",
      "todo-3",
      "todo-4",
      "todo-5",
    ]);
  });
});
