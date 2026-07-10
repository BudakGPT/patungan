"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ProjectState } from "@/contract/src";
import { strings } from "@/strings";
import { formatCompactIDR, formatIDR, truncateAddress } from "@/lib/format";
import { cidToUrl } from "@/lib/ipfs";
import { categoryMeta } from "@/lib/category";
import { getProjectVisual } from "@/lib/projectVisuals";
import { useCampaign, useOpenRound, usePreviewRound, useRoundProject } from "@/lib/hooks";
import { ContributePanel } from "@/components/ContributePanel";
import { ParallaxImg, Reveal } from "@/components/motion";
import { config } from "@/lib/config";

const t = strings.campaign;

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
  const roundProject = useRoundProject(roundId, id, inScope);
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
  const thumb = cidToUrl(campaign.image_cid);
  const visual = getProjectVisual(campaign.id);
  const { label: categoryLabel } = categoryMeta(campaign.category.tag);
  const approved = campaign.status.tag === "Approved";
  const statusNotice = approved ? null : t.status[campaign.status.tag];
  const total = campaign.lifetime_direct + (projectedMatch ?? 0n);

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
              <Link href="/" className="tag">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card bg-paper text-ink">
                <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
                  {strings.discovery.directShort}
                </span>
                <strong className="num tabular mt-2 text-2xl font-black">
                  {formatCompactIDR(campaign.lifetime_direct)}
                </strong>
              </div>
              <div className="metric-card bg-lime text-ink">
                <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
                  {t.projectedMatchLabel}
                </span>
                <strong className="num tabular mt-2 text-2xl font-black">
                  {projectedMatch === undefined
                    ? strings.landing.noMatchYet
                    : formatCompactIDR(projectedMatch)}
                </strong>
              </div>
              <div className="metric-card bg-white/10 text-paper">
                <span className="text-xs font-black uppercase tracking-[.12em] text-white/60">
                  Donor
                </span>
                <strong className="num tabular mt-2 text-2xl font-black text-lime">
                  {donors ?? "—"}
                </strong>
              </div>
              <div className="metric-card bg-white/10 text-paper">
                <span className="text-xs font-black uppercase tracking-[.12em] text-white/60">
                  Total
                </span>
                <strong className="num tabular mt-2 text-2xl font-black text-lime">
                  {formatCompactIDR(total)}
                </strong>
              </div>
            </div>

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
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <figure className="overflow-hidden rounded-[1.5rem] shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                Jejak on-chain
              </span>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                Ke mana Rp50 ribu-mu pergi
              </h2>
              <ol className="mt-6 space-y-5">
                {[
                  ["contribute()", "Donasimu tercatat di contract dengan alamat, jumlah, dan ledger."],
                  ["preview_matches()", "Kontribusimu menaikkan bobot (Σ√c)² kampanye ini — sinyal publik, bukan janji."],
                  ["finalize()", "Di akhir musim, matching pool dibagi mengikuti sinyal itu. Bisa diaudit siapa pun."],
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
                Artefak kampanye #{campaign.id}
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
                  <dt className="font-black uppercase tracking-[.12em] text-white/55">kategori</dt>
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

function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10" aria-hidden>
      <div className="h-4 w-32 animate-pulse rounded bg-line/50" />
      <div className="mt-5 aspect-[16/9] animate-pulse rounded-2xl bg-line/50 sm:aspect-[21/9]" />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="space-y-4">
          <div className="h-9 w-3/4 animate-pulse rounded bg-line/50" />
          <div className="h-4 w-40 animate-pulse rounded bg-line/50" />
          <div className="mt-6 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-line/50" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-line/50" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-line/50" />
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-2xl bg-line/50" />
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-page px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <p className="text-lg font-semibold text-ink">{t.notFoundTitle}</p>
        <p className="mt-2 text-sm text-muted">{t.notFoundBody}</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
        >
          {t.backHome}
        </Link>
      </div>
    </main>
  );
}
