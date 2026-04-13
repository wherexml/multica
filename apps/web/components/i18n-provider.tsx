"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Lexicon,
  type LexiconKey,
  type LexiconLocale,
} from "@multica/core/platform";
import { getMessages, normalizeAppLocale, type MessageDictionary } from "@/messages/loader";

const COOKIE_NAME = "multica-locale";

type I18nContextValue = {
  locale: LexiconLocale;
  t: (key: string) => string;
  setLocale: (locale: string) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readLocaleCookie(cookieValue: string): string | undefined {
  const match = cookieValue.match(/(?:^|;\s*)multica-locale=([^;]+)/);
  return match?.[1];
}

function resolveInitialLocale(): LexiconLocale {
  if (typeof document === "undefined") {
    return normalizeAppLocale(undefined);
  }

  return normalizeAppLocale(readLocaleCookie(document.cookie));
}

function getMessageByPath(messages: MessageDictionary, key: string): string | undefined {
  const segments = key.split(".");
  let currentValue: MessageDictionary | string | undefined = messages;

  for (const segment of segments) {
    if (typeof currentValue !== "object" || currentValue === null) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return typeof currentValue === "string" ? currentValue : undefined;
}

function isLexiconKey(key: string): key is LexiconKey {
  return key in Lexicon["zh-CN"];
}

function writeLocaleCookie(locale: LexiconLocale) {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LexiconLocale>(() => resolveInitialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (nextLocale: string) => {
    const normalizedLocale = normalizeAppLocale(nextLocale);
    setLocaleState(normalizedLocale);
    writeLocaleCookie(normalizedLocale);
  };

  const messages = getMessages(locale);

  const t = (key: string) => {
    const message = getMessageByPath(messages, key);

    if (message) {
      return message;
    }

    if (isLexiconKey(key)) {
      return Lexicon[locale][key];
    }

    return key;
  };

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
}
