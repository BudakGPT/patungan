"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { useCampaigns, useOpenRound, usePreviewRound } from "@/lib/hooks";
import { ALL_CATEGORIES, categoryMeta, type CategoryTag } from "@/lib/category";
import { isDemoArtifact } from "@/lib/demo";
import { CampaignCard } from "@/components/CampaignCard";
import { SelectMenu } from "@/components/SelectMenu";

type SortKey = "mostBacked" | "newest" | "closingSoon";

const descBig = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0);

/** Dedicated public directory: category/search/sort controls over every approved campaign. */
export function CampaignDirectory() {
  const strings = useStrings();
  const d = strings.discovery;
  const l = strings.landing;
  const campaigns = useCampaigns();
  const openRound = useOpenRound();
  const roundId = openRound.data?.id ?? null;
  const preview = usePreviewRound(roundId);
  const [category, setCategory] = useState<CategoryTag | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("mostBacked");

  const scope = openRound.data?.categories ?? [];
  const inScope = (campaign: ProjectState) =>
    roundId !== null &&
    (scope.length === 0 || scope.some((item) => item.tag === campaign.category.tag));

  const matchOf = useMemo(() => {
    const matches = new Map<number, bigint>();
    for (const [projectId, matched] of preview.data ?? []) matches.set(Number(projectId), matched);
    return matches;
  }, [preview.data]);

  const approved = useMemo(
    () =>
      (campaigns.data ?? []).filter(
        (campaign) => campaign.status.tag === "Approved" && !isDemoArtifact(campaign.title),
      ),
    [campaigns.data],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = approved.filter((campaign) => {
      if (category && campaign.category.tag !== category) return false;
      if (query && !`${campaign.title} ${campaign.story}`.toLowerCase().includes(query)) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "mostBacked") {
      sorted.sort((a, b) => descBig(a.lifetime_direct, b.lifetime_direct));
    } else if (sort === "newest") {
      sorted.sort((a, b) => descBig(a.created_ledger, b.created_ledger));
    } else {
      sorted.sort((a, b) => {
        const scopeOrder = Number(inScope(b)) - Number(inScope(a));
        return scopeOrder !== 0
          ? scopeOrder
          : descBig(a.lifetime_direct, b.lifetime_direct);
      });
    }
    return sorted;
    // `inScope` is derived from the round data captured by these dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, category, search, sort, roundId, openRound.data]);

  const filtersActive = category !== null || search.trim() !== "";
  const resetFilters = () => {
    setCategory(null);
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-7 lg:px-10 lg:py-16">
      <header className="border-b-2 border-ink pb-8">
        <span className="mono text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
          {`// ${l.directoryComment}`}
        </span>
        <div className="mt-3 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="display max-w-5xl text-[clamp(3rem,8vw,7.8rem)] leading-[.86] text-ink">
              {d.heading}
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-ink/65">
              {d.tagline}
            </p>
          </div>
          <Link href="/campaign/new" className="btn shrink-0 bg-ink text-paper">
            {d.createCta}
          </Link>
        </div>
      </header>

      <div className="mt-7 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            {d.allFilter}
          </FilterChip>
          {ALL_CATEGORIES.map((tag) => (
            <FilterChip key={tag} active={category === tag} onClick={() => setCategory(tag)}>
              {categoryMeta(tag, strings.categories).label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-paper/65 p-2.5 shadow-[0_10px_30px_rgba(7,18,15,.05)] sm:flex-row sm:items-center sm:justify-between">
          <label className="group relative flex-1 sm:max-w-xl">
            <SearchIcon />
            <input
              type="search"
              aria-label={d.searchLabel}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={d.searchPlaceholder}
              className={`w-full rounded-full border border-ink/15 bg-paper py-2.5 pl-10 text-sm font-semibold text-ink shadow-[0_1px_0_rgba(7,18,15,.04)] placeholder:text-ink/40 transition-all hover:border-green/50 focus:border-green focus:bg-white focus:outline-none focus:shadow-[0_0_0_3px_rgba(13,141,99,.13)] ${search ? "pr-10" : "pr-4"}`}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={d.resetFilters}
                title={d.resetFilters}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <CloseIcon />
              </button>
            ) : null}
          </label>

          <div className="flex items-center justify-between gap-3 pl-2 text-sm font-semibold text-ink/60 sm:justify-end">
            <span className="whitespace-nowrap">{d.sortLabel}</span>
            <SelectMenu
              value={sort}
              onChange={setSort}
              ariaLabel={d.sortLabel}
              options={[
                { value: "mostBacked", label: d.sort.mostBacked },
                { value: "newest", label: d.sort.newest },
                { value: "closingSoon", label: d.sort.closingSoon },
              ]}
              className="w-48"
            />
          </div>
        </div>
      </div>

      <div className="mt-10">
        {campaigns.data === undefined ? (
          campaigns.isError ? (
            <ErrorPanel onRetry={() => campaigns.refetch()} />
          ) : (
            <SkeletonGrid />
          )
        ) : approved.length === 0 ? (
          <EmptyPanel message={d.emptyApproved} />
        ) : visible.length === 0 ? (
          <EmptyPanel
            message={d.emptyFiltered}
            action={filtersActive ? { label: d.resetFilters, onClick: resetFilters } : undefined}
          />
        ) : (
          <>
            {campaigns.isError ? (
              <p className="mb-3 text-xs text-clay">{strings.staleData}</p>
            ) : null}
            <p className="mono mb-5 text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
              {d.resultCount(visible.length)} · {l.seasonRef(roundId ?? "—")}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  roundId={roundId}
                  inScope={inScope(campaign)}
                  projectedMatch={matchOf.get(campaign.id)}
                  pool={openRound.data?.pool ?? 0n}
                  roundEnd={openRound.data?.round_end}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-ink/15 bg-transparent text-ink/70 hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="9" cy="9" r="6" />
      <path d="m14 14 3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      className="size-3.5"
    >
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="skeleton aspect-[16/9]" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="state-panel px-6 py-16 text-center">
      <p className="text-muted">{message}</p>
      {action ? (
        <button type="button" onClick={action.onClick} className="action-link mt-4">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const strings = useStrings();
  return (
    <div className="state-panel px-6 py-16 text-center">
      <p className="text-ink">{strings.errorGeneric}</p>
      <button type="button" onClick={onRetry} className="action-link mt-4">
        {strings.retry}
      </button>
    </div>
  );
}
