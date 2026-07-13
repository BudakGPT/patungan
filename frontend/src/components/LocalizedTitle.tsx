"use client";

import { useEffect } from "react";
import { useStrings } from "@/lib/locale";
import type { Strings } from "@/strings.id";

/**
 * Localizes the browser-tab title for a route. The static `metadata` in each layout stays the
 * SSR/no-JS default (Bahasa, matching `<html lang="id">`); this reconciles `document.title` with
 * the reader's chosen locale once the client hydrates — the same client-only locale model as
 * `LocaleProvider`, since there is no URL-based i18n routing. Renders nothing.
 *
 * Mirrors the root metadata template `"%s | Patungan"` so client- and server-rendered titles read
 * identically.
 */
export function LocalizedTitle({ page }: { page: keyof Strings["meta"]["titles"] }) {
  const strings = useStrings();
  const title = strings.meta.titles[page];

  useEffect(() => {
    document.title = `${title} | ${strings.appName}`;
  }, [title, strings.appName]);

  return null;
}
