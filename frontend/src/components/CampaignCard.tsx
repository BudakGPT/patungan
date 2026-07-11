"use client";

import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { formatCompactIDR, formatIDR } from "@/lib/format";
import { cidToUrl } from "@/lib/ipfs";
import { categoryMeta } from "@/lib/category";
import { getProjectVisual } from "@/lib/projectVisuals";
import { useRoundProject } from "@/lib/hooks";

/**
 * One approved campaign in the discovery grid. The category, title, and lifetime direct raised
 * always show. Donor count and projected match come from the open round's per-(round, project)
 * tally and are only fetched for in-scope campaigns (`useRoundProject`'s `inScope` gate) — an
 * out-of-scope card naturally renders "—"/no-match copy instead of a fake figure. Falls back to
 * a curated stock photo when the campaign has no uploaded image. Links to `/campaign/[id]`.
 */
export function CampaignCard({
  campaign,
  roundId,
  inScope,
  projectedMatch,
  pool,
}: {
  campaign: ProjectState;
  roundId: number | null;
  inScope: boolean;
  projectedMatch?: bigint;
  pool: bigint;
}) {
  const strings = useStrings();
  const d = strings.discovery;
  const thumb = cidToUrl(campaign.image_cid);
  const visual = getProjectVisual(campaign.id);
  const { label: categoryLabel } = categoryMeta(campaign.category.tag, strings.categories);

  // Donor count is only exposed per-round; fetch it just for in-scope cards.
  const rp = useRoundProject(roundId, campaign.id, { enabled: inScope });
  const donors = rp.data?.[1];

  const total = campaign.lifetime_direct + (projectedMatch ?? 0n);
  const pct =
    projectedMatch !== undefined && pool > 0n
      ? Math.max(Math.min(Number((projectedMatch * 10_000n) / pool) / 100, 100), 5)
      : 0;

  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="group flex flex-col overflow-hidden rounded-[2rem] border border-ink/10 bg-paper text-ink shadow-soft transition duration-200 hover:-translate-y-1 hover:border-lime/70"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          src={thumb || visual.image}
          alt={campaign.title}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
        <div className="absolute left-4 top-4 flex gap-2">
          {/* Rank chip stays paper — a campaign number is not a verdict (One Verdict Rule). */}
          <span className="rounded-full bg-paper/90 px-3 py-1 text-xs font-black text-ink">
            {String(campaign.id + 1).padStart(2, "0")}
          </span>
          <span className="rounded-full bg-paper/90 px-3 py-1 text-xs font-black text-ink">
            {categoryLabel}
          </span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-paper">
          <span className="text-xs font-black uppercase tracking-[.12em] text-white/65">
            {visual.location}
          </span>
          <h3 className="mt-2 line-clamp-2 text-2xl font-black leading-none">{campaign.title}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <p className="line-clamp-3 text-base font-semibold leading-7 text-ink/70">
          {campaign.story}
        </p>

        {/* Canonical metric-tile mapping (DESIGN.md §5): lime = pendukung count (the crowd,
            attested — and the grid's biggest figure), cream = direct, pale = projected,
            ink = total. Identical pairing on the campaign-detail hero. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="metric-card bg-lime text-ink">
            <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
              {d.donorLabel}
            </span>
            <strong className="num tabular mt-2 block text-[clamp(1.9rem,2.3vw,2.6rem)] font-black">
              {donors ?? "—"}
            </strong>
          </div>
          <div className="metric-card bg-tile-cream">
            <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
              {d.directShort}
            </span>
            <strong className="num tabular mt-2 block text-[clamp(1.42rem,1.45vw,1.9rem)] font-black">
              {formatCompactIDR(campaign.lifetime_direct)}
            </strong>
          </div>
          <div className="metric-card bg-tile-match">
            <span className="text-xs font-black uppercase tracking-[.12em] text-ink/65">
              {d.projectedShort}
            </span>
            <strong className="num tabular mt-2 block text-[clamp(1.42rem,1.45vw,1.9rem)] font-black text-deep">
              {projectedMatch === undefined
                ? strings.landing.noMatchYet
                : formatCompactIDR(projectedMatch)}
            </strong>
          </div>
          <div className="metric-card bg-ink text-paper">
            <span className="text-xs font-black uppercase tracking-[.12em] text-white/60">
              {d.totalShort}
            </span>
            <strong className="num tabular mt-2 block text-[clamp(1.42rem,1.45vw,1.9rem)] font-black">
              {formatCompactIDR(total)}
            </strong>
          </div>
        </div>

        <div>
          <div className="h-4 overflow-hidden rounded-full bg-ink/10">
            {/* Ends at sea, not lime — a progress bar is not a verdict (One Verdict Rule). */}
            <div
              className="h-full rounded-full bg-gradient-to-r from-green to-sea"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs font-black uppercase tracking-[.1em] text-ink/65">
            <span className="tabular">
              {donors ?? 0} {strings.landing.donorCountSuffix}
            </span>
            <span className="tabular">
              {projectedMatch === undefined ? formatIDR(campaign.lifetime_direct) : formatIDR(total)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
