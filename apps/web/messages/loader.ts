import {
  getDefaultLocale,
  normalizeLocale,
  type LexiconLocale,
} from "@multica/core/platform";
import enUSCommon from "./en-US/common.json";
import enUSNavigation from "./en-US/navigation.json";
import enUSSettings from "./en-US/settings.json";
import zhCNCommon from "./zh-CN/common.json";
import zhCNNavigation from "./zh-CN/navigation.json";
import zhCNSettings from "./zh-CN/settings.json";

export type MessageValue = string | MessageDictionary;
export type MessageDictionary = {
  [key: string]: MessageValue;
};
export type AppMessages = {
  common: typeof enUSCommon;
  navigation: typeof enUSNavigation;
  settings: typeof enUSSettings;
};

const localeMessages: Record<LexiconLocale, AppMessages> = {
  "en-US": {
    common: enUSCommon,
    navigation: enUSNavigation,
    settings: enUSSettings,
  },
  "zh-CN": {
    common: zhCNCommon,
    navigation: zhCNNavigation,
    settings: zhCNSettings,
  },
};

export function normalizeAppLocale(locale?: string | null): LexiconLocale {
  if (!locale?.trim()) {
    return getDefaultLocale();
  }

  return normalizeLocale(locale);
}

function isMessageDictionary(value: MessageValue | undefined): value is MessageDictionary {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeMessages(
  base: MessageDictionary,
  overrides: Partial<MessageDictionary>,
): MessageDictionary {
  const merged: MessageDictionary = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = merged[key];

    if (isMessageDictionary(baseValue) && isMessageDictionary(overrideValue)) {
      merged[key] = mergeMessages(baseValue, overrideValue);
      continue;
    }

    if (overrideValue !== undefined) {
      merged[key] = overrideValue;
    }
  }

  return merged;
}

export function getMessages(locale: string): AppMessages {
  const normalizedLocale = normalizeAppLocale(locale);
  return mergeMessages(
    localeMessages["en-US"],
    localeMessages[normalizedLocale],
  ) as AppMessages;
}
