"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { strings } from "@/strings";
import { useCampaigns, useOpenRound, usePreviewRound, useRoundProjects } from "@/lib/hooks";
import { ALL_CATEGORIES, categoryMeta, type CategoryTag } from "@/lib/category";
import { RoundBanner } from "@/components/RoundBanner";
import { HowItWorks } from "@/components/HowItWorks";
import { CampaignCard } from "@/components/CampaignCard";
import { formatCompactIDR, formatIDR } from "@/lib/format";
import { config } from "@/lib/config";
import { getProjectVisual, heroVisual as heroBackdrop } from "@/lib/projectVisuals";
import { CountUp, ParallaxImg, Reveal } from "@/components/motion";

const d = strings.discovery;

type SortKey = "mostBacked" | "newest" | "closingSoon";

/** bigint-safe descending comparator. */
const descBig = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0);

function shortAddress(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Discovery `/` — a marketing hero over live chain state, followed by the public directory:
 * every campaign, filtered to `Approved` client-side, with category / search / sort. The hero's
 * "crowd share" and per-campaign bars come from the same `usePreviewRound` data the grid uses;
 * there's no separate Finalized state here since `useOpenRound` only ever surfaces the live Open
 * round (the Finalized view lives at `/results`).
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
          className="h-[112%] w-full object-cover opacity-60"
          src={heroBackdrop.image}
          alt="Petani menggarap sawah terasering di Indonesia"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(215,255,95,.18),transparent_32rem),linear-gradient(90deg,rgba(7,18,15,.96),rgba(7,18,15,.58)_48%,rgba(7,18,15,.76))]" />
        <div className="chain-grid absolute inset-0 opacity-70" />

        <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1500px] items-end gap-8 px-4 pb-8 pt-12 sm:px-7 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-10">
          <div>
            <Reveal mode="load" y={18}>
              <div className="flex flex-wrap gap-2">
                <span className="tag">Payment & Consumer App</span>
                <span className="tag">PMI/TKI diaspora</span>
                <span className="tag">Quadratic matching</span>
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
                  Rp50 ribu dari banyak perantau bukan cuma donasi. Di Patungan,
                  setiap kontribusi menjadi sinyal publik yang menarik pool sponsor
                  ke proyek desa paling didukung.
                </p>
              </Reveal>

              <Reveal mode="load" delay={0.34}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="glass-dark rounded-3xl p-4">
                    <span className="text-xs font-black uppercase tracking-[.14em] text-white/60">
                      Pool
                    </span>
                    <strong className="num mt-2 block text-[1.45rem] font-black text-lime">
                      {pool > 0n ? (
                        <CountUp value={Number(pool)} format={formatCompactIDR} />
                      ) : (
                        "Waiting"
                      )}
                    </strong>
                  </div>
                  <div className="glass-dark rounded-3xl p-4">
                    <span className="text-xs font-black uppercase tracking-[.14em] text-white/60">
                      Donor
                    </span>
                    <strong className="num mt-2 block text-[1.45rem] font-black text-lime">
                      <CountUp value={donorCount} />
                    </strong>
                  </div>
                  <div className="glass-dark rounded-3xl p-4">
                    <span className="text-xs font-black uppercase tracking-[.14em] text-white/60">
                      Status
                    </span>
                    <strong className="num mt-2 block text-[1.45rem] font-black text-lime">
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
                  contract: {shortAddress(config.contractId)}
                </span>
                <span className="hash-chip">network: {config.network}</span>
                <span className="hash-chip">admin: {shortAddress(config.adminAddress)}</span>
                <span className="hash-chip">asset: {shortAddress(config.tokenId)}</span>
              </div>
            </Reveal>

            <Reveal mode="load" delay={0.52}>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="btn btn-lime" href="#app">
                  Lihat proyek
                </a>
                <Link className="btn btn-ghost" href="/operator">
                  Finalize match
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
                  <span className="rounded-full bg-lime px-3 py-1 text-xs font-black text-ink">
                    LIVE PROJECT
                  </span>
                  <h2 className="mt-3 text-3xl font-black leading-none">
                    {heroProject?.title ?? "Menunggu data proyek"}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    {heroProject
                      ? `${topRow.donors ?? 0} donor menarik match terbesar.`
                      : "Hubungkan deployment untuk melihat data live."}
                  </p>
                </div>
              </div>

              <div className="chain-panel rounded-[1.5rem] p-5">
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-black uppercase tracking-[.16em] text-lime/75">
                        Match engine
                      </span>
                      <h2 className="mt-2 text-2xl font-black">Finalisasi Soroban</h2>
                      <p className="mono mt-2 text-xs font-bold text-white/60">
                        fn finalize(round_id: {roundId ?? "—"}) -&gt; allocation[]
                      </p>
                    </div>
                    <span className="rounded-full border border-lime/30 px-3 py-1 text-xs font-black text-lime">
                      {openRound.data ? "READY" : "IDLE"}
                    </span>
                  </div>

                  <div className="relative mx-auto mt-8 grid size-56 place-items-center rounded-full bg-[conic-gradient(from_160deg,var(--tw-gradient-from)_0_82%,rgba(255,255,255,.08)_82%_100%)] from-lime p-3">
                    <div className="grid size-full place-items-center rounded-full bg-ink text-center">
                      <div>
                        <span className="text-xs font-black uppercase tracking-[.18em] text-white/55">
                          Crowd share
                        </span>
                        <strong className="mt-2 block text-5xl font-black text-lime">
                          {crowdShare}%
                        </strong>
                        <span className="mt-2 block text-xs font-bold text-white/50">
                          of matching pool
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
                    {["escrow", "registry", "payout"].map((label) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <span className="mono text-[10px] font-black uppercase text-white/55">
                          {label}
                        </span>
                        <strong className="mt-1 block text-sm font-black text-lime">
                          {label === "payout" ? "queued" : "live"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
          </Reveal>
        </div>
      </section>

      <section className="overflow-hidden border-y border-white/10 bg-lime py-4 text-ink">
        <div className="marquee gap-8 text-2xl font-black uppercase sm:text-4xl">
          {[
            "Rp50rb x 200 perantau > Rp10jt x 1 donor",
            "Dana padanan mengikuti jumlah orang",
            "Soroban records every contribution",
            "Contract computes (sum sqrt c)^2",
            "Verified-address registry blocks sybil donors",
            "Public payout, no backroom allocation",
            "Rp50rb x 200 perantau > Rp10jt x 1 donor",
            "Dana padanan mengikuti jumlah orang",
          ].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="bg-ink px-4 py-14 text-paper sm:px-7 lg:px-10 lg:py-20">
        <div className="mx-auto grid max-w-[1500px] items-start gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <Reveal>
            <div className="lg:sticky lg:top-32">
              <span className="tag">Soroban proof layer</span>
              <h2 className="display mt-4 text-[clamp(2.3rem,4.2vw,4.6rem)] leading-[.9]">
                Trust compiled.
              </h2>
              <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-white/65">
                Bumbu blockchain-nya bukan tempelan: contract menyaksikan kontribusi,
                registry membatasi sybil, dan payout keluar dari math yang bisa diaudit.
              </p>
            </div>
          </Reveal>

          <div className="chain-panel rounded-[2rem] p-5 sm:p-8">
            <div className="relative z-10">
              <p className="mono text-[11px] font-bold text-white/60">
                // patungan.wasm — jalur satu musim pencocokan
              </p>
              <ol className="mt-4">
                {[
                  ["fund_pool", "(sponsor, amount)", "Pool escrow", "Sponsor deposit ke contract, bukan ke rekening panitia."],
                  ["verify", "(addr, tier)", "One ID, one address", "Verified registry membatasi sybil: satu identitas, satu suara."],
                  ["contribute", "(donor, project, amt)", "Tagged donations", "Setiap chip-in tercatat dengan donor, project_id, amount, dan ledger."],
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
                      <h3 className="text-lg font-black">QF allocation</h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-ink/70">
                        Contract menghitung (Σ√c)² per kampanye dan membagi matching pool —
                        yang menang jumlah orang, bukan satu whale.
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
                  // direktori publik — semua kampanye terverifikasi kurator
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
                className="w-full rounded-full border border-ink/15 bg-paper py-2.5 pl-10 pr-4 text-sm font-semibold text-ink placeholder:text-ink/40 transition-colors focus:border-ink focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-ink/60">
              <span className="whitespace-nowrap">{d.sortLabel}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-full border border-ink/15 bg-paper py-2.5 pl-4 pr-8 text-sm font-bold text-ink transition-colors focus:border-ink focus:outline-none"
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
                <p className="mb-3 text-xs text-clay">{strings.staleData}</p>
              ) : null}
              <p className="mono mb-5 text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
                {d.resultCount(visible.length)} · musim #{roundId ?? "—"}
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
