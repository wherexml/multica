"use client";

import { useEffect } from "react";
import { normalizeAppLocale } from "@/messages/loader";

function readLocaleCookie(cookieValue: string): string | undefined {
  const match = cookieValue.match(/(?:^|;\s*)multica-locale=([^;]+)/);
  return match?.[1];
}

/**
 * Reads the locale cookie on the client and updates <html lang>.
 * This avoids calling cookies() in the root Server Component layout,
 * which would mark the entire app as dynamic and disable the Router Cache.
 */
export function LocaleSync() {
  useEffect(() => {
    const locale = normalizeAppLocale(readLocaleCookie(document.cookie));
    document.documentElement.lang = locale;
  }, []);

  return null;
}
