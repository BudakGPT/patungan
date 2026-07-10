"use client";

import Link from "next/link";
import { useStrings } from "@/lib/locale";
import { config } from "@/lib/config";
import { ContractExplorerLink } from "./ExplorerLink";

const shortId = (v: string) => `${v.slice(0, 4)}…${v.slice(-4)}`;

/**
 * Transparency footer as a brand signature: route index + the on-chain artifacts that back
 * every claim in the UI, signed off with an oversized wordmark bleeding out of the frame.
 */
export function Footer() {
  const strings = useStrings();
  return (
    <footer className="mt-auto overflow-hidden border-t border-lime/20 bg-ink text-paper">
      <div className="mx-auto max-w-[1500px] px-4 pt-12 sm:px-7 lg:px-10">
        <div className="grid gap-10 pb-12 md:grid-cols-[1.2fr_.8fr_1fr]">
          <div>
            <span className="text-xs font-black uppercase tracking-[.18em] text-lime/85">
              gotong royong on-chain
            </span>
            <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-white/60">
              {strings.footer.transparency}{" "}
              <span className="text-white/85">
                <ContractExplorerLink />
              </span>
            </p>
          </div>

          <nav aria-label="Peta situs" className="grid grid-cols-2 gap-x-8 gap-y-2 self-start text-sm font-bold">
            {[
              ["/", strings.nav.landing],
              ["/seasons", strings.nav.seasons],
              ["/results", strings.nav.results],
              ["/dashboard", strings.nav.dashboard],
              ["/account", strings.nav.account],
              ["/operator", strings.nav.operator],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-white/70 transition-colors hover:text-lime"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap content-start gap-2 md:justify-end">
            <span className="hash-chip">
              <span className="size-1.5 rounded-full bg-lime" />
              contract: {shortId(config.contractId)}
            </span>
            <span className="hash-chip">network: {config.network}</span>
            <span className="hash-chip">asset: {shortId(config.tokenId)}</span>
          </div>
        </div>
      </div>

      <div aria-hidden className="relative mx-auto max-w-[1500px] px-4 sm:px-7 lg:px-10">
        <p className="display -mb-[.24em] select-none whitespace-nowrap text-[clamp(4rem,12.5vw,13rem)] leading-none text-white/10">
          Patungan
        </p>
      </div>
    </footer>
  );
}
