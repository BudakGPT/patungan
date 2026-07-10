"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RoundState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { formatIDR, truncateAddress, formatCountdown } from "@/lib/format";
import { CategoryChip } from "./CategoryChip";
import { usePreviewRound } from "@/lib/hooks";

/**
 * One round in the `/seasons` archive. A full-width ledger row, not a grid card:
 * the header carries `Musim #id` + a status pill and right-anchors the pool figure; the body varies
 * by status so seasons never read as a repeated template. Finalized rounds show a top-3 matched
 * leaderboard (the "it's alive" payload, read from `preview_round` which equals stored `RoundMatched`
 * post-finalize); Open rounds show a live countdown; Cancelled rounds stay a single honest line.
 * The whole row links to `/results?round=<id>`.
 */
export function RoundArchiveCard({
  round,
  titleOf,
}: {
  round: RoundState;
  /** project id → campaign title, so the leaderboard names campaigns without a per-row read. */
  titleOf: Map<number, string>;
}) {
  const strings = useStrings();
  const s = strings.seasons;
  const status = round.status.tag;
  const pillTone =
    status === "Open"
      ? "bg-accent-soft text-accent-ink"
      : status === "Finalized"
        ? "bg-match-soft text-match-ink"
        : "bg-line/60 text-muted";

  const scope = round.categories;

  return (
    <Link
      href={`/results?round=${round.id}`}
      className="group block rounded-2xl border border-line bg-surface p-5 shadow-card transition duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card-hover sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">{s.seasonLabel(round.id)}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pillTone}`}>
              {s.status[status] ?? status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {s.sponsorLabel}{" "}
            <span className="tabular font-medium text-ink">{truncateAddress(round.sponsor)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.6875rem] uppercase tracking-wide text-faint">{s.poolLabel}</p>
          <p className="tabular mt-0.5 text-xl font-bold text-ink">{formatIDR(round.pool)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-faint">{s.scopeLabel}:</span>
        {scope.length === 0 ? (
          <span className="rounded-full bg-line/50 px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
            {s.scopeAll}
          </span>
        ) : (
          scope.map((c) => <CategoryChip key={c.tag} tag={c.tag} />)
        )}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {status === "Finalized" ? (
          <Leaderboard roundId={round.id} titleOf={titleOf} />
        ) : status === "Open" ? (
          <OpenLine round={round} />
        ) : (
          <p className="text-sm text-muted">{s.cancelledNote}</p>
        )}
      </div>
    </Link>
  );
}

/** Top-3 matched campaigns for a finalized round, from the round's QF split. */
function Leaderboard({ roundId, titleOf }: { roundId: number; titleOf: Map<number, string> }) {
  const strings = useStrings();
  const s = strings.seasons;
  const preview = usePreviewRound(roundId);

  if (preview.data === undefined) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-line/50" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-line/50" />
      </div>
    );
  }

  const top = [...preview.data]
    .filter(([, matched]) => matched > 0n)
    .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
    .slice(0, 3);

  if (top.length === 0) {
    return <p className="text-sm text-muted">{s.noMatches}</p>;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-faint">{s.topHeading}</p>
      <ul className="mt-2.5 space-y-1.5">
        {top.map(([pid, matched]) => (
          <li key={Number(pid)} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">
              {titleOf.get(Number(pid)) ?? `#${Number(pid)}`}
            </span>
            <span className="tabular shrink-0 font-semibold text-match-ink">
              +{formatIDR(matched)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium text-accent-ink transition-colors group-hover:text-accent">
        {s.viewResults} &rarr;
      </p>
    </div>
  );
}

/** The open round's live line: a countdown to `round_end` and a "projection running" note. */
function OpenLine({ round }: { round: RoundState }) {
  const strings = useStrings();
  const s = strings.seasons;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = formatCountdown(round.round_end, s.countdown, now);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted">
        <span className="text-faint">{countdown ? s.liveEndsIn : s.liveEnded}</span>
        {countdown ? <span className="tabular ml-2 font-semibold text-ink">{countdown}</span> : null}
      </p>
      <p className="text-xs font-medium text-accent-ink transition-colors group-hover:text-accent">
        {s.liveProjection} &rarr;
      </p>
    </div>
  );
}
