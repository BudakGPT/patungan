"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { AssembledTransaction, Result } from "@stellar/stellar-sdk/contract";
import type { ProjectState, RoundState } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useCampaigns, useRounds, useRoundProject } from "@/lib/hooks";
import { formatIDR } from "@/lib/format";
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
          className="shrink-0 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent-ink"
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
          className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:opacity-60"
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
        <div className="h-40 animate-pulse rounded-2xl bg-line/50" />
        <div className="h-40 animate-pulse rounded-2xl bg-line/50" />
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

  return (
    <div className="space-y-4">
      {mine.map((c) => (
        <CampaignLedger key={c.id} campaign={c} finalized={finalized} />
      ))}
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
    </article>
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
    return <div className="h-12 animate-pulse rounded-xl bg-line/40" />;
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
  return <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">{children}</div>;
}
