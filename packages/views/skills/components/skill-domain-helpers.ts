// Domain keyword mapping for supply chain skills
export const SKILL_DOMAINS = {
  supply_chain: { keywords: ["供应链", "供应", "supply"], label: "供应链", color: "blue" },
  inventory: { keywords: ["库存", "仓储", "inventory", "warehouse"], label: "库存管理", color: "green" },
  procurement: { keywords: ["采购", "寻源", "procurement", "sourcing"], label: "采购", color: "orange" },
  logistics: { keywords: ["物流", "配送", "logistics", "distribution"], label: "物流", color: "purple" },
  forecasting: { keywords: ["预测", "需求", "forecast", "demand"], label: "需求预测", color: "cyan" },
  risk: { keywords: ["风险", "预警", "risk", "alert"], label: "风险管理", color: "red" },
  analytics: { keywords: ["数据", "分析", "data", "analytics"], label: "数据分析", color: "teal" },
} as const;

type SkillDomainKey = keyof typeof SKILL_DOMAINS;

export function detectSkillDomains(name: string, description?: string): string[] {
  const haystack = `${name} ${description ?? ""}`.toLowerCase();

  return (Object.entries(SKILL_DOMAINS) as [SkillDomainKey, (typeof SKILL_DOMAINS)[SkillDomainKey]][])
    .filter(([, domain]) => domain.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
    .map(([domain]) => domain)
    .slice(0, 2);
}

export function getSkillDomainBadge(domain: string): { label: string; color: string } {
  const config = SKILL_DOMAINS[domain as SkillDomainKey];

  if (!config) {
    return { label: "通用", color: "gray" };
  }

  return { label: config.label, color: config.color };
}
