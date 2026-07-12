"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { AssembledTransaction, Result } from "@stellar/stellar-sdk/contract";
import type { Category, ProjectState } from "@/contract/src";
import { Tier } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useConfig, useOpenRound, useCampaigns, useTier } from "@/lib/hooks";
import { formatIDR, truncateAddress, formatCountdown } from "@/lib/format";
import { ALL_CATEGORIES, categoryMeta, type CategoryTag } from "@/lib/category";
import { mapContractError } from "@/lib/errors";
import { useStrings } from "@/lib/locale";
import { ExplorerLink } from "@/components/ExplorerLink";

const STELLAR_ADDR = /^G[A-Z2-7]{55}$/;

/**
 * Operator/sponsor console `/operator` — the platform's deepest, most privileged
 * surface. The one design decision that keeps a live season safe: the five write actions are
 * ordered by blast radius and their availability is driven by real round state, so the console
 * itself refuses impossible moves (no funding without an open round, no finalize when none is
 * open). A status strip pins the live-season state everything is read against; the season lifecycle
 * (open → fund → finalize) sits left, always-on governance (curation, verify) sits right. Each
 * action carries its own four-state tx cycle so one success never blanks another.
 */
export default function OperatorPage() {
  const strings = useStrings();
  const o = strings.operator;
  const { address, status, connect } = useWallet();
  const configQ = useConfig();

  const roles = useMemo(() => {
    const c = configQ.data;
    if (!c || !address) return null;
    return {
      admin: c.admin === address,
      curator: c.curator === address,
      attester: c.attester === address,
      any: c.admin === address || c.curator === address || c.attester === address,
    };
  }, [configQ.data, address]);

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
          {o.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{o.subtitle}</p>
      </header>

      <div className="mt-8">
        <Gate
          status={status}
          roles={roles}
          configLoading={configQ.data === undefined && !configQ.isError}
          connecting={status === "connecting"}
          onConnect={connect}
        >
          {address && roles ? <Console address={address} roles={roles} /> : null}
        </Gate>
      </div>
    </main>
  );
}

/** Gate ladder — connect → Testnet → hold at least one operator role. Console mounts past the top. */
function Gate({
  status,
  roles,
  configLoading,
  connecting,
  onConnect,
  children,
}: {
  status: ReturnType<typeof useWallet>["status"];
  roles: { any: boolean } | null;
  configLoading: boolean;
  connecting: boolean;
  onConnect: () => Promise<void>;
  children: React.ReactNode;
}) {
  const strings = useStrings();
  const o = strings.operator;
  if (status === "not-installed" || status === "disconnected" || status === "connecting") {
    return (
      <Panel>
        <p className="text-sm text-muted">{o.connectPrompt}</p>
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
        <p className="text-sm text-cat-disaster">{o.wrongNetwork}</p>
      </Panel>
    );
  }
  if (configLoading || roles === null) {
    return (
      <Panel>
        <p className="text-sm text-muted">{strings.loading}</p>
      </Panel>
    );
  }
  if (!roles.any) {
    return (
      <Panel>
        <p className="text-sm text-cat-disaster">{o.notRole}</p>
      </Panel>
    );
  }
  return <>{children}</>;
}

function Console({
  address,
  roles,
}: {
  address: string;
  roles: { admin: boolean; curator: boolean; attester: boolean };
}) {
  const { operator: o } = useStrings();
  const openRound = useOpenRound();
  const round = openRound.data ?? null;

  return (
    <div className="space-y-8">
      <StatusStrip address={address} roles={roles} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Season lifecycle — sequenced, state-gated (left, primary) */}
        <section className="space-y-5 lg:col-span-3">
          <RegionLabel>{o.lifecycleHeading}</RegionLabel>
          <OpenRoundSection round={round} sponsor={address} />
          <FundPoolSection round={round} funder={address} />
          <FinalizeSection round={round} admin={address} />
        </section>

        {/* Governance — always available (right, secondary) */}
        <section className="space-y-5 lg:col-span-2">
          <RegionLabel>{o.governanceHeading}</RegionLabel>
          <CurationSection curator={address} />
          <VerifySection attester={address} />
        </section>
      </div>
    </div>
  );
}

/* ── Status strip — the anchor every action is read against ─────────────────────────────── */

function StatusStrip({
  address,
  roles,
}: {
  address: string;
  roles: { admin: boolean; curator: boolean; attester: boolean };
}) {
  const strings = useStrings();
  const o = strings.operator;
  const openRound = useOpenRound();
  const round = openRound.data ?? null;
  const roleList = [
    roles.admin && o.status.roleAdmin,
    roles.curator && o.status.roleCurator,
    roles.attester && o.status.roleAttester,
  ].filter(Boolean) as string[];
  const countdown = round ? formatCountdown(round.round_end, strings.discovery.countdown) : null;

  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-5 shadow-card sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-faint">{o.status.connectedAs}</p>
          <p className="tabular mt-1 text-sm font-medium text-ink">{truncateAddress(address)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roleList.map((r) => (
              <span
                key={r}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        <div className="sm:text-right">
          <p className="text-xs uppercase tracking-wide text-faint">{o.status.liveRound}</p>
          {round ? (
            <>
              <p className="tabular mt-1 text-sm font-semibold text-ink">
                #{round.id} · {formatIDR(round.pool)}
              </p>
              <p className="tabular mt-0.5 text-xs text-muted">
                {countdown
                  ? `${o.status.endsLabel} ${countdown}`
                  : o.status.ended}
                {" · "}
                {round.categories.length === 0
                  ? o.status.scopeAll
                  : round.categories.map((c) => categoryMeta(c.tag, strings.categories).label).join(", ")}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-medium text-muted">{o.status.noRound}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 1 · Open round ─────────────────────────────────────────────────────────────────────── */

function OpenRoundSection({
  round,
  sponsor,
}: {
  round: import("@/contract/src").RoundState | null;
  sponsor: string;
}) {
  const strings = useStrings();
  const o = strings.operator;
  const queryClient = useQueryClient();
  const action = useAction();
  const [endLocal, setEndLocal] = useState("");
  const [cats, setCats] = useState<Set<CategoryTag>>(new Set());
  const [touched, setTouched] = useState(false);

  const endSec = endLocal ? Math.floor(new Date(endLocal).getTime() / 1000) : 0;
  const dateValid = endSec > Math.floor(Date.now() / 1000);
  const alreadyOpen = round !== null;

  function toggle(tag: CategoryTag) {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function submit() {
    setTouched(true);
    if (alreadyOpen || !dateValid || action.pending) return;
    const categories: Array<Category> = ALL_CATEGORIES.filter((t) => cats.has(t)).map(
      (t) => ({ tag: t, values: undefined }) as Category,
    );
    const ok = await action.submit(
      () =>
        contractClient.open_round(
          { sponsor, round_end: BigInt(endSec), categories },
          { publicKey: sponsor },
        ),
      o.errors,
    );
    if (ok !== undefined) {
      setEndLocal("");
      setCats(new Set());
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ["openRound"] });
      void queryClient.invalidateQueries({ queryKey: ["rounds"] });
    }
  }

  return (
    <ActionPanel overline={o.step.open} heading={o.open.heading} description={o.open.description}>
      {alreadyOpen ? (
        <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
          {o.open.alreadyOpen(round!.id)}
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="round-end">{o.open.endLabel}</Label>
            <input
              id="round-end"
              type="datetime-local"
              value={endLocal}
              disabled={action.pending}
              onChange={(e) => setEndLocal(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-faint">{o.open.endHelper}</p>
            {touched && !dateValid ? (
              <p className="mt-1 text-sm text-cat-disaster">{o.open.invalidDate}</p>
            ) : null}
          </div>

          <div>
            <Label>{o.open.categoriesLabel}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((tag) => {
                const active = cats.has(tag);
                const { label, chip } = categoryMeta(tag, strings.categories);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={action.pending}
                    aria-pressed={active}
                    onClick={() => toggle(tag)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      active
                        ? `border-transparent ${chip}`
                        : "border-line bg-surface text-muted hover:border-accent/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-faint">{o.open.categoriesHint}</p>
          </div>

          <TxFeedback tx={action.tx} successTitle={o.open.successTitle} onReset={action.reset} />

          <PrimaryButton
            onClick={() => void submit()}
            pending={action.pending}
            disabled={touched && !dateValid}
            tx={action.tx}
            label={o.open.cta}
          />
        </div>
      )}
    </ActionPanel>
  );
}

/* ── 2 · Fund pool ──────────────────────────────────────────────────────────────────────── */

function FundPoolSection({
  round,
  funder,
}: {
  round: import("@/contract/src").RoundState | null;
  funder: string;
}) {
  const { operator: o } = useStrings();
  const queryClient = useQueryClient();
  const action = useAction();
  const tierQ = useTier(funder);
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);

  const amt = Number(amount);
  const amountValid = Number.isInteger(amt) && amt > 0;

  async function submit() {
    setTouched(true);
    if (!round || !amountValid || action.pending) return;
    const ok = await action.submit(
      () =>
        contractClient.fund_pool(
          { from: funder, round_id: round.id, amount: BigInt(amt) },
          { publicKey: funder },
        ),
      o.errors,
    );
    if (ok !== undefined) {
      setAmount("");
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ["openRound"] });
      void queryClient.invalidateQueries({ queryKey: ["rounds"] });
    }
  }

  return (
    <ActionPanel overline={o.step.fund} heading={o.fund.heading} description={o.fund.description}>
      {!round ? (
        <Disabled>{o.fund.needsRound}</Disabled>
      ) : tierQ.data !== undefined && tierQ.data < Tier.Institution ? (
        <div className="rounded-xl border border-line bg-paper px-4 py-4">
          <p className="font-medium text-ink">{o.fund.tierGateTitle}</p>
          <p className="mt-1 text-sm text-muted">{o.fund.tierGateBody}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="fund-amount">{o.fund.amountLabel}</Label>
            <input
              id="fund-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              disabled={action.pending}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none tabular"
            />
            {amountValid ? (
              <p className="tabular mt-1.5 text-sm text-muted">
                {o.fund.echoLabel} <span className="font-semibold text-ink">{formatIDR(amt)}</span>
              </p>
            ) : touched ? (
              <p className="mt-1 text-sm text-cat-disaster">{o.fund.invalidAmount}</p>
            ) : null}
          </div>

          <TxFeedback tx={action.tx} successTitle={o.fund.successTitle} onReset={action.reset} />

          <PrimaryButton
            onClick={() => void submit()}
            pending={action.pending}
            disabled={touched && !amountValid}
            tx={action.tx}
            label={o.fund.cta}
          />
        </div>
      )}
    </ActionPanel>
  );
}

/* ── 3 · Finalize ───────────────────────────────────────────────────────────────────────── */

function FinalizeSection({
  round,
  admin,
}: {
  round: import("@/contract/src").RoundState | null;
  admin: string;
}) {
  const { operator: o } = useStrings();
  const queryClient = useQueryClient();
  const action = useAction();
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    if (!round || action.pending) return;
    const ok = await action.submit(
      () => contractClient.finalize_round({ round_id: round.id }, { publicKey: admin }),
      o.errors,
    );
    if (ok !== undefined) {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["openRound"] });
      void queryClient.invalidateQueries({ queryKey: ["rounds"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    }
  }

  return (
    <ActionPanel
      overline={o.step.finalize}
      heading={o.finalize.heading}
      description={o.finalize.description}
    >
      {!round ? (
        <Disabled>{o.finalize.needsRound}</Disabled>
      ) : action.tx.phase === "success" ? (
        <div className="rounded-xl border border-match/30 bg-match-soft px-4 py-4">
          <p className="font-medium text-match-ink">{o.finalize.successTitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Link
              href={`/results?round=${round.id}`}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
            >
              {o.finalize.viewResults}
            </Link>
            {action.tx.hash ? (
              <span className="text-sm text-match-ink">
                <ExplorerLink hash={action.tx.hash} label={o.viewOnExplorer} />
              </span>
            ) : null}
          </div>
        </div>
      ) : !confirming ? (
        <button
          type="button"
          disabled={action.pending}
          onClick={() => setConfirming(true)}
          className="w-full rounded-xl border border-cat-disaster/50 bg-cat-disaster-soft px-4 py-3 text-sm font-semibold text-cat-disaster transition-colors hover:border-cat-disaster disabled:opacity-60"
        >
          {o.finalize.cta}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-cat-disaster/40 bg-cat-disaster-soft px-4 py-4">
          <p className="text-sm font-medium text-cat-disaster">{o.finalize.confirmMessage}</p>
          {action.tx.phase === "error" ? (
            <p className="text-sm text-cat-disaster">{action.tx.message}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={action.pending}
              onClick={() => void submit()}
              className="rounded-xl bg-cat-disaster px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {action.pending
                ? action.tx.phase === "submitting"
                  ? o.submitting
                  : o.awaiting
                : o.finalize.confirmCta}
            </button>
            <button
              type="button"
              disabled={action.pending}
              onClick={() => {
                setConfirming(false);
                action.reset();
              }}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-60"
            >
              {o.finalize.cancelCta}
            </button>
          </div>
        </div>
      )}
    </ActionPanel>
  );
}

/* ── 4 · Curation queue ─────────────────────────────────────────────────────────────────── */

function CurationSection({ curator }: { curator: string }) {
  const strings = useStrings();
  const o = strings.operator;
  const campaigns = useCampaigns();
  const pending = useMemo(
    () => (campaigns.data ?? []).filter((c) => c.status.tag === "Pending"),
    [campaigns.data],
  );

  return (
    <ActionPanel heading={o.curation.heading} description={o.curation.description}>
      {campaigns.data === undefined ? (
        campaigns.isError ? (
          <p className="text-sm text-cat-disaster">{strings.errorGeneric}</p>
        ) : (
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-xl bg-line/50" />
            <div className="h-14 animate-pulse rounded-xl bg-line/50" />
          </div>
        )
      ) : pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-paper px-4 py-8 text-center text-sm text-muted">
          {o.curation.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((c) => (
            <CurationRow key={c.id} campaign={c} curator={curator} />
          ))}
        </ul>
      )}
    </ActionPanel>
  );
}

function CurationRow({ campaign, curator }: { campaign: ProjectState; curator: string }) {
  const strings = useStrings();
  const o = strings.operator;
  const queryClient = useQueryClient();
  const action = useAction();
  const { label, chip } = categoryMeta(campaign.category.tag, strings.categories);

  async function decide(kind: "approve" | "reject") {
    if (action.pending) return;
    const ok = await action.submit(
      () =>
        kind === "approve"
          ? contractClient.approve_project({ id: campaign.id }, { publicKey: curator })
          : contractClient.reject_project({ id: campaign.id }, { publicKey: curator }),
      o.errors,
    );
    if (ok !== undefined) {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
    }
  }

  return (
    <li className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{campaign.title}</p>
          <p className="tabular mt-0.5 text-xs text-faint">
            {o.curation.byOwner} {truncateAddress(campaign.owner)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${chip}`}>
          {label}
        </span>
      </div>

      {action.tx.phase === "success" ? (
        <p className="mt-2 text-xs text-match-ink">
          <ExplorerLink hash={action.tx.hash} label={o.viewOnExplorer} />
        </p>
      ) : (
        <>
          {action.tx.phase === "error" ? (
            <p className="mt-2 text-xs text-cat-disaster">{action.tx.message}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={action.pending}
              onClick={() => void decide("approve")}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:opacity-60"
            >
              {action.pending ? o.curation.approving : o.curation.approve}
            </button>
            <button
              type="button"
              disabled={action.pending}
              onClick={() => void decide("reject")}
              className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-cat-disaster hover:text-cat-disaster disabled:opacity-60"
            >
              {action.pending ? o.curation.rejecting : o.curation.reject}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/* ── 5 · Verify fallback ────────────────────────────────────────────────────────────────── */

function VerifySection({ attester }: { attester: string }) {
  const { operator: o } = useStrings();
  const queryClient = useQueryClient();
  const action = useAction();
  const [addr, setAddr] = useState("");
  const [tier, setTier] = useState<Tier>(Tier.Basic);
  const [touched, setTouched] = useState(false);

  const addrValid = STELLAR_ADDR.test(addr.trim());

  async function submit() {
    setTouched(true);
    if (!addrValid || action.pending) return;
    const who = addr.trim();
    const ok = await action.submit(
      () => contractClient.set_verification({ who, tier }, { publicKey: attester }),
      o.errors,
    );
    if (ok !== undefined) {
      setAddr("");
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ["tier", who] });
    }
  }

  return (
    <ActionPanel heading={o.verify.heading} description={o.verify.description}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="verify-addr">{o.verify.addressLabel}</Label>
          <input
            id="verify-addr"
            type="text"
            spellCheck={false}
            value={addr}
            disabled={action.pending}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="G…"
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none tabular"
          />
          {touched && !addrValid ? (
            <p className="mt-1 text-sm text-cat-disaster">{o.verify.invalidAddress}</p>
          ) : null}
        </div>

        <div>
          <Label>{o.verify.tierLabel}</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([Tier.None, Tier.Basic, Tier.Institution] as const).map((t) => {
              const active = tier === t;
              const name = Tier[t];
              return (
                <button
                  key={t}
                  type="button"
                  disabled={action.pending}
                  aria-pressed={active}
                  onClick={() => setTier(t)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-surface text-muted hover:border-accent/40"
                  }`}
                >
                  {o.verify.tiers[name] ?? name}
                </button>
              );
            })}
          </div>
        </div>

        <TxFeedback tx={action.tx} successTitle={o.verify.successTitle} onReset={action.reset} />

        <PrimaryButton
          onClick={() => void submit()}
          pending={action.pending}
          disabled={touched && !addrValid}
          tx={action.tx}
          label={o.verify.cta}
        />
      </div>
    </ActionPanel>
  );
}

/* ── Shared write cycle + primitives ────────────────────────────────────────────────────── */

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

/**
 * One reusable write cycle shared by all five actions: assemble+simulate → sign → send, mapping
 * every failure (simulation throw or on-chain `isErr`) to Bahasa via the operator error overrides.
 * Returns the unwrapped result on success (used by open_round's new id) or `undefined` on failure.
 */
function useAction() {
  const strings = useStrings();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const pending = tx.phase === "awaiting" || tx.phase === "submitting";

  async function submit<T>(
    build: () => Promise<AssembledTransaction<Result<T>>>,
    messages: Record<string, string>,
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
        setTx({
          phase: "error",
          message: mapContractError(sent.result.unwrapErr(), strings.errors, messages),
        });
        return undefined;
      }
      setTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
      return sent.result.unwrap();
    } catch (err) {
      setTx({ phase: "error", message: mapContractError(err, strings.errors, messages) });
      return undefined;
    }
  }

  return { tx, pending, submit, reset: () => setTx({ phase: "idle" }) };
}

/** Success/error line shared by the form-shaped actions (open, fund, verify). */
function TxFeedback({
  tx,
  successTitle,
  onReset,
}: {
  tx: TxState;
  successTitle: string;
  onReset: () => void;
}) {
  const strings = useStrings();
  const o = strings.operator;
  if (tx.phase === "success") {
    return (
      <div className="rounded-xl border border-match/30 bg-match-soft px-4 py-3">
        <p className="text-sm font-medium text-match-ink">{successTitle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {tx.hash ? (
            <span className="text-sm text-match-ink">
              <ExplorerLink hash={tx.hash} label={o.viewOnExplorer} />
            </span>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            {strings.campaign.contribute.done}
          </button>
        </div>
      </div>
    );
  }
  if (tx.phase === "error") {
    return <p className="text-sm text-cat-disaster">{tx.message}</p>;
  }
  return null;
}

/** Primary submit button that reflects the tx phase; hidden once the action has succeeded. */
function PrimaryButton({
  onClick,
  pending,
  disabled,
  tx,
  label,
}: {
  onClick: () => void;
  pending: boolean;
  disabled?: boolean;
  tx: TxState;
  label: string;
}) {
  const { operator: o } = useStrings();
  if (tx.phase === "success") return null;
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={onClick}
      className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {tx.phase === "awaiting" ? o.awaiting : tx.phase === "submitting" ? o.submitting : label}
    </button>
  );
}

function ActionPanel({
  overline,
  heading,
  description,
  children,
}: {
  overline?: string;
  heading: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      {overline ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">{overline}</p>
      ) : null}
      <h3 className={`text-lg font-semibold text-ink ${overline ? "mt-1.5" : ""}`}>{heading}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">{children}</div>;
}

function RegionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-faint">{children}</h2>
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
      {children}
    </label>
  );
}

function Disabled({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line-strong bg-paper px-4 py-3 text-sm text-muted">
      {children}
    </p>
  );
}
