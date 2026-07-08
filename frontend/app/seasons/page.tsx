"use client";

import { useMemo } from "react";
import Link from "next/link";
import { strings } from "@/strings";
import { useRounds, useCampaigns } from "@/lib/hooks";
import { RoundArchiveCard } from "@/components/RoundArchiveCard";

const s = strings.seasons;

/**
 * Seasons archive `/seasons`. A reverse-chronological ledger of every matching
 * round ever opened — the surface that reads the platform as an ongoing, multi-season product. One
 * full-width `RoundArchiveCard` per round (newest first); finalized rounds surface their top matched
 * campaigns inline, so the archive isn't a wall of identical cards. Four states off `useRounds`;
 * `useCampaigns` supplies the id→title map for the finalized leaderboards.
 */
export default function SeasonsPage() {
  const rounds = useRounds();
  const campaigns = useCampaigns();

  const ordered = useMemo(
    () => [...(rounds.data ?? [])].sort((a, b) => b.id - a.id),
    [rounds.data],
  );

  const titleOf = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of campaigns.data ?? []) m.set(c.id, c.title);
    return m;
  }, [campaigns.data]);

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
          {s.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{s.subtitle}</p>
      </header>

      <div className="mt-8">
        {rounds.data === undefined ? (
          rounds.isError ? (
            <ErrorPanel onRetry={() => rounds.refetch()} />
          ) : (
            <SkeletonList />
          )
        ) : ordered.length === 0 ? (
          <EmptyPanel />
        ) : (
          <>
            {rounds.isError ? (
              <p className="mb-3 text-xs text-amber-700">{strings.staleData}</p>
            ) : null}
            <div className="space-y-4">
              {ordered.map((r) => (
                <RoundArchiveCard key={r.id} round={r} titleOf={titleOf} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="h-6 w-32 animate-pulse rounded bg-line/50" />
            <div className="h-6 w-24 animate-pulse rounded bg-line/50" />
          </div>
          <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-line/50" />
          <div className="mt-5 border-t border-line pt-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-line/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{s.empty}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{s.emptyHint}</p>
      <Link
        href="/"
        className="mt-5 inline-block text-sm font-medium text-accent-ink underline underline-offset-4 hover:text-accent"
      >
        {strings.nav.landing}
      </Link>
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-ink">{strings.errorGeneric}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-sm font-medium text-accent-ink underline underline-offset-4 hover:text-accent"
      >
        {strings.retry}
      </button>
    </div>
  );
}
