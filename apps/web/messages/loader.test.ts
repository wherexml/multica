import { describe, expect, it } from "vitest";
import { getMessages, mergeMessages, normalizeAppLocale } from "./loader";

describe("message loader", () => {
  it("normalizes supported locale aliases and defaults to zh-CN", () => {
    expect(normalizeAppLocale("zh")).toBe("zh-CN");
    expect(normalizeAppLocale("zh-CN")).toBe("zh-CN");
    expect(normalizeAppLocale("en")).toBe("en-US");
    expect(normalizeAppLocale("en-US")).toBe("en-US");
    expect(normalizeAppLocale("fr-FR")).toBe("zh-CN");
  });

  it("loads merged zh-CN dashboard messages", () => {
    const messages = getMessages("zh");

    expect(messages.common.save).toBe("保存");
    expect(messages.navigation.inbox).toBe("工作台");
    expect(messages.settings.title).toBe("平台设置");
  });

  it("fills missing nested keys from the en-US fallback bundle", () => {
    const merged = mergeMessages(
      {
        common: {
          cancel: "Cancel",
          save: "Save",
        },
        settings: {
          title: "Settings",
        },
      },
      {
        common: {
          save: "保存",
        },
      },
    );

    expect(merged).toEqual({
      common: {
        cancel: "Cancel",
        save: "保存",
      },
      settings: {
        title: "Settings",
      },
    });
  });
});
