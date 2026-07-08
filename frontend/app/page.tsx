"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { strings } from "@/strings";
import { useCampaigns, useOpenRound, usePreviewRound } from "@/lib/hooks";
import { ALL_CATEGORIES, categoryMeta, type CategoryTag } from "@/lib/category";
import { RoundBanner } from "@/components/RoundBanner";
import { HowItWorks } from "@/components/HowItWorks";
import { CampaignCard } from "@/components/CampaignCard";

const d = strings.discovery;

type SortKey = "mostBacked" | "newest" | "closingSoon";

/** bigint-safe descending comparator. */
const descBig = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0);

/**
 * Discovery `/` — the public directory over live chain state. Reads every
 * campaign, filters to `Approved` client-side, and offers category / search / sort over them. The
 * season banner and each card's projected-match figure come from the single open round; a campaign
 * shows a match only when it is in that round's category scope.
 */
export default function DiscoveryPage() {
  const campaigns = useCampaigns();
  const openRound = useOpenRound();
  const roundId = openRound.data?.id ?? null;
  const preview = usePreviewRound(roundId);

  const [category, setCategory] = useState<CategoryTag | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("mostBacked");

  // Which categories the open round matches (empty scope = all in scope).
  const scope = openRound.data?.categories ?? [];
  const inScope = (c: ProjectState) =>
    roundId !== null && (scope.length === 0 || scope.some((s) => s.tag === c.category.tag));

  const matchOf = useMemo(() => {
    const m = new Map<number, bigint>();
    for (const [pid, matched] of preview.data ?? []) m.set(Number(pid), matched);
    return m;
  }, [preview.data]);

  const approved = useMemo(
    () => (campaigns.data ?? []).filter((c) => c.status.tag === "Approved"),
    [campaigns.data],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = approved.filter((c) => {
      if (category && c.category.tag !== category) return false;
      if (q && !`${c.title} ${c.story}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "mostBacked") {
      sorted.sort((a, b) => descBig(a.lifetime_direct, b.lifetime_direct));
    } else if (sort === "newest") {
      sorted.sort((a, b) => descBig(a.created_ledger, b.created_ledger));
    } else {
      // closing-soon: campaigns in the round that's closing come first, then most-backed.
      sorted.sort((a, b) => {
        const s = Number(inScope(b)) - Number(inScope(a));
        return s !== 0 ? s : descBig(a.lifetime_direct, b.lifetime_direct);
      });
    }
    return sorted;
    // inScope depends on openRound.data/roundId, captured via approved/scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, category, search, sort, roundId, openRound.data]);

  const filtersActive = category !== null || search.trim() !== "";
  const resetFilters = () => {
    setCategory(null);
    setSearch("");
  };

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
      <RoundBanner query={openRound} />

      <HowItWorks />

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {d.heading}
          </h1>
          <p className="mt-1 text-muted">{d.tagline}</p>
        </div>
        <Link
          href="/campaign/new"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
        >
          {d.createCta}
        </Link>
      </div>

      {/* Controls: category chips + search + sort */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            {d.allFilter}
          </FilterChip>
          {ALL_CATEGORIES.map((tag) => (
            <FilterChip
              key={tag}
              active={category === tag}
              onClick={() => setCategory(tag)}
            >
              {categoryMeta(tag).label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative flex-1 sm:max-w-sm">
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={d.searchPlaceholder}
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">{d.sortLabel}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-line bg-surface py-2.5 pl-3 pr-8 text-sm font-medium text-ink transition-colors focus:border-accent focus:outline-none"
            >
              <option value="mostBacked">{d.sort.mostBacked}</option>
              <option value="newest">{d.sort.newest}</option>
              <option value="closingSoon">{d.sort.closingSoon}</option>
            </select>
          </label>
        </div>
      </div>

      {/* Grid — four states */}
      <div className="mt-8">
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
              <p className="mb-3 text-xs text-amber-700">{strings.staleData}</p>
            ) : null}
            <p className="mb-4 text-sm text-faint">{d.resultCount(visible.length)}</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  roundId={roundId}
                  inScope={inScope(c)}
                  projectedMatch={matchOf.get(c.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
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
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-surface text-muted hover:border-accent/40 hover:bg-accent-soft hover:text-accent-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
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

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="aspect-[16/9] animate-pulse bg-line/50" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-line/50" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-line/50" />
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
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <p className="text-muted">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 text-sm font-medium text-accent-ink underline underline-offset-4 hover:text-accent"
        >
          {action.label}
        </button>
      ) : null}
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
