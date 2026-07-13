"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ProjectState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { formatCompactIDR, formatIDR, truncateAddress } from "@/lib/format";
import { cidToUrl } from "@/lib/ipfs";
import { categoryMeta } from "@/lib/category";
import { getProjectVisual } from "@/lib/projectVisuals";
import {
  useCampaign,
  useCampaignActivity,
  useOpenRound,
  usePreviewRound,
  useRoundProject,
} from "@/lib/hooks";
import { ContributePanel } from "@/components/ContributePanel";
import { ParallaxImg, Reveal } from "@/components/motion";
import { config } from "@/lib/config";

/**
 * Campaign detail `/campaign/[id]`. A dark hero banner (real uploaded image when set, else a
 * curated stock photo) over the reading column (story) and a sticky ledger sidebar — lifetime
 * direct +, only in the open round's scope, this-round donor count and the projected quadratic
 * match. The sidebar carries the inline ContributePanel. Four states: loading skeleton,
 * not-found (unknown/malformed id → home), a non-Approved status notice, and the success layout.
 */
export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number(raw);
  const valid = Number.isInteger(id) && id >= 0;

  const campaignQ = useCampaign(id, valid);
  const openRound = useOpenRound();
  const roundId = openRound.data?.id ?? null;
  const preview = usePreviewRound(roundId);

  const campaign = campaignQ.data;

  // In the open round's scope? (empty scope = all categories.)
  const scope = openRound.data?.categories ?? [];
  const inScope =
    !!campaign &&
    roundId !== null &&
    (scope.length === 0 || scope.some((s) => s.tag === campaign.category.tag));

  const projectedMatch = useMemo(() => {
    if (!campaign) return undefined;
    for (const [pid, matched] of preview.data ?? []) {
      if (Number(pid) === campaign.id) return matched;
    }
    return undefined;
  }, [preview.data, campaign]);

  // Donor count is only exposed per-round; fetch it only when this campaign is in scope.
  const roundProject = useRoundProject(roundId, id, { enabled: inScope });
  const donors = roundProject.data?.[1];

  if (!valid || campaignQ.isError) return <NotFound />;
  if (campaign === undefined) return <DetailSkeleton />;

  return (
    <Content
      campaign={campaign}
      inScope={inScope}
      donors={donors}
      projectedMatch={projectedMatch}
    />
  );
}

function Content({
  campaign,
  inScope,
  donors,
  projectedMatch,
}: {
  campaign: ProjectState;
  inScope: boolean;
  donors: number | undefined;
  projectedMatch: bigint | undefined;
}) {
  const strings = useStrings();
  const t = strings.campaign;
  const thumb = cidToUrl(campaign.image_cid);
  const visual = getProjectVisual(campaign.id);
  const { label: categoryLabel } = categoryMeta(campaign.category.tag, strings.categories);
  const approved = campaign.status.tag === "Approved";
  const statusNotice = approved ? null : t.status[campaign.status.tag];
  const total = campaign.lifetime_direct + (projectedMatch ?? 0n);
  const targetPct = Math.min(
    Number((total * 10_000n) / visual.fundingTarget) / 100,
    100,
  );

  useEffect(() => {
    const previous = document.title;
    document.title = `${campaign.title} | Patungan`;
    return () => {
      document.title = previous;
    };
  }, [campaign.title]);

  return (
    <main className="bg-cream text-ink">
      {/* Hero banner */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <ParallaxImg
          className="h-[112%] w-full object-cover opacity-45"
          src={thumb || visual.image}
          alt={campaign.title}
          drift={40}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,18,15,.96),rgba(7,18,15,.62)_55%,rgba(7,18,15,.82))]" />
        <div className="chain-grid absolute inset-0 opacity-60" />

        <div className="relative mx-auto grid max-w-[1500px] gap-8 px-4 py-14 sm:px-7 lg:grid-cols-[1fr_.85fr] lg:px-10">
          <div>
            <Reveal mode="load" y={16}>
              <Link href="/campaigns" className="tag">
                {t.back}
              </Link>
              <div className="mt-8 flex flex-wrap gap-2">
                <span className="tag">{categoryLabel}</span>
                <span className="tag">{visual.location}</span>
                {donors !== undefined ? <span className="tag">{donors} {t.donorSuffix}</span> : null}
              </div>
            </Reveal>
            <Reveal mode="load" delay={0.1} y={40}>
              <h1 className="display mt-6 max-w-4xl text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[.88]">
                {campaign.title}
              </h1>
            </Reveal>
            {statusNotice ? (
              <p className="mt-6 max-w-2xl rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white/80">
                {statusNotice}
              </p>
            ) : null}
          </div>

          <Reveal mode="load" delay={0.22} y={36} className="lg:self-start">
          <aside className="glass-dark rounded-[2rem] p-5">
            {/* Canonical metric-tile mapping (DESIGN.md §5), identical to the discovery card:
                lime = pendukung count (the biggest figure), cream = direct, pale = projected,
                ink = total. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card bg-lime text-ink">
                <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
                  {strings.discovery.donorLabel}
                </span>
                <strong className="num tabular mt-2 text-3xl font-black">
                  {donors ?? "—"}
                </strong>
              </div>
              <div className="metric-card bg-tile-cream text-ink">
                <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
                  {strings.discovery.directShort}
                </span>
                <strong className="num tabular mt-2 text-2xl font-black">
                  {formatCompactIDR(campaign.lifetime_direct)}
                </strong>
              </div>
              <div className="metric-card bg-tile-match text-ink" title={strings.discovery.projectedHint}>
                <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
                  {strings.discovery.projectedShort}
                </span>
                <strong className="num tabular mt-2 text-2xl font-black text-deep">
                  {projectedMatch === undefined
                    ? strings.landing.noMatchYet
                    : formatCompactIDR(projectedMatch)}
                </strong>
              </div>
              <div className="metric-card border border-white/10 bg-ink text-paper">
                <span className="text-xs font-black uppercase tracking-[.12em] text-white/60">
                  {strings.discovery.totalShort}
                </span>
                <strong className="num tabular mt-2 text-2xl font-black">
                  {formatCompactIDR(total)}
                </strong>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[.06] p-3.5">
              <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[.08em] text-white/65">
                <span>
                  {targetPct >= 100
                    ? strings.discovery.targetReached
                    : `${targetPct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% ${strings.discovery.targetProgress}`}
                </span>
                <span className="tabular text-paper">{formatCompactIDR(visual.fundingTarget)}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green to-lime"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            </div>

            {inScope ? (
              <p className="mt-3 text-xs font-semibold leading-5 text-white/55">
                {strings.discovery.projectedHint}
              </p>
            ) : null}

            {!inScope ? (
              <p className="mt-4 text-center text-xs font-semibold text-white/60">{t.notInRound}</p>
            ) : null}

            <div className="mt-5">
              <ContributePanel campaign={campaign} disabled={!approved} />
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-white/55">
              {t.byOwner} <span className="tabular">{truncateAddress(campaign.owner)}</span>
            </p>
          </aside>
          </Reveal>
        </div>
      </section>

      {/* Reading column + campaign photo */}
      <section className="px-4 py-12 sm:px-7 lg:px-10 lg:py-16">
        <div className="mx-auto grid max-w-[1500px] items-start gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <Reveal>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[.16em] text-faint">
                {t.storyHeading}
              </h2>
              <p className="mt-4 max-w-[68ch] whitespace-pre-line text-lg font-medium leading-8 text-ink/85">
                {campaign.story}
              </p>
              <p className="mt-6 max-w-[68ch] text-base leading-relaxed text-muted">
                {visual.story}
              </p>

              <section className="mt-9 max-w-[68ch] border-y border-line py-6">
                <h2 className="text-xs font-black uppercase tracking-[.16em] text-faint">
                  {t.transparencyHeading}
                </h2>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-bold text-muted">{t.verifiedLabel}</dt>
                    <dd className="mt-1 font-black text-match-ink">{t.verifiedValue}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-muted">{t.payoutRecipientLabel}</dt>
                    <dd className="mono mt-1 break-all font-bold text-ink">
                      {campaign.payout}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-bold text-muted">{t.payoutScheduleLabel}</dt>
                    <dd className="mt-1 leading-6 text-ink/80">{t.payoutScheduleValue}</dd>
                  </div>
                </dl>
              </section>

              <CampaignActivityFeed campaignId={campaign.id} />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <figure className="overflow-hidden rounded-[1.5rem] shadow-soft">
              <img
                className="aspect-[4/3] w-full object-cover"
                src={thumb || visual.image}
                alt={`${campaign.title} — ${visual.location}`}
              />
              <figcaption className="bg-ink px-5 py-3 text-xs font-black uppercase tracking-[.12em] text-white/70">
                {visual.location}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* The chain behind this page: how a contribution flows, plus the raw artifacts. */}
      <section className="px-4 pb-14 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] bg-ink text-paper">
          <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
            <div className="p-6 sm:p-9">
              <span className="text-xs font-black uppercase tracking-[.16em] text-lime/85">
                {t.jejak.tag}
              </span>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">{t.jejak.heading}</h2>
              <ol className="mt-6 space-y-5">
                {[
                  ["contribute()", t.jejak.steps[0]],
                  ["preview_matches()", t.jejak.steps[1]],
                  ["finalize()", t.jejak.steps[2]],
                ].map(([fn, copy], i) => (
                  <Reveal key={fn} delay={i * 0.08}>
                    <li className="flex gap-4">
                      <span className="mono mt-0.5 shrink-0 text-sm font-bold text-lime/85">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <span className="mono block text-sm font-bold text-white/85">{fn}</span>
                        <span className="mt-1 block text-sm font-semibold leading-6 text-white/60">
                          {copy}
                        </span>
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>

            <div className="border-t border-white/10 p-6 sm:p-9 lg:border-l lg:border-t-0">
              <span className="text-xs font-black uppercase tracking-[.16em] text-white/55">
                {t.jejak.artifactsLabel(campaign.id)}
              </span>
              <dl className="mt-6 space-y-4 text-sm">
                {[
                  ["owner", campaign.owner],
                  ["payout", campaign.payout],
                  ["contract", config.contractId],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
                    <dt className="font-black uppercase tracking-[.12em] text-white/55">{label}</dt>
                    <dd className="mono text-white/85">{truncateAddress(value)}</dd>
                  </div>
                ))}
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
                  <dt className="font-black uppercase tracking-[.12em] text-white/55">
                    {t.jejak.categoryLabel}
                  </dt>
                  <dd className="font-bold text-white/85">{categoryLabel}</dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="font-black uppercase tracking-[.12em] text-white/55">created ledger</dt>
                  <dd className="mono text-white/85">{String(campaign.created_ledger)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type ActivityFilter = "all" | "in" | "out";

/**
 * The interactive campaign activity feed: the campaign's full public money trail reconstructed from
 * on-chain events — both `contrib` (donations landing in escrow) and `payout` (funds released to
 * the owner's payout address). Answers the donor's real question — *does my gift actually reach the
 * owner?* — by showing both halves in one place. A money-in / money-out summary sits above a
 * filterable receipt list (All · Donations · Payouts), each row linking to the tx on the explorer.
 * Capped to the newest 6 with a show-more toggle; RPC retention keeps it honest.
 */
function CampaignActivityFeed({ campaignId }: { campaignId: number }) {
  const strings = useStrings();
  const t = strings.campaign.ledger;
  const activity = useCampaignActivity(campaignId);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [expanded, setExpanded] = useState(false);

  const all = useMemo(() => activity.data ?? [], [activity.data]);

  // The two halves of the trail: everything donated in vs. everything released to the owner.
  const totals = useMemo(() => {
    let inSum = 0n;
    let outSum = 0n;
    for (const row of all) {
      if (row.kind === "contrib") inSum += row.amount;
      else outSum += row.amount;
    }
    return { inSum, outSum };
  }, [all]);

  const filtered = useMemo(
    () =>
      all.filter((row) =>
        filter === "all" ? true : filter === "in" ? row.kind === "contrib" : row.kind === "payout",
      ),
    [all, filter],
  );

  const LIMIT = 6;
  const rows = expanded ? filtered : filtered.slice(0, LIMIT);
  const canExpand = filtered.length > LIMIT;

  const tabs: Array<{ id: ActivityFilter; label: string }> = [
    { id: "all", label: t.filterAll },
    { id: "in", label: t.filterIn },
    { id: "out", label: t.filterOut },
  ];

  return (
    <section className="mt-12">
      <h2 className="text-xs font-black uppercase tracking-[.16em] text-faint">{t.heading}</h2>
      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted">{t.body}</p>

      {activity.data === undefined ? (
        <div className="mt-5 space-y-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-9 rounded-lg" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <p className="mt-5 text-sm text-muted">{t.empty}</p>
      ) : (
        <>
          {/* Money-in / money-out summary — the whole trail at a glance. */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[.1em] text-faint">
                <span className="h-2 w-2 rounded-full bg-match" aria-hidden />
                {t.summaryIn}
              </span>
              <strong className="tabular mt-1 block text-lg font-black text-match-ink">
                {formatCompactIDR(totals.inSum)}
              </strong>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[.1em] text-faint">
                <span className="h-2 w-2 rounded-full bg-ink" aria-hidden />
                {t.summaryOut}
              </span>
              <strong className="tabular mt-1 block text-lg font-black text-ink">
                {formatCompactIDR(totals.outSum)}
              </strong>
            </div>
          </div>

          {/* Direction filter. */}
          <div className="mt-4 inline-flex rounded-xl border border-line bg-surface p-1">
            {tabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFilter(tab.id);
                    setExpanded(false);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-[.08em] transition-colors ${
                    active ? "bg-ink text-paper" : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t.empty}</p>
          ) : (
            <ul className="mono mt-4 divide-y divide-line border-y border-line text-sm">
              {rows.map((row) => {
                const isIn = row.kind === "contrib";
                return (
                  <li key={`${row.kind}-${row.txHash}`}>
                    <a
                      href={`${config.explorerBase}/tx/${row.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 transition-colors hover:bg-line/30"
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 self-start rounded-full ${
                          isIn ? "bg-match" : "bg-ink"
                        }`}
                      />
                      <span className={isIn ? "text-ink/85" : "font-bold text-ink"}>
                        {isIn ? truncateAddress(row.donor) : t.payoutLabel}
                      </span>
                      {!isIn && row.roundId !== null ? (
                        <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[.68rem] font-bold text-muted">
                          {t.roundTag(row.roundId)}
                        </span>
                      ) : null}
                      <span className={`tabular font-bold ${isIn ? "text-match-ink" : "text-ink"}`}>
                        {formatIDR(row.amount)}
                      </span>
                      <span className="tabular ml-auto text-xs text-faint">ledger {row.ledger}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs font-black uppercase tracking-[.1em] text-ink underline underline-offset-2 hover:text-match-ink"
            >
              {expanded ? t.showLess : t.showMore}
            </button>
          ) : null}
        </>
      )}

      <p className="mt-3 text-xs text-faint">{t.retention}</p>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10" aria-hidden>
      <div className="skeleton h-4 w-32 rounded" />
      <div className="skeleton mt-5 aspect-[16/9] rounded-2xl sm:aspect-[21/9]" />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="space-y-4">
          <div className="skeleton h-9 w-3/4 rounded" />
          <div className="skeleton h-4 w-40 rounded" />
          <div className="mt-6 space-y-2">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-11/12 rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
          </div>
        </div>
        <div className="skeleton h-56 rounded-2xl" />
      </div>
    </main>
  );
}

function NotFound() {
  const { campaign: t } = useStrings();
  return (
    <main className="mx-auto max-w-page px-4 py-24 sm:px-6">
      <div className="state-panel mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-lg font-semibold text-ink">{t.notFoundTitle}</p>
        <p className="mt-2 text-sm text-muted">{t.notFoundBody}</p>
        <Link
          href="/"
          className="action-link mt-5"
        >
          {t.backHome}
        </Link>
      </div>
    </main>
  );
}
