"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import { useCampaigns, useOpenRound, usePreviewRound, useRoundProjects } from "@/lib/hooks";
import { isDemoArtifact } from "@/lib/demo";
import { RoundBanner } from "@/components/RoundBanner";
import { HowItWorks } from "@/components/HowItWorks";
import { formatCompactIDR, truncateAddress } from "@/lib/format";
import { brand } from "@/brand";
import { config } from "@/lib/config";
import { getProjectVisual, heroVisual as heroBackdrop } from "@/lib/projectVisuals";
import { CountUp, ParallaxImg, Reveal } from "@/components/motion";

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
                <span className="block max-w-[10ch]">{l.heroTitle}</span>
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
                <Link className="btn btn-lime" href="/campaigns">
                  {l.primaryCta}
                </Link>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-black uppercase tracking-[.16em] text-lime">
                        {l.matchEngineLabel}
                      </span>
                      <h2 className="mt-2 text-2xl font-black text-paper">{l.matchEngineTitle}</h2>
                      <p className="mt-2 max-w-[24rem] text-xs font-semibold leading-5 text-white/70">
                        {openRound.data
                          ? `${strings.discovery.season} #${roundId} · ${strings.discovery.live}`
                          : strings.discovery.noRound}
                      </p>
                    </div>
                    <span className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full border border-lime/50 bg-lime/10 px-3 py-1 text-xs font-black leading-none text-lime">
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
              <p className="text-xs font-black uppercase tracking-[.14em] text-lime/80">
                {l.proofComment}
              </p>
              <ol className="mt-4">
                {[
                  ["fund_pool", "(sponsor, amount)", l.proofSteps[0].title, l.proofSteps[0].copy],
                  ["verify", "(addr, tier)", l.proofSteps[1].title, l.proofSteps[1].copy],
                  ["contribute", "(donor, project, amt)", l.proofSteps[2].title, l.proofSteps[2].copy],
                ].map(([fn, sig, title, copy], i) => (
                  <Reveal key={fn} delay={i * 0.08}>
                    <li className="grid gap-3 border-b border-white/10 py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
                      <span className="mono text-sm font-black text-lime/75">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <h3 className="text-xl font-black text-paper">{title}</h3>
                        <p className="mt-2 max-w-[54ch] text-sm font-semibold leading-6 text-white/70">{copy}</p>
                        <span className="mono mt-3 inline-flex rounded-md border border-white/15 bg-black/20 px-2.5 py-1.5 text-[11px] font-bold text-white/65">
                          {fn}{sig}
                        </span>
                      </span>
                    </li>
                  </Reveal>
                ))}
                <Reveal delay={0.24}>
                  <li className="mt-5 grid gap-3 rounded-[1.35rem] bg-lime p-5 text-ink sm:grid-cols-[3rem_1fr] sm:gap-5">
                    <span className="mono text-sm font-black text-ink/60">04</span>
                    <span>
                      <h3 className="text-xl font-black">{l.proofSteps[3].title}</h3>
                      <p className="mt-2 max-w-[54ch] text-sm font-semibold leading-6 text-ink/75">
                        {l.proofSteps[3].copy}
                      </p>
                      <span className="mono mt-3 inline-flex rounded-md border border-ink/15 bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink/65">
                        finalize(round_id)
                      </span>
                    </span>
                  </li>
                </Reveal>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <main className="bg-cream">
        <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-7 lg:px-10 lg:py-16">
          <RoundBanner query={openRound} />
          <HowItWorks />
        </div>
      </main>

      <section className="bg-lime px-4 py-14 text-ink sm:px-7 lg:px-10 lg:py-18">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <span className="mono text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
              {`// ${l.directoryComment}`}
            </span>
            <h2 className="display mt-3 max-w-4xl text-[clamp(2.7rem,6vw,6.4rem)] leading-[.88]">
              {d.heading}
            </h2>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-ink/70">
              {d.tagline}
            </p>
            <p className="mono mt-5 text-xs font-bold uppercase tracking-[.12em] text-ink/55">
              {d.resultCount(approved.length)} · {l.seasonRef(roundId ?? "—")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/campaigns" className="btn bg-ink text-paper">
              {l.primaryCta}
            </Link>
            <Link href="/campaign/new" className="btn border border-ink/25 bg-transparent text-ink">
              {d.createCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
