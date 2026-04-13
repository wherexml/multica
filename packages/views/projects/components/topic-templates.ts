import type { ProjectPriority } from "@multica/core/types";

export interface TopicTemplate {
  id: string;
  name: string;
  description: string;
  priority: ProjectPriority;
}

export const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    id: "hot-product-supply-assurance",
    name: "爆品保供",
    description:
      "聚焦核心爆品的供需缺口、产能约束和补货节奏，快速识别断供风险并推动跨部门保供决策。",
    priority: "urgent",
  },
  {
    id: "regional-inventory-balance",
    name: "区域库存平衡",
    description:
      "聚焦区域间库存结构失衡、调拨优先级和交付影响，统筹制定调拨、补货与库存平衡方案。",
    priority: "high",
  },
  {
    id: "supplier-risk-management",
    name: "供应商风险管理",
    description:
      "持续跟踪关键供应商的交付、质量和产能波动，形成预警、替代与缓解动作的闭环管理。",
    priority: "urgent",
  },
  {
    id: "forecast-correction-program",
    name: "预测修正专项",
    description:
      "针对预测偏差较大的品类或渠道，联动销售、运营和供应计划完成预测修正与执行跟踪。",
    priority: "medium",
  },
];

export function getTopicTemplateById(id: string) {
  return TOPIC_TEMPLATES.find((template) => template.id === id);
}
