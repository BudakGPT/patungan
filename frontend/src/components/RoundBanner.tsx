"use client";

import { useEffect, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { RoundState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { formatIDR, truncateAddress, formatCountdown } from "@/lib/format";
import { categoryMeta } from "@/lib/category";

/**
 * The current matching "season" as a status band — the page's one Committed-accent surface and
 * the "it's alive" anchor. Not a marketing hero: it reads pool, sponsor, in-scope categories, and
 * a live countdown to `round_end`. Renders all four states off the `useOpenRound` query (skeleton
 * while loading, a quiet empty band when no round is open, and never blanks cached data on a failed
 * background refetch).
 */
export function RoundBanner({ query }: { query: UseQueryResult<RoundState | null> }) {
  const strings = useStrings();
  if (query.data === undefined) {
    if (query.isError) return <EmptyBand hint={strings.errorGeneric} />;
    return (
      <div className="skeleton h-32 w-full rounded-2xl" aria-hidden />
    );
  }
  const round = query.data;
  if (round === null) return <EmptyBand hint={strings.discovery.noRoundHint} />;
  return <ActiveBand round={round} stale={query.isError} />;
}

function EmptyBand({ hint }: { hint: string }) {
  const strings = useStrings();
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-7 shadow-card">
      <p className="text-base font-medium text-ink">{strings.discovery.noRound}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

function ActiveBand({ round, stale }: { round: RoundState; stale: boolean }) {
  const strings = useStrings();
  const d = strings.discovery;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = formatCountdown(round.round_end, d.countdown, now);
  const scope = round.categories.length === 0 ? null : round.categories;

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-ink text-paper shadow-award">
      <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[.16em] text-lime">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
            </span>
            {d.season} #{round.id} · {d.live}
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-white/55">
            {strings.landing.poolLabel}
          </p>
          <p className="tabular mt-1 text-[2.25rem] font-black leading-none tracking-tight text-lime sm:text-5xl">
            {formatIDR(round.pool)}
          </p>
          <p className="mt-3 text-sm font-semibold text-white/60">
            {strings.landing.sponsorLabel}{" "}
            <span className="mono text-white/85">{truncateAddress(round.sponsor)}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end md:text-right">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-white/55">
              {countdown ? d.endsInLabel : d.endedLabel}
            </p>
            <p className="tabular mt-1 text-2xl font-black">
              {countdown ?? d.countdown.ended}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
            <span className="text-xs font-semibold text-white/55">{d.scopeLabel}:</span>
            {scope === null ? (
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80">
                {d.scopeAll}
              </span>
            ) : (
              scope.map((c) => (
                <span
                  key={c.tag}
                  className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80"
                >
                  {categoryMeta(c.tag, strings.categories).label}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      {stale ? (
        <p className="bg-white/10 px-6 py-1 text-center text-[0.6875rem] text-white/70 sm:px-8">
          {strings.staleData}
        </p>
      ) : null}
    </div>
  );
}
