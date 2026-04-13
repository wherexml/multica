import { describe, expect, it } from "vitest";
import { getTopicTemplateById, TOPIC_TEMPLATES } from "./topic-templates";

describe("TOPIC_TEMPLATES", () => {
  it("provides the recommended topic templates with Chinese defaults", () => {
    expect(
      TOPIC_TEMPLATES.map(({ id, name, priority }) => ({ id, name, priority })),
    ).toEqual([
      {
        id: "hot-product-supply-assurance",
        name: "爆品保供",
        priority: "urgent",
      },
      {
        id: "regional-inventory-balance",
        name: "区域库存平衡",
        priority: "high",
      },
      {
        id: "supplier-risk-management",
        name: "供应商风险管理",
        priority: "urgent",
      },
      {
        id: "forecast-correction-program",
        name: "预测修正专项",
        priority: "medium",
      },
    ]);

    expect(TOPIC_TEMPLATES[0]?.description).toContain("保供");
    expect(TOPIC_TEMPLATES[1]?.description).toContain("库存");
    expect(TOPIC_TEMPLATES[2]?.description).toContain("供应商");
    expect(TOPIC_TEMPLATES[3]?.description).toContain("预测");
  });

  it("returns a template by id for optional prefills", () => {
    expect(getTopicTemplateById("supplier-risk-management")?.name).toBe(
      "供应商风险管理",
    );
    expect(getTopicTemplateById("unknown-template")).toBeUndefined();
  });
});
