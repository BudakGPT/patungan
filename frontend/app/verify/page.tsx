"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { AssembledTransaction, Result } from "@stellar/stellar-sdk/contract";
import { Tier } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useConfig, useTier } from "@/lib/hooks";
import {
  authenticate,
  AnchorError,
  resolveKycServer,
  submitKyc,
  pollKyc,
  type KycFields,
  type KycResult,
  type KycStatus,
} from "@/lib/anchor";
import { anchorConfigured } from "@/lib/config";
import { mapContractError } from "@/lib/errors";
import { useStrings } from "@/lib/locale";
import { TierStatusBlock } from "@/components/TierBadge";
import { ExplorerLink } from "@/components/ExplorerLink";

/**
 * Verification flow `/verify` — a linear three-beat trust ladder that answers, in
 * order: *where am I* (current tier), *prove you own this wallet* (real SEP-10 anchor auth), *get a
 * tier* (SEP-12's testnet stand-in). The KYC PII never touches us; only the resulting on-chain
 * `Tier` does. On testnet the attester is the operator, so the attest step forks: an attester-holding
 * wallet self-serves the stand-in directly; everyone else is routed to the operator console fallback.
 * Each step carries its own four-state cycle so one success never blanks another.
 */
export default function VerifyPage() {
  const strings = useStrings();
  const v = strings.verify;
  const { address, status, connect } = useWallet();
  const connecting = status === "connecting";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
          {v.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{v.subtitle}</p>
      </header>

      <div className="mt-8">
        {status === "not-installed" || status === "disconnected" || status === "connecting" ? (
          <Panel>
            <p className="text-sm text-muted">{v.connectPrompt}</p>
            <button
              type="button"
              disabled={connecting}
              onClick={() => void connect()}
              className="btn btn-lime mt-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? strings.wallet.connecting : strings.wallet.connect}
            </button>
          </Panel>
        ) : status === "wrong-network" ? (
          <Panel>
            <p className="text-sm text-cat-disaster">{v.wrongNetwork}</p>
          </Panel>
        ) : address ? (
          <VerifyFlow address={address} />
        ) : null}
      </div>
    </main>
  );
}

function VerifyFlow({ address }: { address: string }) {
  const { verify: v } = useStrings();
  const tierQ = useTier(address);
  const configQ = useConfig();
  const tier = tierQ.data;
  const isAttester = configQ.data?.attester === address;
  const [jwt, setJwt] = useState<string | null>(null);
  const [kycAccepted, setKycAccepted] = useState(false);

  return (
    <div className="space-y-8">
      {/* Current status + what each rung unlocks — the "where am I" anchor. */}
      {tier === undefined ? (
        tierQ.isError ? (
          <Panel>
            <p className="text-sm text-cat-disaster">{v.tierError}</p>
          </Panel>
        ) : (
          <div className="skeleton h-28 rounded-2xl" />
        )
      ) : (
        <div className="space-y-5">
          <TierStatusBlock tier={tier} />
          <TierLadder tier={tier} />
        </div>
      )}

      {/* Step 01 — prove wallet ownership to the anchor (real SEP-10). */}
      <Sep10Step address={address} onAuthenticated={setJwt} />

      {/* Step 01b — real SEP-12 KYC fields, only rendered when the anchor publishes a KYC_SERVER. */}
      {jwt ? (
        <KycStep address={address} jwt={jwt} onAccepted={() => setKycAccepted(true)} />
      ) : null}

      {/* Step 02 — attest a tier: real KYC hand-off when accepted above, else the simulated stand-in. */}
      <AttestStep address={address} tier={tier} isAttester={isAttester} kycAccepted={kycAccepted} />
    </div>
  );
}

/* ── Tier ladder — the two rungs above None and what each unlocks ────────────────────────── */

function TierLadder({ tier }: { tier: Tier }) {
  const { verify: v } = useStrings();
  const rungs: Array<{ tier: string; unlock: string; reached: boolean }> = [
    { ...v.ladder[0], reached: tier >= Tier.Basic },
    { ...v.ladder[1], reached: tier >= Tier.Institution },
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-faint">{v.ladderHeading}</p>
      <ol className="mt-3 space-y-2">
        {rungs.map((r) => (
          <li
            key={r.tier}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
              r.reached ? "border-match/25 bg-match-soft" : "border-line bg-surface"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                r.reached ? "bg-match text-on-accent" : "border border-line-strong text-faint"
              }`}
            >
              {r.reached ? "✓" : ""}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${r.reached ? "text-match-ink" : "text-ink"}`}>
                {r.tier}
              </p>
              <p className="text-sm text-muted">{r.unlock}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Step 01 — SEP-10 ownership ──────────────────────────────────────────────────────────── */

type Sep10State =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "success" }
  | { phase: "error"; message: string };

function Sep10Step({
  address,
  onAuthenticated,
}: {
  address: string;
  onAuthenticated: (jwt: string) => void;
}) {
  const { verify: v } = useStrings();
  const [state, setState] = useState<Sep10State>({ phase: "idle" });
  const running = state.phase === "running";

  async function run() {
    if (running) return;
    setState({ phase: "running" });
    try {
      const jwt = await authenticate(address);
      onAuthenticated(jwt);
      setState({ phase: "success" });
    } catch (err) {
      const code = err instanceof AnchorError ? err.code : "generic";
      setState({ phase: "error", message: v.sep10.errors[code] ?? v.sep10.errors.generic });
    }
  }

  return (
    <ActionPanel overline={v.sep10.overline} heading={v.sep10.heading} description={v.sep10.description}>
      {!anchorConfigured ? (
        <Note tone="muted" title={v.sep10.notConfiguredTitle}>
          {v.sep10.notConfiguredBody}
        </Note>
      ) : state.phase === "success" ? (
        <Note tone="success" title={v.sep10.successTitle}>
          {v.sep10.successBody}
        </Note>
      ) : (
        <div className="space-y-4">
          {state.phase === "error" ? (
            <p className="text-sm text-cat-disaster">{state.message}</p>
          ) : null}
          <button
            type="button"
            disabled={running}
            onClick={() => void run()}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? v.sep10.pending : v.sep10.cta}
          </button>
        </div>
      )}
    </ActionPanel>
  );
}

/* ── Step 01b — SEP-12 KYC fields (real, when the anchor publishes a KYC_SERVER) ─────────── */

type KycState =
  | { phase: "checking" }
  | { phase: "unavailable" }
  | { phase: "form" }
  | { phase: "submitting" }
  | { phase: "polling"; id: string; status: KycStatus }
  | { phase: "accepted" }
  | { phase: "rejected" }
  | { phase: "error"; message: string };

function KycStep({
  address,
  jwt,
  onAccepted,
}: {
  address: string;
  jwt: string;
  onAccepted: () => void;
}) {
  const { verify: v } = useStrings();
  const [state, setState] = useState<KycState>({ phase: "checking" });
  const [kycServer, setKycServer] = useState<string | null>(null);
  const [fields, setFields] = useState<KycFields>({
    first_name: "",
    last_name: "",
    email_address: "",
  });

  useEffect(() => {
    let cancelled = false;
    void resolveKycServer().then((server) => {
      if (cancelled) return;
      setKycServer(server);
      setState(server ? { phase: "form" } : { phase: "unavailable" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleResult(result: KycResult) {
    if (result.status === "ACCEPTED") {
      setState({ phase: "accepted" });
      onAccepted();
    } else if (result.status === "REJECTED") {
      setState({ phase: "rejected" });
    } else {
      setState({ phase: "polling", id: result.id, status: result.status });
    }
  }

  async function submit() {
    setState({ phase: "submitting" });
    try {
      const result = await submitKyc(address, jwt, fields);
      handleResult(result);
    } catch (err) {
      const code = err instanceof AnchorError ? err.code : "generic";
      if (code === "kyc-not-configured") {
        setState({ phase: "unavailable" });
        return;
      }
      setState({ phase: "error", message: v.kyc.errors[code] ?? v.kyc.errors.generic });
    }
  }

  useEffect(() => {
    if (state.phase !== "polling" || !kycServer) return;
    const timer = setTimeout(() => {
      void pollKyc(kycServer, jwt, state.id)
        .then(handleResult)
        .catch(() => {
          /* transient poll failure — retry on the next tick */
        });
    }, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, kycServer, jwt]);

  if (state.phase === "checking" || state.phase === "unavailable") return null;

  return (
    <ActionPanel overline={v.kyc.overline} heading={v.kyc.heading} description={v.kyc.description}>
      {state.phase === "accepted" ? (
        <Note tone="success" title={v.kyc.status.ACCEPTED}>
          {v.kyc.status.ACCEPTED}
        </Note>
      ) : state.phase === "rejected" ? (
        <p className="text-sm text-cat-disaster">{v.kyc.status.REJECTED}</p>
      ) : state.phase === "polling" ? (
        <p className="text-sm text-muted">{v.kyc.status[state.status] ?? v.kyc.polling}</p>
      ) : (
        <div className="space-y-3">
          {state.phase === "error" ? (
            <p className="text-sm text-cat-disaster">{state.message}</p>
          ) : null}
          <input
            value={fields.first_name}
            onChange={(e) => setFields({ ...fields, first_name: e.target.value })}
            placeholder={v.kyc.firstName}
            className="field-control"
          />
          <input
            value={fields.last_name}
            onChange={(e) => setFields({ ...fields, last_name: e.target.value })}
            placeholder={v.kyc.lastName}
            className="field-control"
          />
          <input
            type="email"
            value={fields.email_address}
            onChange={(e) => setFields({ ...fields, email_address: e.target.value })}
            placeholder={v.kyc.email}
            className="field-control"
          />
          <button
            type="button"
            disabled={state.phase === "submitting"}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.phase === "submitting" ? v.kyc.submitting : v.kyc.cta}
          </button>
        </div>
      )}
    </ActionPanel>
  );
}

/* ── Step 02 — attest tier (real KYC hand-off, or the simulated testnet stand-in) ─────────── */

function AttestStep({
  address,
  tier,
  isAttester,
  kycAccepted,
}: {
  address: string;
  tier: Tier | undefined;
  isAttester: boolean;
  kycAccepted: boolean;
}) {
  const { verify: v } = useStrings();
  return (
    <ActionPanel
      overline={v.attest.overline}
      heading={v.attest.heading}
      description={v.attest.description}
      badge={kycAccepted ? v.attest.realBadge : v.attest.simBadge}
    >
      {tier !== undefined && tier !== Tier.None ? (
        <Note tone="success" title={v.attest.alreadyTitle}>
          {v.attest.alreadyBody}
          <div className="mt-3">
            <Link
              href="/"
              className="inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
            >
              {v.attest.exploreCta}
            </Link>
          </div>
        </Note>
      ) : isAttester ? (
        <SelfAttest address={address} />
      ) : (
        <OperatorFallback />
      )}
    </ActionPanel>
  );
}

/** Attester-holding wallet: attest its own tier directly as the testnet anchor stand-in. */
function SelfAttest({ address }: { address: string }) {
  const strings = useStrings();
  const v = strings.verify;
  const queryClient = useQueryClient();
  const action = useAction();
  const [tier, setTier] = useState<Tier>(Tier.Basic);

  async function submit() {
    if (action.pending) return;
    const ok = await action.submit(() =>
      contractClient.set_verification({ who: address, tier }, { publicKey: address }),
    );
    if (ok !== undefined) void queryClient.invalidateQueries({ queryKey: ["tier", address] });
  }

  if (action.tx.phase === "success") {
    return (
      <Note tone="success" title={v.attest.successTitle}>
        {action.tx.hash ? <ExplorerLink hash={action.tx.hash} label={v.viewOnExplorer} /> : null}
      </Note>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent-ink">
        {v.attest.attesterHint}
      </p>

      <div>
        <p className="text-sm font-semibold text-ink">{v.attest.tierLabel}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([Tier.Basic, Tier.Institution] as const).map((t) => {
            const active = tier === t;
            return (
              <button
                key={t}
                type="button"
                disabled={action.pending}
                aria-pressed={active}
                onClick={() => setTier(t)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  active
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-surface text-muted hover:border-accent/40"
                }`}
              >
                {v.attest.tiers[Tier[t]]}
              </button>
            );
          })}
        </div>
      </div>

      {action.tx.phase === "error" ? (
        <p className="text-sm text-cat-disaster">{action.tx.message}</p>
      ) : null}

      <button
        type="button"
        disabled={action.pending}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {action.tx.phase === "awaiting"
          ? strings.wallet.connecting
          : action.tx.phase === "submitting"
            ? v.submitting
            : v.attest.cta}
      </button>
    </div>
  );
}

/** Non-attester wallet: the honest testnet model — an operator completes the attestation. */
function OperatorFallback() {
  const { verify: v } = useStrings();
  return (
    <Note tone="muted" title={v.attest.fallbackTitle}>
      {v.attest.fallbackBody}
      <div className="mt-3">
        <Link
          href="/operator"
          className="inline-flex rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent/40"
        >
          {v.attest.fallbackCta}
        </Link>
      </div>
    </Note>
  );
}

/* ── Shared write cycle + primitives (mirrors the operator console) ──────────────────────── */

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

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
        watcher: { onSubmitted: () => setTx({ phase: "submitting" }), onProgress: () => {} },
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

function ActionPanel({
  overline,
  heading,
  description,
  badge,
  children,
}: {
  overline: string;
  heading: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">{overline}</p>
        {badge ? (
          <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-faint">
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-1.5 text-lg font-semibold text-ink">{heading}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Note({
  tone,
  title,
  children,
}: {
  tone: "success" | "muted";
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-match/30 bg-match-soft text-match-ink"
      : "border-line bg-paper text-muted";
  return (
    <div className={`rounded-xl border px-4 py-4 ${cls}`}>
      <p className={`font-medium ${tone === "success" ? "text-match-ink" : "text-ink"}`}>{title}</p>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="state-panel p-6">{children}</div>;
}
