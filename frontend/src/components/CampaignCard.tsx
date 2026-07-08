"use client";

import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { strings } from "@/strings";
import { formatIDR } from "@/lib/format";
import { cidToUrl } from "@/lib/ipfs";
import { categoryMeta } from "@/lib/category";
import { CategoryChip } from "./CategoryChip";
import { useRoundProject } from "@/lib/hooks";

const d = strings.discovery;

/**
 * One approved campaign in the discovery grid. Always shows category, title, and lifetime direct
 * raised. The "this round" strip (donor count + projected quadratic match) appears **only** when
 * the campaign is in the open round's scope — out-of-scope cards never show a fake match figure.
 * Links to `/campaign/[id]`.
 */
export function CampaignCard({
  campaign,
  roundId,
  inScope,
  projectedMatch,
}: {
  campaign: ProjectState;
  roundId: number | null;
  inScope: boolean;
  projectedMatch?: bigint;
}) {
  const thumb = cidToUrl(campaign.image_cid);
  const { placeholder } = categoryMeta(campaign.category.tag);

  // Donor count is only exposed per-round; fetch it just for in-scope cards.
  const rp = useRoundProject(roundId, campaign.id, inScope);
  const donors = rp.data?.[1];

  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={campaign.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out-quint group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${placeholder}`}
          >
            <span className="text-xs font-medium uppercase tracking-widest text-muted">
              {d.noThumbAlt}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3">
          <CategoryChip tag={campaign.category.tag} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-ink">
          {campaign.title}
        </h3>

        <div className="mt-3 flex-1" />

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-faint">
              {d.directShort}
            </p>
            <p className="tabular font-semibold text-ink">
              {formatIDR(campaign.lifetime_direct)}
            </p>
          </div>
          {inScope ? (
            <div className="text-right">
              {projectedMatch !== undefined ? (
                <span className="tabular inline-flex items-center rounded-full bg-match-soft px-2.5 py-1 text-sm font-semibold text-match-ink">
                  +{formatIDR(projectedMatch)} {d.matchSuffix}
                </span>
              ) : null}
              {donors !== undefined ? (
                <p className="mt-1 text-xs text-muted">
                  {donors} {d.donorSuffix}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
