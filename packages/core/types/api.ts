import type { Issue, IssueStatus, IssuePriority, IssueAssigneeType } from "./issue";
import type { MemberRole } from "./workspace";
import type { Project } from "./project";

// Issue API
export interface CreateIssueRequest {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_type?: IssueAssigneeType;
  assignee_id?: string;
  parent_issue_id?: string;
  project_id?: string;
  due_date?: string;
  attachment_ids?: string[];
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_type?: IssueAssigneeType | null;
  assignee_id?: string | null;
  position?: number;
  due_date?: string | null;
  parent_issue_id?: string | null;
  project_id?: string | null;
}

export interface ListIssuesParams {
  limit?: number;
  offset?: number;
  workspace_id?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_id?: string;
  assignee_ids?: string[];
  creator_id?: string;
  open_only?: boolean;
}

export interface ListIssuesResponse {
  issues: Issue[];
  total: number;
  /** True total of done issues in the workspace (for load-more pagination). Not returned by backend API — set by the frontend query function. */
  doneTotal?: number;
}

export interface DecisionCase {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_type: IssueAssigneeType | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  domain: string;
  decision_type: string;
  object_type: string;
  object_id: string;
  objective: string;
  constraints: string;
  risk_level: string;
  execution_mode: string;
  phase: string;
  approval_status: string;
  execution_status: string;
  project_id: string | null;
}

export interface DecisionSnapshotSummary {
  id: string;
  source: string;
  source_ref: string;
  captured_at: string;
  created_at: string;
}

export interface DecisionRecommendationSummary {
  id: string;
  scenario_option_id: string | null;
  title: string;
  expected_impact: string;
  created_at: string;
}

export interface DecisionApprovalSummary {
  id: string;
  approver_type: string;
  approver_id: string;
  status: string;
  comment: string;
  sort_order: number;
  updated_at: string;
}

export interface DecisionDetail extends DecisionCase {
  latest_snapshot?: DecisionSnapshotSummary | null;
  latest_recommendation?: DecisionRecommendationSummary | null;
  latest_approval?: DecisionApprovalSummary | null;
}

export interface ListDecisionsParams {
  page?: number;
  page_size?: number;
  phase?: string;
  risk_level?: string;
  execution_mode?: string;
  decision_type?: string;
  object_type?: string;
  project_id?: string;
}

export interface ListDecisionsResponse {
  decisions: DecisionCase[];
  total: number;
}

export interface SearchIssueResult extends Issue {
  match_source: "title" | "description" | "comment";
  matched_snippet?: string;
}

export interface SearchIssuesResponse {
  issues: SearchIssueResult[];
  total: number;
}

export interface SearchProjectResult extends Project {
  match_source: "title" | "description";
  matched_snippet?: string;
}

export interface SearchProjectsResponse {
  projects: SearchProjectResult[];
  total: number;
}

export interface UpdateMeRequest {
  name?: string;
  avatar_url?: string;
}

export interface CreateMemberRequest {
  email: string;
  role?: MemberRole;
}

export interface UpdateMemberRequest {
  role: MemberRole;
}

// Personal Access Tokens
export interface PersonalAccessToken {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface CreatePersonalAccessTokenRequest {
  name: string;
  expires_in_days?: number;
}

export interface CreatePersonalAccessTokenResponse extends PersonalAccessToken {
  token: string;
}

// Pagination
export interface PaginationParams {
  limit?: number;
  offset?: number;
}
