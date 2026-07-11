"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { useCampaigns, useOpenRound, usePreviewRound, useRoundProjects } from "@/lib/hooks";
import { ALL_CATEGORIES, categoryMeta, type CategoryTag } from "@/lib/category";
import { isDemoArtifact } from "@/lib/demo";
import { RoundBanner } from "@/components/RoundBanner";
import { HowItWorks } from "@/components/HowItWorks";
import { CampaignCard } from "@/components/CampaignCard";
import { formatCompactIDR, truncateAddress } from "@/lib/format";
import { brand } from "@/brand";
import { config } from "@/lib/config";
import { getProjectVisual, heroVisual as heroBackdrop } from "@/lib/projectVisuals";
import { CountUp, ParallaxImg, Reveal } from "@/components/motion";
import { SelectMenu } from "@/components/SelectMenu";

type SortKey = "mostBacked" | "newest" | "closingSoon";

/** bigint-safe descending comparator. */
const descBig = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0);

/**
 * Discovery `/` — a marketing hero over live chain state, followed by the public directory:
 * every campaign, filtered to `Approved` client-side, with category / search / sort. The hero's
 * "crowd share" and per-campaign bars come from the same `usePreviewRound` data the grid uses;
 * there's no separate Finalized state here since `useOpenRound` only ever surfaces the live Open
 * round (the Finalized view lives at `/results`).
 */
export default function DiscoveryPage() {
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
    () =>
      (campaigns.data ?? []).filter(
        (c) => c.status.tag === "Approved" && !isDemoArtifact(c.title),
      ),
    [campaigns.data],
  );

  // Hero stats: pool, crowd share, and per-campaign match bars over this round's in-scope campaigns.
  const inScopeApproved = useMemo(
    () => approved.filter(inScope),
    // inScope depends on openRound.data/roundId, captured via approved/scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approved, roundId, openRound.data],
  );
  const roundProjects = useRoundProjects(
    roundId,
    inScopeApproved.map((c) => c.id),
  );
  const donorCount = roundProjects.reduce((sum, q) => sum + (q.data?.[1] ?? 0), 0);
  const pool = openRound.data?.pool ?? 0n;
  const heroRows = inScopeApproved.map((project, i) => ({
    project,
    match: matchOf.get(project.id) ?? 0n,
    donors: roundProjects[i]?.data?.[1],
  }));
  const topRow = [...heroRows].sort((a, b) => Number(b.match - a.match))[0];
  const maxMatch = heroRows.reduce((max, row) => (row.match > max ? row.match : max), 0n);
  const crowdShare = topRow && pool > 0n ? Math.round(Number((topRow.match * 100n) / pool)) : 0;
  const heroProject = topRow?.project;
  const heroVisual = getProjectVisual(heroProject?.id ?? 0);
  const statusLabel = openRound.data ? strings.landing.statusOpen : d.noRound;

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
    <>
      <section className="relative min-h-[calc(100vh-6rem)] overflow-hidden">
        <ParallaxImg
          className="h-[112%] w-full object-cover opacity-70"
          src={heroBackdrop.image}
          alt="Petani menggarap sawah terasering di Indonesia"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(215,255,95,.18),transparent_32rem),linear-gradient(90deg,rgba(7,18,15,.94),rgba(7,18,15,.48)_48%,rgba(7,18,15,.68))]" />
        <div className="chain-grid absolute inset-0 opacity-70" />

        <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1500px] items-end gap-8 px-4 pb-8 pt-12 sm:px-7 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-10">
          <div>
            <Reveal mode="load" y={18}>
              <div className="flex flex-wrap gap-2">
                {l.heroTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </Reveal>

            <h1 className="display mt-8 max-w-4xl text-[clamp(3.2rem,8.4vw,8.6rem)] leading-[.86] text-paper">
              <Reveal mode="load" delay={0.06} y={44} className="overflow-hidden">
                <span className="block">Crowd</span>
              </Reveal>
              <Reveal mode="load" delay={0.14} y={44} className="overflow-hidden">
                <span className="block">
                  beats <span className="text-lime">whale.</span>
                </span>
              </Reveal>
            </h1>

            <div className="mt-8 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
              <Reveal mode="load" delay={0.26}>
                <p className="max-w-xl text-lg font-semibold leading-8 text-white/75">
                  {l.heroLede}
                </p>
              </Reveal>

              <Reveal mode="load" delay={0.34}>
                {/* Lime marks only the number the chain attests live — the donor count.
                    Money and status stay paper (One Verdict Rule). */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="glass-dark rounded-3xl p-4">
                    <span className="text-xs font-black uppercase tracking-[.14em] text-white/60">
                      {l.heroPoolLabel}
                    </span>
                    <strong className="num mt-2 block text-[1.45rem] font-black text-paper">
                      {pool > 0n ? (
                        <CountUp value={Number(pool)} format={formatCompactIDR} />
                      ) : (
                        l.waitingPool
                      )}
                    </strong>
                  </div>
                  <div className="glass-dark rounded-3xl p-4">
                    <span className="text-xs font-black uppercase tracking-[.14em] text-white/60">
                      {l.heroDonorLabel}
                    </span>
                    <strong className="num mt-2 block text-[1.45rem] font-black text-lime">
                      <CountUp value={donorCount} />
                    </strong>
                  </div>
                  <div className="glass-dark rounded-3xl p-4">
                    <span className="text-xs font-black uppercase tracking-[.14em] text-white/60">
                      {l.heroStatusLabel}
                    </span>
                    <strong className="num mt-2 block text-[1.45rem] font-black text-paper">
                      {statusLabel}
                    </strong>
                  </div>
                </div>
              </Reveal>
            </div>

            <Reveal mode="load" delay={0.44}>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="hash-chip">
                  <span className="size-1.5 rounded-full bg-lime" />
                  contract: {truncateAddress(config.contractId)}
                </span>
                <span className="hash-chip">network: {config.network}</span>
                <span className="hash-chip">admin: {truncateAddress(config.adminAddress)}</span>
                <span className="hash-chip">asset: {truncateAddress(config.tokenId)}</span>
              </div>
            </Reveal>

            <Reveal mode="load" delay={0.52}>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="btn btn-lime" href="#app">
                  {l.primaryCta}
                </a>
                <Link className="btn btn-ghost" href="/results">
                  {l.secondaryCta}
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal mode="load" delay={0.3} y={40}>
          <aside className="glass-dark scanline rounded-[2rem] p-4 sm:p-5 lg:p-6">
            <div className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
              <div className="relative min-h-[330px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-paper text-ink">
                <img
                  className="absolute inset-0 h-full w-full object-cover"
                  src={heroVisual.image}
                  alt={heroProject?.title ?? "Proyek Patungan"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-paper">
                  <span className="rounded-full bg-lime px-3 py-1 text-xs font-black uppercase text-ink">
                    {l.liveProjectBadge}
                  </span>
                  <h2 className="mt-3 text-3xl font-black leading-none">
                    {heroProject?.title ?? l.waitingProjectTitle}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    {heroProject ? l.heroTopLine(topRow.donors ?? 0) : l.heroTopLineEmpty}
                  </p>
                </div>
              </div>

              <div className="chain-panel rounded-[1.5rem] p-5">
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-black uppercase tracking-[.16em] text-lime/75">
                        {l.matchEngineLabel}
                      </span>
                      <h2 className="mt-2 text-2xl font-black">{l.matchEngineTitle}</h2>
                      <p className="mono mt-2 text-xs font-bold text-white/60">
                        fn finalize(round_id: {roundId ?? "—"}) -&gt; allocation[]
                      </p>
                    </div>
                    <span className="rounded-full border border-lime/30 px-3 py-1 text-xs font-black text-lime">
                      {openRound.data ? brand.machine.ready : brand.machine.idle}
                    </span>
                  </div>

                  <div className="relative mx-auto mt-8 grid size-56 place-items-center rounded-full bg-[conic-gradient(from_160deg,var(--tw-gradient-from)_0_82%,rgba(255,255,255,.08)_82%_100%)] from-lime p-3">
                    <div className="grid size-full place-items-center rounded-full bg-ink text-center">
                      <div>
                        <span className="text-xs font-black uppercase tracking-[.18em] text-white/55">
                          {l.crowdShareLabel}
                        </span>
                        <strong className="mt-2 block text-5xl font-black text-lime">
                          {crowdShare}%
                        </strong>
                        <span className="mt-2 block text-xs font-bold text-white/50">
                          {l.ofPoolSuffix}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 space-y-3">
                    {heroRows.length === 0 ? (
                      <p className="text-sm font-semibold text-white/50">{strings.loading}</p>
                    ) : (
                      heroRows.map(({ project, match }) => {
                        const width =
                          maxMatch > 0n ? Math.max(Number((match * 100n) / maxMatch), 4) : 4;
                        return (
                          <div key={project.id}>
                            <div className="mb-1 flex justify-between gap-3 text-xs font-black uppercase tracking-[.12em] text-white/55">
                              <span>{project.title}</span>
                              <span>{pool > 0n ? Number((match * 100n) / pool) : 0}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-lime"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[brand.machine.escrow, brand.machine.registry, brand.machine.payout].map(
                      (label) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                          <span className="mono text-[10px] font-black uppercase text-white/55">
                            {label}
                          </span>
                          <strong className="mt-1 block text-sm font-black text-lime">
                            {label === brand.machine.payout
                              ? brand.machine.queued
                              : brand.machine.live}
                          </strong>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
          </Reveal>
        </div>
      </section>

      <section className="overflow-hidden border-y border-white/10 bg-lime py-4 text-ink">
        {/* Brand-register strip: deliberate EN/ID pairs, constant across locales (src/brand.ts). */}
        <div className="marquee gap-8 text-2xl font-black uppercase sm:text-4xl">
          {brand.marquee.map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="bg-ink px-4 py-14 text-paper sm:px-7 lg:px-10 lg:py-20">
        <div className="mx-auto grid max-w-[1500px] items-start gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <Reveal>
            <div className="lg:sticky lg:top-32">
              <span className="tag">{l.proofTag}</span>
              {/* "Trust compiled." is a display slogan — brand register, constant across locales. */}
              <h2 className="display mt-4 text-[clamp(2.3rem,4.2vw,4.6rem)] leading-[.9]">
                Trust compiled.
              </h2>
              <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-white/65">
                {l.proofBody}
              </p>
            </div>
          </Reveal>

          <div className="chain-panel rounded-[2rem] p-5 sm:p-8">
            <div className="relative z-10">
              <p className="mono text-[11px] font-bold text-white/60">
                {`// patungan.wasm — ${l.proofComment}`}
              </p>
              <ol className="mt-4">
                {[
                  ["fund_pool", "(sponsor, amount)", l.proofSteps[0].title, l.proofSteps[0].copy],
                  ["verify", "(addr, tier)", l.proofSteps[1].title, l.proofSteps[1].copy],
                  ["contribute", "(donor, project, amt)", l.proofSteps[2].title, l.proofSteps[2].copy],
                ].map(([fn, sig, title, copy], i) => (
                  <Reveal key={fn} delay={i * 0.08}>
                    <li className="grid gap-2 border-b border-white/10 py-5 sm:grid-cols-[minmax(15rem,.9fr)_1.1fr] sm:items-baseline sm:gap-6">
                      <span className="mono text-sm font-bold text-lime/80">
                        <span className="text-white/55">{String(i + 1).padStart(2, "0")}&nbsp;&nbsp;</span>
                        {fn}
                        <span className="text-white/55">{sig}</span>
                      </span>
                      <span>
                        <h3 className="text-lg font-black">{title}</h3>
                        <p className="mt-1 text-sm font-semibold leading-6 text-white/50">{copy}</p>
                      </span>
                    </li>
                  </Reveal>
                ))}
                <Reveal delay={0.24}>
                  <li className="mt-5 grid gap-2 rounded-[1.35rem] bg-lime p-5 text-ink sm:grid-cols-[minmax(15rem,.9fr)_1.1fr] sm:items-baseline sm:gap-6">
                    <span className="mono text-sm font-bold">
                      <span className="text-ink/60">04&nbsp;&nbsp;</span>
                      finalize<span className="text-ink/55">(round_id)</span>
                    </span>
                    <span>
                      <h3 className="text-lg font-black">{l.proofSteps[3].title}</h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-ink/70">
                        {l.proofSteps[3].copy}
                      </p>
                    </span>
                  </li>
                </Reveal>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <main id="app" className="bg-cream">
        <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-7 lg:px-10 lg:py-16">
        <RoundBanner query={openRound} />

        <HowItWorks />

        <Reveal>
          <div className="mt-16 border-t-2 border-ink pt-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <span className="mono text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
                  {`// ${l.directoryComment}`}
                </span>
                <h1 className="display mt-3 text-4xl leading-none text-ink sm:text-6xl">
                  {d.heading}
                </h1>
                <p className="mt-3 max-w-xl font-semibold text-ink/70">{d.tagline}</p>
              </div>
              <Link href="/campaign/new" className="btn shrink-0 bg-ink text-paper">
                {d.createCta}
              </Link>
            </div>
          </div>
        </Reveal>

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
                {categoryMeta(tag, strings.categories).label}
              </FilterChip>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-paper/65 p-2.5 shadow-[0_10px_30px_rgba(7,18,15,.05)] sm:flex-row sm:items-center sm:justify-between">
            <label className="group relative flex-1 sm:max-w-md">
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                <p className="mb-3 text-xs text-clay">{strings.staleData}</p>
              ) : null}
              <p className="mono mb-5 text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
                {d.resultCount(visible.length)} · {l.seasonRef(roundId ?? "—")}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    roundId={roundId}
                    inScope={inScope(c)}
                    projectedMatch={matchOf.get(c.id)}
                    pool={pool}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </main>
    </>
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
  const strings = useStrings();
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
