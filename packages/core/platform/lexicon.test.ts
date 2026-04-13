import { describe, expect, it } from "vitest";
import {
  Lexicon,
  getClientLocale,
  getDefaultLocale,
  normalizeLocale,
  t,
  type LexiconKey,
} from "./lexicon";
import {
  Lexicon as exportedLexicon,
  getClientLocale as exportedGetClientLocale,
  getDefaultLocale as exportedGetDefaultLocale,
  normalizeLocale as exportedNormalizeLocale,
  t as exportedT,
} from "./index";

const expectedEnUs = {
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
} satisfies Record<LexiconKey, string>;

const expectedZhCn = {
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
} satisfies Record<LexiconKey, string>;

describe("lexicon", () => {
  it("contains the full zh-CN and en-US mappings", () => {
    expect(Lexicon).toEqual({
      "en-US": expectedEnUs,
      "zh-CN": expectedZhCn,
    });
  });

  it("returns zh-CN as the default locale", () => {
    expect(getDefaultLocale()).toBe("zh-CN");
  });

  it("reads the current client locale from the locale cookie", () => {
    if (typeof document === "undefined") {
      return;
    }

    document.cookie = "multica-locale=en-US; path=/";

    expect(getClientLocale()).toBe("en-US");
  });

  it("normalizes supported locales and falls back to zh-CN", () => {
    expect(normalizeLocale("zh")).toBe("zh-CN");
    expect(normalizeLocale("zh-CN")).toBe("zh-CN");
    expect(normalizeLocale("en")).toBe("en-US");
    expect(normalizeLocale("en-US")).toBe("en-US");
    expect(normalizeLocale("fr-FR")).toBe("zh-CN");
  });

  it("translates keys with zh-CN as the default locale", () => {
    expect(t("workspace")).toBe("业务空间");
    expect(t("workspace", "en")).toBe("Workspace");
    expect(t("action", "en-US")).toBe("Action");
    expect(t("audit", "unknown")).toBe("审计");
  });

  it("re-exports the lexicon API from the platform index", () => {
    expect(exportedLexicon).toBe(Lexicon);
    expect(exportedGetClientLocale).toBe(getClientLocale);
    expect(exportedGetDefaultLocale).toBe(getDefaultLocale);
    expect(exportedNormalizeLocale).toBe(normalizeLocale);
    expect(exportedT).toBe(t);
  });
});
