"use client";

import { useEffect, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { RoundState } from "@/contract/src";
import { strings } from "@/strings";
import { formatIDR, truncateAddress, formatCountdown } from "@/lib/format";
import { categoryMeta } from "@/lib/category";

const d = strings.discovery;

/**
 * The current matching "season" as a status band — the page's one Committed-accent surface and
 * the "it's alive" anchor. Not a marketing hero: it reads pool, sponsor, in-scope categories, and
 * a live countdown to `round_end`. Renders all four states off the `useOpenRound` query (skeleton
 * while loading, a quiet empty band when no round is open, and never blanks cached data on a failed
 * background refetch).
 */
export function RoundBanner({ query }: { query: UseQueryResult<RoundState | null> }) {
  if (query.data === undefined) {
    if (query.isError) return <EmptyBand hint={strings.errorGeneric} />;
    return (
      <div className="h-32 w-full animate-pulse rounded-2xl bg-accent-soft" aria-hidden />
    );
  }
  const round = query.data;
  if (round === null) return <EmptyBand hint={d.noRoundHint} />;
  return <ActiveBand round={round} stale={query.isError} />;
}

function EmptyBand({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-7 shadow-card">
      <p className="text-base font-medium text-ink">{d.noRound}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

function ActiveBand({ round, stale }: { round: RoundState; stale: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = formatCountdown(round.round_end, d.countdown, now);
  const scope = round.categories.length === 0 ? null : round.categories;

  return (
    <div className="overflow-hidden rounded-2xl bg-accent text-on-accent shadow-card-hover">
      <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-on-accent/75">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-accent/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-on-accent" />
            </span>
            {d.season} #{round.id} · {d.live}
          </div>
          <p className="mt-3 text-sm text-on-accent/75">{strings.landing.poolLabel}</p>
          <p className="tabular text-[2.25rem] font-bold leading-none tracking-tight sm:text-5xl">
            {formatIDR(round.pool)}
          </p>
          <p className="mt-3 text-sm text-on-accent/80">
            {strings.landing.sponsorLabel}{" "}
            <span className="tabular font-medium text-on-accent">
              {truncateAddress(round.sponsor)}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end md:text-right">
          <div>
            <p className="text-xs uppercase tracking-widest text-on-accent/70">
              {countdown ? d.endsInLabel : d.endedLabel}
            </p>
            <p className="tabular mt-1 text-xl font-semibold">
              {countdown ?? d.countdown.ended}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 md:justify-end">
            <span className="text-xs text-on-accent/70">{d.scopeLabel}:</span>
            {scope === null ? (
              <span className="rounded-full bg-on-accent/15 px-2 py-0.5 text-xs font-medium">
                {d.scopeAll}
              </span>
            ) : (
              scope.map((c) => (
                <span
                  key={c.tag}
                  className="rounded-full bg-on-accent/15 px-2 py-0.5 text-xs font-medium"
                >
                  {categoryMeta(c.tag).label}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      {stale ? (
        <p className="bg-accent-ink/40 px-6 py-1 text-center text-[0.6875rem] text-on-accent/80 sm:px-8">
          {strings.staleData}
        </p>
      ) : null}
    </div>
  );
}
