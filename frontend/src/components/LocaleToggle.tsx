"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, type Locale } from "@/lib/locale";

/** Native self-name for each locale — shown in the dropdown menu, not translated per active locale. */
const LOCALE_NAMES: Record<Locale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
  fil: "Filipino",
  vi: "Tiếng Việt",
};

const LOCALES = Object.keys(LOCALE_NAMES) as Locale[];

/** Locale dropdown — replaces the old always-visible 4-button segmented control. */
export function LocaleToggle({ openUp = false }: { openUp?: boolean }) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Ganti bahasa"
        className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-sm font-black uppercase text-paper hover:bg-white/15"
      >
        {locale}
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          role="listbox"
          className={`glass-dark absolute right-0 z-50 w-44 rounded-xl p-1 ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={locale === l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                locale === l ? "text-lime" : "text-paper/80 hover:bg-white/8 hover:text-paper"
              }`}
            >
              {LOCALE_NAMES[l]}
              {locale === l ? <CheckIcon /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m1.5 1.5 4.5 5 4.5-5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-3.5 shrink-0"
    >
      <path d="m2.5 7.5 3 3 6-7" />
    </svg>
  );
}
