"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RoundState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { formatIDR } from "@/lib/format";
import { CategoryChip } from "@/components/CategoryChip";
import { useRounds, useCampaigns, usePreviewRound, useRoundProjects } from "@/lib/hooks";
import { isDemoArtifact } from "@/lib/demo";
import { CountUp, Reveal } from "@/components/motion";
import { SelectMenu } from "@/components/SelectMenu";

const descBig = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0);

/**
 * Round-scoped results `/results?round=`. The app's one "magic number" moment:
 * the quadratic split for a single season, rendered as per-campaign direct-vs-matched bars ranked by
 * matched descending, so the campaign that won on *pendukung* (donor count) not rupiah sits on top.
 * Defaults to the latest finalized round (else the open round's live `preview_round`). The whole page
 * is client-side (wallet-free reads), so `useSearchParams` needs a Suspense boundary to build.
 */
export default function ResultsPage() {
  const strings = useStrings();
  const r = strings.results;
  return (
    <main className="bg-cream text-ink">
      <section className="relative overflow-hidden bg-ink px-4 py-14 text-paper sm:px-7 lg:px-10">
        <div className="chain-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-[1500px]">
          <Reveal mode="load" y={16}>
            <span className="tag">Live reveal</span>
          </Reveal>
          <Reveal mode="load" delay={0.08} y={40}>
            <h1 className="display mt-4 text-[clamp(2.3rem,9.8vw,6.4rem)] leading-[.86]">
              {r.title}
            </h1>
          </Reveal>
          <Reveal mode="load" delay={0.18}>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-white/65">
              {r.verdict}
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
        <Suspense fallback={<PageSkeleton />}>
          <ResultsInner />
        </Suspense>
      </div>
    </main>
  );
}

function ResultsInner() {
  const strings = useStrings();
  const r = strings.results;
  const rounds = useRounds();
  const searchParams = useSearchParams();
  const paramRaw = searchParams.get("round");

  // Default when no ?round=: newest Finalized → the Open round → newest of any status.
  const list = rounds.data;
  const defaultId = useMemo(() => {
    if (!list || list.length === 0) return null;
    const finalized = list.filter((x) => x.status.tag === "Finalized").sort((a, b) => b.id - a.id);
    if (finalized.length) return finalized[0].id;
    const open = list.find((x) => x.status.tag === "Open");
    if (open) return open.id;
    return [...list].sort((a, b) => b.id - a.id)[0].id;
  }, [list]);

  if (list === undefined) {
    return rounds.isError ? <ErrorPanel onRetry={() => rounds.refetch()} /> : <PageSkeleton />;
  }
  if (list.length === 0) {
    return <NotFound title={r.notFoundTitle} body={r.noRounds} />;
  }

  const selectedId = paramRaw !== null ? Number(paramRaw) : defaultId;
  const round = list.find((x) => x.id === selectedId);
  if (round === undefined) {
    return <NotFound title={r.notFoundTitle} body={r.notFoundBody} />;
  }

  return <RoundResults key={round.id} round={round} rounds={list} />;
}

function RoundResults({ round, rounds }: { round: RoundState; rounds: RoundState[] }) {
  const strings = useStrings();
  const r = strings.results;
  const finalized = round.status.tag === "Finalized";
  // A finalized round's split is stored on-chain and immutable — fetch it once and never
  // repoll, so final figures can't drift on screen. Open rounds keep the live projection poll.
  const preview = usePreviewRound(round.id, { frozen: finalized });
  const campaigns = useCampaigns();

  const campaignOf = useMemo(() => {
    const m = new Map<number, { title: string; category: string }>();
    for (const c of campaigns.data ?? []) m.set(c.id, { title: c.title, category: c.category.tag });
    return m;
  }, [campaigns.data]);

  // Campaigns that got a QF split for this round, ranked by matched desc (crowd winner on top).
  // E2E smoke campaigns are excluded from the public ranking.
  const ranked = useMemo(
    () =>
      [...(preview.data ?? [])]
        .filter(([pid]) => {
          const c = campaignOf.get(Number(pid));
          return c === undefined || !isDemoArtifact(c.title);
        })
        .sort((a, b) => descBig(a[1], b[1])),
    [preview.data, campaignOf],
  );
  const pids = useMemo(() => ranked.map(([pid]) => Number(pid)), [ranked]);
  const tallies = useRoundProjects(round.id, pids, { frozen: finalized });

  // Rows: direct/donors from round_project, matched from the (live or stored) preview split.
  const talliesReady = pids.length === 0 || tallies.every((q) => q.data !== undefined);
  const rows = useMemo(() => {
    return ranked.map(([pid, matched], i) => {
      const t = tallies[i]?.data;
      return {
        pid: Number(pid),
        matched,
        direct: t?.[0] ?? 0n,
        donors: t?.[1] ?? 0,
      };
    });
  }, [ranked, tallies]);

  // Shared bar scale = the largest direct+matched total, so rows read comparably.
  const scale = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      const total = Number(row.direct) + Number(row.matched);
      if (total > max) max = total;
    }
    return max;
  }, [rows]);

  const totalMatched = useMemo(
    () => ranked.reduce((sum, [, m]) => sum + m, 0n),
    [ranked],
  );

  const loading = preview.data === undefined || campaigns.data === undefined || !talliesReady;
  // Surface each query's failure instead of ANDing them into one silent skeleton: any query that
  // errored with nothing cached fails the page (with a retry that targets only the failed reads);
  // errors after a successful read degrade to the stale-data note.
  const failed =
    (preview.isError && preview.data === undefined) ||
    (campaigns.isError && campaigns.data === undefined) ||
    tallies.some((q) => q.isError && q.data === undefined);
  const stale =
    !failed && (preview.isError || campaigns.isError || tallies.some((q) => q.isError));
  const retryFailed = () => {
    if (preview.isError) void preview.refetch();
    if (campaigns.isError) void campaigns.refetch();
    for (const q of tallies) if (q.isError) void q.refetch();
  };

  return (
    <>
      <Header round={round} rounds={rounds} finalized={finalized} />

      <div className="mt-8">
        {failed ? (
          <ErrorPanel onRetry={retryFailed} />
        ) : loading ? (
          <>
            <RowsSkeleton />
            <SlowLoadHint onRetry={retryFailed} />
          </>
        ) : ranked.length === 0 ? (
          <EmptyPanel />
        ) : (
          <>
            {stale ? (
              <p className="mb-3 text-xs text-clay">{strings.staleData}</p>
            ) : null}
            <ul className="space-y-3" aria-label={r.barLabel}>
              {rows.map((row, i) => (
                <ResultRow
                  key={row.pid}
                  index={i}
                  campaign={campaignOf.get(row.pid)}
                  fallbackId={row.pid}
                  direct={row.direct}
                  matched={row.matched}
                  donors={row.donors}
                  scale={scale}
                />
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-faint">{r.poolLabel}</p>
                <p className="tabular mt-0.5 text-lg font-bold text-ink">{formatIDR(round.pool)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-faint">{r.totalMatchedLabel}</p>
                <p className="tabular mt-0.5 text-lg font-bold text-match-ink">
                  {formatIDR(totalMatched)}
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-muted">{r.verdict}</p>
          </>
        )}
      </div>
    </>
  );
}

/* ── One campaign's row: figures + the direct-vs-matched comparison bar ───────────────────── */

function ResultRow({
  index,
  campaign,
  fallbackId,
  direct,
  matched,
  donors,
  scale,
}: {
  index: number;
  campaign?: { title: string; category: string };
  fallbackId: number;
  direct: bigint;
  matched: bigint;
  donors: number;
  scale: number;
}) {
  const strings = useStrings();
  const r = strings.results;
  const directPct = scale > 0 ? (Number(direct) / scale) * 100 : 0;
  const matchedPct = scale > 0 ? (Number(matched) / scale) * 100 : 0;
  const winner = index === 0;

  return (
    <li>
      <Reveal
        delay={index * 0.07}
        y={20}
        className={`flex gap-4 rounded-2xl border p-5 shadow-card sm:gap-6 ${
          winner ? "border-match/30 bg-match-soft/60" : "border-line bg-surface"
        }`}
      >
        <span
          className={`display select-none text-4xl leading-none sm:text-5xl ${
            winner ? "text-match-ink" : "text-line-strong"
          }`}
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {campaign ? <CategoryChip tag={campaign.category} /> : null}
              <h3 className="mt-1.5 truncate text-base font-semibold text-ink">
                {campaign?.title ?? `#${fallbackId}`}
              </h3>
              {/* Donor count is the row's loudest figure — crowd beats whale is a type-scale
                  decision, so the people number outranks every rupiah figure beside it. */}
              <p className="tabular mt-1 text-2xl font-black leading-none text-match-ink sm:text-3xl">
                {donors}{" "}
                <span className="text-xs font-bold uppercase tracking-[.08em]">
                  {r.donorSuffix}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-5 text-right">
              <div>
                <p className="text-[0.6875rem] uppercase tracking-wide text-faint">{r.directLabel}</p>
                <p className="tabular font-semibold text-ink">{formatIDR(direct)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] uppercase tracking-wide text-faint">{r.matchedLabel}</p>
                <p className="tabular text-lg font-black text-match-ink">
                  +<CountUp value={Number(matched)} format={(n) => formatIDR(Math.round(n))} />
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-line/40">
            <div
              className="flex h-full origin-left motion-safe:animate-bar-in"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="h-full bg-ink/25" style={{ width: `${directPct}%` }} />
              <div className="h-full bg-match" style={{ width: `${matchedPct}%` }} />
            </div>
          </div>
        </div>
      </Reveal>
    </li>
  );
}

/* ── Header: season label, status, projection note, round picker ─────────────────────────── */

function Header({
  round,
  rounds,
  finalized,
}: {
  round: RoundState;
  rounds: RoundState[];
  finalized: boolean;
}) {
  const strings = useStrings();
  const r = strings.results;
  const router = useRouter();
  const ordered = [...rounds].sort((a, b) => b.id - a.id);

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted">{r.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
            {r.seasonLabel(round.id)}
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              finalized ? "bg-match-soft text-match-ink" : "bg-accent-soft text-accent-ink"
            }`}
          >
            {finalized ? strings.seasons.status.Finalized : strings.seasons.status.Open}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {finalized ? r.finalized : r.notFinalized}
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="whitespace-nowrap">{r.roundPickerLabel}</span>
        <SelectMenu
          value={round.id}
          onChange={(id) => router.replace(`/results?round=${id}`)}
          ariaLabel={r.roundPickerLabel}
          options={ordered.map((x) => ({
            value: x.id,
            label: `${r.seasonLabel(x.id)} · ${strings.seasons.status[x.status.tag] ?? x.status.tag}`,
          }))}
          className="min-w-52"
        />
      </div>
    </header>
  );
}

/* ── States ──────────────────────────────────────────────────────────────────────────────── */

function RowsSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="skeleton h-5 w-1/3 rounded" />
            <div className="skeleton h-5 w-24 rounded" />
          </div>
          <div className="skeleton mt-4 h-2.5 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** After 8s of skeleton with no error, admit the chain read is slow and offer a manual retry —
 * a stalled RPC call must never leave the page silently blank. */
function SlowLoadHint({ onRetry }: { onRetry: () => void }) {
  const strings = useStrings();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (!slow) return null;
  return (
    <p className="mt-4 text-center text-sm text-muted">
      {strings.results.slowLoad}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="action-link"
      >
        {strings.retry}
      </button>
    </p>
  );
}

function PageSkeleton() {
  return (
    <div>
      <div className="skeleton h-10 w-48 rounded" />
      <div className="skeleton mt-3 h-4 w-72 rounded" />
      <div className="mt-8">
        <RowsSkeleton />
      </div>
    </div>
  );
}

function EmptyPanel() {
  const { results: r } = useStrings();
  return (
    <div className="state-panel px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{r.empty}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{r.emptyHint}</p>
    </div>
  );
}

function NotFound({ title, body }: { title: string; body: string }) {
  const { results: r } = useStrings();
  return (
    <div className="state-panel px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      <Link
        href="/seasons"
        className="action-link mt-5"
      >
        {r.backToSeasons}
      </Link>
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const strings = useStrings();
  return (
    <div className="state-panel px-6 py-16 text-center">
      <p className="text-ink">{strings.errorGeneric}</p>
      <button
        type="button"
        onClick={onRetry}
        className="action-link mt-4"
      >
        {strings.retry}
      </button>
    </div>
  );
}
