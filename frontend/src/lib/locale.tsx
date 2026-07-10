"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { id } from "@/strings.id";
import { en } from "@/strings.en";
import type { Strings } from "@/strings.id";

export type Locale = "id" | "en";

const STORAGE_KEY = "patungan:locale";
const catalog: Record<Locale, Strings> = { id, en };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  strings: Strings;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "id" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "id";
}

/**
 * Bahasa is the SSR-safe initial value (matches `<html lang="id">` in layout.tsx). On mount, a
 * client-only effect reconciles with the stored preference or browser language — an
 * English-preferring first visit briefly renders Bahasa before flipping, the accepted tradeoff of
 * a localStorage-only locale with no URL routing.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const value = useMemo(() => ({ locale, setLocale, strings: catalog[locale] }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useStrings(): Strings {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useStrings must be used within LocaleProvider");
  return ctx.strings;
}
