import { deduplicateInboxItems } from "@multica/core/inbox/queries";
import type { DecisionCase, InboxItem, Issue, IssueStatus } from "@multica/core/types";

const ALERT_SEVERITIES = new Set(["action_required", "attention"]);
const TODO_DONE_STATUSES = new Set<IssueStatus>(["done", "cancelled"]);
const INACTIVE_DECISION_PHASES = new Set(["closed", "identified"]);

export interface AlertFilters {
  domain: string;
  riskLevel: string;
}

export interface DashboardStats {
  todos: number;
  alerts: number;
  pendingApproval: number;
  activeDecisions: number;
}

function isActiveInboxItem(item: InboxItem): boolean {
  return !item.archived;
}

function isAlertItem(item: InboxItem): boolean {
  return isActiveInboxItem(item) && ALERT_SEVERITIES.has(item.severity);
}

function matchesAlertFilter(
  item: InboxItem,
  decisionsById: Map<string, DecisionCase>,
  filters: AlertFilters,
): boolean {
  if (!item.issue_id) return filters.domain === "all" && filters.riskLevel === "all";

  const decision = decisionsById.get(item.issue_id);
  if (!decision) return filters.domain === "all" && filters.riskLevel === "all";

  if (filters.domain !== "all" && decision.domain !== filters.domain) return false;
  if (filters.riskLevel !== "all" && decision.risk_level !== filters.riskLevel) return false;

  return true;
}

export function getTodoItems(issues: Issue[]): Issue[] {
  return issues
    .filter((issue) => !TODO_DONE_STATUSES.has(issue.status))
    .slice(0, 5);
}

export function getDashboardStats({
  inboxItems,
  myIssues,
  decisions,
}: {
  inboxItems: InboxItem[];
  myIssues: Issue[];
  decisions: DecisionCase[];
}): DashboardStats {
  return {
    todos: getTodoItems(myIssues).length,
    alerts: inboxItems.filter((item) => isAlertItem(item) && !item.read).length,
    pendingApproval: decisions.filter((decision) => decision.approval_status === "pending").length,
    activeDecisions: decisions.filter((decision) => !INACTIVE_DECISION_PHASES.has(decision.phase)).length,
  };
}

export function getAlertItems(
  inboxItems: InboxItem[],
  decisions: DecisionCase[],
  filters: AlertFilters,
): InboxItem[] {
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));

  return inboxItems
    .filter((item) => isAlertItem(item) && matchesAlertFilter(item, decisionsById, filters))
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
}

export function getAlertFilterOptions(inboxItems: InboxItem[], decisions: DecisionCase[]) {
  const alertIssueIds = new Set(
    inboxItems
      .filter(isAlertItem)
      .map((item) => item.issue_id)
      .filter((issueId): issueId is string => Boolean(issueId)),
  );

  const linkedDecisions = decisions.filter((decision) => alertIssueIds.has(decision.id));

  return {
    domains: Array.from(new Set(linkedDecisions.map((decision) => decision.domain))).sort(),
    riskLevels: Array.from(new Set(linkedDecisions.map((decision) => decision.risk_level))).sort(),
  };
}

export function getRecentActivityItems(inboxItems: InboxItem[]): InboxItem[] {
  return deduplicateInboxItems(inboxItems);
}

export function getDecisionByIssueId(decisions: DecisionCase[]) {
  return new Map(decisions.map((decision) => [decision.id, decision]));
}
