const DEFAULT_LOCALE = "zh-CN" as const;

const zhCnLexicon = {
  workspace: "业务空间",
  project: "专题",
  issue: "决策单",
  agent: "专家 Agent",
  runtime: "执行环境",
  skill: "技能包",
  comment: "协同记录",
  runMessages: "执行轨迹",
  inbox: "工作台",
  myIssues: "我的待办",
  issuesCenter: "决策单中心",
  projectsCenter: "项目中心",
  settings: "平台设置",
  decision: "决策",
  phase: "阶段",
  riskLevel: "风险等级",
  executionMode: "执行模式",
  decisionType: "决策类型",
  objectType: "对象类型",
  approval: "审批",
  connector: "连接器",
  simulation: "场景仿真",
  recommendation: "推荐方案",
  diagnosis: "诊断分析",
  snapshot: "指标快照",
  action: "动作执行",
  audit: "审计",
} as const;

export type LexiconKey = keyof typeof zhCnLexicon;
export type LexiconLocale = "zh-CN" | "en-US";

const enUsLexicon: Record<LexiconKey, string> = {
  workspace: "Workspace",
  project: "Project",
  issue: "Issue",
  agent: "Agents",
  runtime: "Runtimes",
  skill: "Skills",
  comment: "Comment",
  runMessages: "Run Messages",
  inbox: "Inbox",
  myIssues: "My Issues",
  issuesCenter: "Issues",
  projectsCenter: "Projects",
  settings: "Settings",
  decision: "Decision",
  phase: "Phase",
  riskLevel: "Risk Level",
  executionMode: "Execution Mode",
  decisionType: "Decision Type",
  objectType: "Object Type",
  approval: "Approval",
  connector: "Connector",
  simulation: "Simulation",
  recommendation: "Recommendation",
  diagnosis: "Diagnosis",
  snapshot: "Snapshot",
  action: "Action",
  audit: "Audit",
};

export const Lexicon: Record<LexiconLocale, Record<LexiconKey, string>> = {
  "en-US": enUsLexicon,
  "zh-CN": zhCnLexicon,
};

export function getDefaultLocale(): LexiconLocale {
  return DEFAULT_LOCALE;
}

export function getClientLocale(
  fallbackLocale: LexiconLocale = DEFAULT_LOCALE,
): LexiconLocale {
  if (typeof document === "undefined") {
    return fallbackLocale;
  }

  const match = document.cookie.match(/(?:^|;\s*)multica-locale=([^;]+)/);
  return normalizeLocale(match?.[1] ?? fallbackLocale);
}

export function normalizeLocale(locale: string): LexiconLocale {
  const normalized = locale.trim().toLowerCase();

  switch (normalized) {
    case "en":
    case "en-us":
      return "en-US";
    case "zh":
    case "zh-cn":
      return "zh-CN";
    default:
      return DEFAULT_LOCALE;
  }
}

export function t(key: LexiconKey, locale?: string): string {
  return Lexicon[normalizeLocale(locale ?? DEFAULT_LOCALE)][key];
}
