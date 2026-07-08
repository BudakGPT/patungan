"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ProjectState } from "@/contract/src";
import { strings } from "@/strings";
import { formatIDR, truncateAddress } from "@/lib/format";
import { cidToUrl } from "@/lib/ipfs";
import { categoryMeta } from "@/lib/category";
import { useCampaign, useOpenRound, usePreviewRound, useRoundProject } from "@/lib/hooks";
import { CategoryChip } from "@/components/CategoryChip";
import { ContributePanel } from "@/components/ContributePanel";

const t = strings.campaign;

/**
 * Campaign detail `/campaign/[id]`. A reading column (story) beside a sticky
 * ledger sidebar (lifetime direct + — only in the open round's scope — this-round donor count and
 * the projected quadratic match, the page's single emerald figure). The sidebar carries the inline
 * ContributePanel. Four states: loading skeleton, not-found (unknown/malformed id → home), a
 * non-Approved status notice, and the success layout.
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
  const { placeholder } = categoryMeta(campaign.category.tag);
  const approved = campaign.status.tag === "Approved";
  const statusNotice = approved ? null : t.status[campaign.status.tag];

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span>
        {t.back}
      </Link>

      {/* Hero banner */}
      <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl border border-line shadow-card sm:aspect-[21/9]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={campaign.title} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${placeholder}`}>
            <span className="text-xs font-medium uppercase tracking-widest text-muted">
              {strings.discovery.noThumbAlt}
            </span>
          </div>
        )}
        <div className="absolute left-4 top-4">
          <CategoryChip tag={campaign.category.tag} size="md" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        {/* Reading column */}
        <article>
          <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.5rem]">
            {campaign.title}
          </h1>
          <p className="mt-3 text-sm text-faint">
            {t.byOwner}{" "}
            <span className="tabular font-medium text-muted">
              {truncateAddress(campaign.owner)}
            </span>
          </p>

          {statusNotice ? (
            <p className="mt-6 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
              {statusNotice}
            </p>
          ) : null}

          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-faint">
            {t.storyHeading}
          </h2>
          <p className="mt-3 max-w-[68ch] whitespace-pre-line text-base leading-relaxed text-muted">
            {campaign.story}
          </p>
        </article>

        {/* Sticky ledger sidebar */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="text-xs uppercase tracking-wide text-faint">{t.raisedLabel}</p>
            <p className="tabular mt-1 text-3xl font-bold text-ink">
              {formatIDR(campaign.lifetime_direct)}
            </p>

            {inScope ? (
              <div className="mt-5 border-t border-line pt-5">
                <p className="text-xs uppercase tracking-wide text-faint">{t.thisRoundHeading}</p>
                {donors !== undefined ? (
                  <p className="mt-1 text-sm text-muted">
                    {donors} {t.donorSuffix}
                  </p>
                ) : null}
                {projectedMatch !== undefined ? (
                  <div className="mt-3">
                    <p className="text-xs text-muted">{t.projectedMatchLabel}</p>
                    <p className="tabular mt-1 inline-flex items-center rounded-full bg-match-soft px-3 py-1 text-lg font-semibold text-match-ink">
                      +{formatIDR(projectedMatch)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 border-t border-line pt-4 text-sm text-faint">{t.notInRound}</p>
            )}

            <div className="mt-6">
              <ContributePanel campaign={campaign} disabled={!approved} />
            </div>
          </div>
        </aside>
      </div>
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
