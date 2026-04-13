import { describe, expect, it } from "vitest";
import {
  SettingsMessages,
  getSettingsLocale,
  settingsT,
  type SettingsMessageKey,
} from "./settings-messages";
import {
  SettingsMessages as exportedSettingsMessages,
  getSettingsLocale as exportedGetSettingsLocale,
  settingsT as exportedSettingsT,
} from "./index";

describe("settings messages", () => {
  it("keeps zh-CN and en-US keys in sync", () => {
    const zhKeys = Object.keys(SettingsMessages["zh-CN"]).sort();
    const enKeys = Object.keys(SettingsMessages["en-US"]).sort();

    expect(zhKeys).toEqual(enKeys);
    expect(zhKeys.length).toBeGreaterThan(80);
  });

  it("translates settings keys and interpolates params", () => {
    expect(settingsT("settings.title", "zh-CN")).toBe("平台设置");
    expect(settingsT("settings.title", "en-US")).toBe("Settings");
    expect(
      settingsT("settings.members.titleWithCount", "zh-CN", { count: "3" }),
    ).toBe("成员管理 (3)");
    expect(
      settingsT("settings.tokens.meta.created", "en-US", { date: "04/13/2026" }),
    ).toBe("Created 04/13/2026");
  });

  it("falls back to the lexicon and then to the key itself", () => {
    expect(settingsT("workspace", "zh-CN")).toBe("业务空间");
    expect(settingsT("workspace", "en-US")).toBe("Workspace");
    expect(settingsT("settings.unknown.key", "en-US")).toBe("settings.unknown.key");
  });

  it("uses zh-CN as the server-side locale default", () => {
    expect(getSettingsLocale()).toBe("zh-CN");
  });

  it("re-exports the settings message helpers from the platform index", () => {
    expect(exportedSettingsMessages).toBe(SettingsMessages);
    expect(exportedGetSettingsLocale).toBe(getSettingsLocale);
    expect(exportedSettingsT).toBe(settingsT);
  });

  it("keeps the settings message key type aligned with the catalog", () => {
    const sampleKey: SettingsMessageKey = "settings.workspace.delete.dialogTitle";

    expect(SettingsMessages["en-US"][sampleKey]).toBe("Delete workspace");
  });
});
