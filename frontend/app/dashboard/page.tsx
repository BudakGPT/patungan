"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { AssembledTransaction, Result } from "@stellar/stellar-sdk/contract";
import type { ProjectState, RoundState } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useCampaignContributions, useCampaigns, useRounds, useRoundProject } from "@/lib/hooks";
import { formatIDR, truncateAddress } from "@/lib/format";
import { categoryMeta } from "@/lib/category";
import { mapContractError } from "@/lib/errors";
import { useStrings } from "@/lib/locale";
import { ExplorerLink } from "@/components/ExplorerLink";

/**
 * Owner dashboard `/dashboard`. A reconciliation ledger, not a discovery grid:
 * one full-width row-card per campaign the connected wallet owns (every status), read top-to-bottom.
 * The headline number is `lifetime_direct`; the per-finalized-round matched payout decomposes below
 * it as a hairline-separated sub-section (never a nested card), each round carrying its own claim
 * affordance. Owners need no verification tier — the gate is just connect → Testnet. Claims auth the
 * project owner, so every claim signs with the connected wallet.
 */
export default function DashboardPage() {
  const strings = useStrings();
  const d = strings.dashboard;
  const { address, status, connect } = useWallet();

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
            {d.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{d.subtitle}</p>
        </div>
        <Link
          href="/campaign/new"
          className="btn shrink-0 border border-ink/15 bg-paper text-ink shadow-card hover:border-green/40 hover:bg-lime"
        >
          {d.createCta}
        </Link>
      </header>

      <div className="mt-8">
        <Gate
          status={status}
          connecting={status === "connecting"}
          onConnect={connect}
        >
          {address ? <OwnedCampaigns owner={address} /> : null}
        </Gate>
      </div>
    </main>
  );
}

/** Gate ladder — connect → Testnet → dashboard. No tier gate: any wallet may own campaigns. */
function Gate({
  status,
  connecting,
  onConnect,
  children,
}: {
  status: ReturnType<typeof useWallet>["status"];
  connecting: boolean;
  onConnect: () => Promise<void>;
  children: React.ReactNode;
}) {
  const strings = useStrings();
  const d = strings.dashboard;
  if (status === "not-installed" || status === "disconnected" || status === "connecting") {
    return (
      <Panel>
        <p className="text-sm text-muted">{d.connectPrompt}</p>
        <button
          type="button"
          disabled={connecting}
          onClick={() => void onConnect()}
          className="btn btn-lime mt-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connecting ? strings.wallet.connecting : strings.wallet.connect}
        </button>
      </Panel>
    );
  }
  if (status === "wrong-network") {
    return (
      <Panel>
        <p className="text-sm text-cat-disaster">{d.wrongNetwork}</p>
      </Panel>
    );
  }
  return <>{children}</>;
}

function OwnedCampaigns({ owner }: { owner: string }) {
  const strings = useStrings();
  const d = strings.dashboard;
  const campaigns = useCampaigns();
  const rounds = useRounds();
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "action">("all");

  const mine = useMemo(
    () => (campaigns.data ?? []).filter((c) => c.owner === owner),
    [campaigns.data, owner],
  );
  // Finalized rounds, newest first — the only rounds whose matched payout is claimable.
  const finalized = useMemo(
    () =>
      (rounds.data ?? [])
        .filter((r) => r.status.tag === "Finalized")
        .sort((a, b) => b.id - a.id),
    [rounds.data],
  );

  const visible = useMemo(
    () =>
      mine.filter((campaign) => {
        if (filter === "active") return campaign.status.tag === "Approved";
        if (filter === "pending") return campaign.status.tag === "Pending";
        if (filter === "action") return campaign.unrounded_direct > 0n;
        return true;
      }),
    [filter, mine],
  );

  const summary = useMemo(
    () => ({
      active: mine.filter((campaign) => campaign.status.tag === "Approved").length,
      raised: mine.reduce((total, campaign) => total + campaign.lifetime_direct, 0n),
      claimable: mine.reduce((total, campaign) => total + campaign.unrounded_direct, 0n),
      actionCount: mine.filter((campaign) => campaign.unrounded_direct > 0n).length,
    }),
    [mine],
  );

  // Loading — skeleton ledger rows (campaigns is the gating read; rounds fill in per card).
  if (campaigns.data === undefined) {
    if (campaigns.isError) {
      return (
        <Panel>
          <p className="text-sm text-cat-disaster">{strings.errorGeneric}</p>
        </Panel>
      );
    }
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (mine.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-paper px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">{d.empty}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{d.emptyHint}</p>
        <Link
          href="/campaign/new"
          className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
        >
          {d.createCta}
        </Link>
      </div>
    );
  }

  const filters = [
    ["all", d.filters.all],
    ["active", d.filters.active],
    ["pending", d.filters.pending],
    ["action", d.filters.action],
  ] as const;

  return (
    <div>
      <section aria-label={d.summary.campaigns} className="grid grid-cols-2 border-y-2 border-ink lg:grid-cols-4">
        {[
          [d.summary.campaigns, String(mine.length)],
          [d.summary.active, String(summary.active)],
          [d.summary.raised, formatIDR(summary.raised)],
          [d.summary.claimable, formatIDR(summary.claimable)],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={`min-w-0 px-4 py-5 ${index % 2 ? "border-l border-ink/15" : ""} ${index >= 2 ? "border-t border-ink/15 lg:border-t-0" : ""} lg:border-l lg:first:border-l-0`}
          >
            <p className="text-xs font-black uppercase tracking-[.12em] text-muted">{label}</p>
            <p className="tabular mt-2 truncate text-xl font-black text-ink sm:text-2xl">{value}</p>
          </div>
        ))}
      </section>

      {summary.actionCount > 0 ? (
        <section className="mt-6 flex flex-col gap-4 border-l-4 border-lime bg-ink px-5 py-5 text-paper sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black">{d.actionCenter.title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/65">
              {d.actionCenter.body(summary.actionCount)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter("action")}
            className="btn btn-lime shrink-0 self-start sm:self-auto"
          >
            {d.actionCenter.cta}
          </button>
        </section>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-2" aria-label={d.filters.label}>
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              filter === value
                ? "border-ink bg-ink text-paper"
                : "border-ink/15 bg-paper text-ink/65 hover:border-green/50 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm font-semibold text-muted">
            {d.filters.empty}
          </div>
        ) : (
          visible.map((campaign) => (
            <CampaignLedger key={campaign.id} campaign={campaign} finalized={finalized} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── One campaign row-card: headline + per-season claim ledger ───────────────────────────── */

function CampaignLedger({
  campaign,
  finalized,
}: {
  campaign: ProjectState;
  finalized: RoundState[];
}) {
  const strings = useStrings();
  const d = strings.dashboard;
  const { label, chip } = categoryMeta(campaign.category.tag, strings.categories);
  const [insightsOpen, setInsightsOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={campaign.status.tag} />
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip}`}>{label}</span>
          </div>
          <h2 className="mt-2 truncate text-lg font-semibold text-ink">{campaign.title}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-faint">{d.lifetimeLabel}</p>
          <p className="tabular mt-0.5 text-lg font-bold text-ink">
            {formatIDR(campaign.lifetime_direct)}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-faint">
          {d.seasonsHeading}
        </p>
        <div className="mt-3 space-y-2.5">
          {finalized.length === 0 ? (
            <p className="text-sm text-muted">{d.noSeasons}</p>
          ) : (
            finalized.map((r) => (
              <RoundClaimLine key={r.id} round={r} projectId={campaign.id} owner={campaign.owner} />
            ))
          )}
        </div>
      </div>

      {campaign.unrounded_direct > 0n ? (
        <DirectClaim projectId={campaign.id} owner={campaign.owner} amount={campaign.unrounded_direct} />
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={insightsOpen}
          onClick={() => setInsightsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-sm font-black text-ink transition-colors hover:text-match-ink"
        >
          {insightsOpen ? d.insights.hide : d.insights.show}
          <span
            aria-hidden
            className={`text-lg transition-transform ${insightsOpen ? "rotate-45" : ""}`}
          >
            +
          </span>
        </button>
        {insightsOpen ? <CampaignInsights campaignId={campaign.id} /> : null}
      </div>
    </article>
  );
}

function CampaignInsights({ campaignId }: { campaignId: number }) {
  const { dashboard: d } = useStrings();
  const contributions = useCampaignContributions(campaignId);

  if (contributions.data === undefined) {
    return contributions.isError ? (
      <p className="mt-4 text-sm text-cat-disaster">{d.insights.empty}</p>
    ) : (
      <div className="skeleton mt-4 h-28 rounded-xl" aria-hidden />
    );
  }

  if (contributions.data.length === 0) {
    return <p className="mt-4 text-sm text-muted">{d.insights.empty}</p>;
  }

  const recent = contributions.data.slice(0, 8).reverse();
  const max = recent.reduce((highest, item) => (item.amount > highest ? item.amount : highest), 1n);

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <section>
        <h3 className="text-xs font-black uppercase tracking-[.13em] text-faint">{d.insights.trend}</h3>
        <div className="mt-3 flex h-28 items-end gap-2 border-b border-line px-1 pb-2" aria-label={d.insights.trend}>
          {recent.map((item) => {
            const height = Math.max(Number((item.amount * 100n) / max), 8);
            return (
              <div key={item.txHash} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-green to-lime transition-opacity hover:opacity-75"
                  style={{ height: `${height}%` }}
                  title={`${formatIDR(item.amount)} · ${formatDate(item.at)}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-black uppercase tracking-[.13em] text-faint">{d.insights.activity}</h3>
        <ul className="mt-2 divide-y divide-line">
          {contributions.data.slice(0, 3).map((item) => (
            <li key={item.txHash} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span>
                <span className="font-black text-ink">{formatIDR(item.amount)}</span>
                <span className="ml-2 text-xs text-muted">
                  {d.insights.donor} {truncateAddress(item.donor)}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs text-muted">
                <time dateTime={item.at}>{formatDate(item.at)}</time>
                <ExplorerLink hash={item.txHash} label={d.insights.viewTx} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { dashboard: d } = useStrings();
  const tone =
    status === "Approved"
      ? "bg-match-soft text-match-ink"
      : status === "Pending"
        ? "bg-accent-soft text-accent-ink"
        : "bg-cat-disaster-soft text-cat-disaster";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {d.statusPill[status] ?? status}
    </span>
  );
}

/* ── One finalized round's line for this campaign ────────────────────────────────────────── */

function RoundClaimLine({
  round,
  projectId,
  owner,
}: {
  round: RoundState;
  projectId: number;
  owner: string;
}) {
  const { dashboard: d } = useStrings();
  const queryClient = useQueryClient();
  const action = useAction();
  const rp = useRoundProject(round.id, projectId);

  async function claim() {
    if (action.pending) return;
    const ok = await action.submit(() =>
      contractClient.claim({ round_id: round.id, project_id: projectId }, { publicKey: owner }),
    );
    if (ok !== undefined) {
      void queryClient.invalidateQueries({ queryKey: ["roundProject", round.id, projectId] });
    }
  }

  if (rp.data === undefined) {
    return <div className="skeleton h-12 rounded-xl" />;
  }

  // (direct, donors, matched, claimed) — the campaign participated only if it drew direct or match.
  const [direct, donors, matched, claimed] = rp.data;
  const participated = direct > 0n || matched > 0n;
  const succeeded = action.tx.phase === "success";

  // Didn't join this season — a slim honest line, no stat triplet, so the ledger stays scannable.
  if (!participated) {
    return (
      <div className="flex items-center justify-between gap-3 px-1 py-1.5 text-xs">
        <span className="font-medium text-muted">{d.round.label(round.id)}</span>
        <span className="text-faint">{d.round.nothing}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{d.round.label(round.id)}</p>
          <p className="tabular mt-1 text-xs text-muted">
            {d.round.directLabel} {formatIDR(direct)}
            <span className="mx-1.5 text-faint">·</span>
            {donors} {d.round.donorSuffix}
            <span className="mx-1.5 text-faint">·</span>
            <span className="font-medium text-ink">
              {d.round.matchedLabel} {formatIDR(matched)}
            </span>
          </p>
        </div>

        <div className="shrink-0">
          {matched <= 0n ? (
            <span className="text-xs text-faint">{d.round.nothing}</span>
          ) : claimed || succeeded ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-match-soft px-3 py-1.5 text-xs font-semibold text-match-ink">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                <path
                  d="M3.5 8.5l3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {d.round.claimed}
            </span>
          ) : (
            <button
              type="button"
              disabled={action.pending}
              onClick={() => void claim()}
              className="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:opacity-60"
            >
              {action.pending
                ? action.tx.phase === "submitting"
                  ? d.round.claiming
                  : d.awaiting
                : d.round.claim}
            </button>
          )}
        </div>
      </div>

      {action.tx.phase === "success" && action.tx.hash ? (
        <p className="mt-2 text-xs text-match-ink">
          <ExplorerLink hash={action.tx.hash} label={d.viewOnExplorer} />
        </p>
      ) : action.tx.phase === "error" ? (
        <p className="mt-2 text-xs text-cat-disaster">{action.tx.message}</p>
      ) : null}
    </div>
  );
}

/* ── Campaign-level claim of out-of-season direct donations ──────────────────────────────── */

function DirectClaim({
  projectId,
  owner,
  amount,
}: {
  projectId: number;
  owner: string;
  amount: bigint;
}) {
  const { dashboard: d } = useStrings();
  const queryClient = useQueryClient();
  const action = useAction();
  const succeeded = action.tx.phase === "success";

  async function claim() {
    if (action.pending) return;
    const ok = await action.submit(() =>
      contractClient.claim_unmatched({ project_id: projectId }, { publicKey: owner }),
    );
    if (ok !== undefined) {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign", projectId] });
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{d.direct.heading}</p>
          <p className="tabular mt-1 text-xs text-muted">
            {d.direct.body} <span className="font-medium text-ink">{formatIDR(amount)}</span>
          </p>
        </div>
        <div className="shrink-0">
          {succeeded ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-match-soft px-3 py-1.5 text-xs font-semibold text-match-ink">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                <path
                  d="M3.5 8.5l3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {d.round.claimed}
            </span>
          ) : (
            <button
              type="button"
              disabled={action.pending}
              onClick={() => void claim()}
              className="rounded-lg border border-accent bg-accent-soft px-3.5 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
            >
              {action.pending
                ? action.tx.phase === "submitting"
                  ? d.direct.claiming
                  : d.awaiting
                : d.direct.claim}
            </button>
          )}
        </div>
      </div>
      {action.tx.phase === "success" && action.tx.hash ? (
        <p className="mt-2 text-xs text-match-ink">
          <ExplorerLink hash={action.tx.hash} label={d.viewOnExplorer} />
        </p>
      ) : action.tx.phase === "error" ? (
        <p className="mt-2 text-xs text-cat-disaster">{action.tx.message}</p>
      ) : null}
    </div>
  );
}

/* ── Shared write cycle (mirrors the operator console) ───────────────────────────────────── */

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

/**
 * The assemble+simulate → sign → send cycle every claim shares, mapping each failure (simulation
 * throw or on-chain `isErr`) to Bahasa via the shared error dictionary. Returns the unwrapped
 * result on success, `undefined` on failure — the caller then invalidates the affected reads.
 */
function useAction() {
  const strings = useStrings();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const pending = tx.phase === "awaiting" || tx.phase === "submitting";

  async function submit<T>(
    build: () => Promise<AssembledTransaction<Result<T>>>,
  ): Promise<T | undefined> {
    setTx({ phase: "awaiting" });
    try {
      const assembled = await build();
      const sent = await assembled.signAndSend({
        signTransaction: freighterApi.signTransaction,
        watcher: {
          onSubmitted: () => setTx({ phase: "submitting" }),
          onProgress: () => {},
        },
      });
      if (sent.result.isErr()) {
        setTx({ phase: "error", message: mapContractError(sent.result.unwrapErr(), strings.errors) });
        return undefined;
      }
      setTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
      return sent.result.unwrap();
    } catch (err) {
      setTx({ phase: "error", message: mapContractError(err, strings.errors) });
      return undefined;
    }
  }

  return { tx, pending, submit };
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="state-panel p-6">{children}</div>;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
