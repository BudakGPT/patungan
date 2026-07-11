"use client";

import Link from "next/link";
import { useStrings } from "@/lib/locale";
import { config } from "@/lib/config";
import { truncateAddress } from "@/lib/format";

/**
 * Top-level 404 in the brand register: an ink surface with the display-cut "404", a mono
 * machine chip naming the miss, and one lime CTA home. Client component so the copy follows
 * the active locale (campaign-level not-found is handled in-page; this catches every bad URL).
 */
export default function NotFound() {
  const strings = useStrings();
  const t = strings.notFound;

  return (
    <main className="relative flex min-h-[calc(100vh-6rem)] items-center overflow-hidden bg-ink px-4 py-20 text-paper sm:px-7 lg:px-10">
      <div className="chain-grid absolute inset-0 opacity-50" />
      <div className="relative mx-auto w-full max-w-[1500px]">
        <p className="mono text-[11px] font-bold text-white/60">{"// route — not compiled"}</p>
        <h1 className="display mt-4 text-[clamp(6rem,22vw,18rem)] leading-[.82]">404</h1>
        <h2 className="mt-6 text-2xl font-black sm:text-3xl">{t.title}</h2>
        <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-white/65">{t.body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/" className="btn btn-lime">
            {t.cta}
          </Link>
          <span className="hash-chip">contract: {truncateAddress(config.contractId)}</span>
        </div>
      </div>
    </main>
  );
}
