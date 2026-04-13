export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export type IssueAssigneeType = "member" | "agent";

export const DECISION_PHASES = [
  "identified",
  "diagnosing",
  "simulating",
  "recommending",
  "awaiting_approval",
  "approved",
  "executing",
  "monitoring",
  "closed",
] as const;

export type DecisionPhase = (typeof DECISION_PHASES)[number];

export const DECISION_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type DecisionRiskLevel = (typeof DECISION_RISK_LEVELS)[number];

export const DECISION_EXECUTION_MODES = [
  "manual",
  "semi_auto",
  "auto",
] as const;

export type DecisionExecutionMode = (typeof DECISION_EXECUTION_MODES)[number];

export interface IssueReaction {
  id: string;
  issue_id: string;
  actor_type: string;
  actor_id: string;
  emoji: string;
  created_at: string;
}

export interface Issue {
  id: string;
  workspace_id: string;
  number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_type: IssueAssigneeType | null;
  assignee_id: string | null;
  creator_type: IssueAssigneeType;
  creator_id: string;
  parent_issue_id: string | null;
  project_id: string | null;
  position: number;
  due_date: string | null;
  phase?: DecisionPhase | null;
  risk_level?: DecisionRiskLevel | null;
  execution_mode?: DecisionExecutionMode | null;
  decision_type?: string | null;
  object_type?: string | null;
  reactions?: IssueReaction[];
  created_at: string;
  updated_at: string;
}
