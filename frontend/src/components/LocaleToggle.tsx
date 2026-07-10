"use client";

import { useLocale } from "@/lib/locale";

/** Locale pill, styled to match the header's dark-chrome pills (WalletButton, nav-pill). */
export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center overflow-hidden rounded-full border border-white/20 bg-white/8 text-sm font-black text-paper">
      {(["id", "en", "fil", "vi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`px-3 py-1.5 uppercase transition-colors ${
            locale === l ? "bg-lime text-ink" : "text-paper/70 hover:text-paper"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
