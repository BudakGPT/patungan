"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { ProjectState } from "@/contract/src";
import { Tier } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useTier } from "@/lib/hooks";
import { formatIDR } from "@/lib/format";
import { mapContractError } from "@/lib/errors";
import { strings } from "@/strings";
import { ExplorerLink } from "./ExplorerLink";

const c = strings.campaign.contribute;
const PRESETS = [10_000, 50_000, 100_000] as const;

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting-signature" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

/**
 * The one live action of the whole product: an in-place contribute panel that lives in the
 * campaign's ledger sidebar — an inline progressive disclosure
 * rather than a modal. It carries its own gate ladder before the money step: connect wallet →
 * be on Testnet → hold tier ≥ Basic (else route to `/verify`) → only then the preset amounts.
 * On success it optimistically patches `lifetime_direct` in both the detail and list caches (never
 * the round `matched`, which is recomputed on-chain), then invalidates so the round donor count /
 * projected match repoll.
 */
export function ContributePanel({
  campaign,
  disabled,
}: {
  campaign: ProjectState;
  disabled?: boolean;
}) {
  const { address, status, connect } = useWallet();
  const tierQ = useTier(address);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(PRESETS[1]);
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const pending = tx.phase === "awaiting-signature" || tx.phase === "submitting";

  if (disabled) return null;

  // Gate ladder — each rung renders its own affordance, none reaches the amount step early.
  if (status === "not-installed" || status === "disconnected" || status === "connecting") {
    return (
      <button
        type="button"
        disabled={status === "connecting"}
        onClick={() => void connect()}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:opacity-60"
      >
        {status === "connecting" ? strings.wallet.connecting : strings.wallet.connect}
      </button>
    );
  }

  if (status === "wrong-network") {
    return <p className="text-sm text-cat-disaster">{c.wrongNetwork}</p>;
  }

  // Connected: enforce the tier gate before the amount step.
  if (tierQ.data !== undefined && tierQ.data === Tier.None) {
    return (
      <div className="rounded-xl border border-line bg-paper px-4 py-4 text-center">
        <p className="font-medium text-ink">{c.tierGateTitle}</p>
        <p className="mt-1 text-sm text-muted">{c.tierGateBody}</p>
        <a
          href="/verify"
          className="mt-3 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
        >
          {c.tierGateCta}
        </a>
      </div>
    );
  }

  if (tx.phase === "success") {
    return (
      <div className="rounded-xl border border-match/30 bg-match-soft px-4 py-4 text-center">
        <p className="font-medium text-match-ink">{c.successTitle}</p>
        {tx.hash ? (
          <p className="mt-2 text-sm text-match-ink underline-offset-2">
            <ExplorerLink hash={tx.hash} label={strings.explorer.viewTx} />
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setTx({ phase: "idle" });
            setOpen(false);
          }}
          className="mt-3 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
        >
          {c.done}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
      >
        {c.cta}
      </button>
    );
  }

  async function submit() {
    if (pending || !address) return;
    setTx({ phase: "awaiting-signature" });
    try {
      const assembled = await contractClient.contribute(
        { donor: address, project_id: campaign.id, amount: BigInt(amount) },
        { publicKey: address },
      );
      const sent = await assembled.signAndSend({
        signTransaction: freighterApi.signTransaction,
        watcher: {
          onSubmitted: () => setTx({ phase: "submitting" }),
          onProgress: () => {},
        },
      });

      if (sent.result.isErr()) {
        setTx({ phase: "error", message: mapContractError(sent.result.unwrapErr()) });
        return;
      }

      // Patch lifetime_direct only; the round match/donor-count come from separate on-chain keys
      // and must repoll (invalidate), never be guessed locally.
      const delta = BigInt(amount);
      const patch = (p: ProjectState): ProjectState =>
        p.id === campaign.id ? { ...p, lifetime_direct: p.lifetime_direct + delta } : p;
      queryClient.setQueryData<ProjectState>(["campaign", campaign.id], (old) =>
        old ? patch(old) : old,
      );
      queryClient.setQueryData<ProjectState[]>(["campaigns"], (old) => old?.map(patch));
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["previewRound"] });
      void queryClient.invalidateQueries({ queryKey: ["roundProject"] });

      setTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
    } catch (err) {
      setTx({ phase: "error", message: mapContractError(err) });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-faint">{c.amountLabel}</p>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={pending}
            onClick={() => setAmount(preset)}
            className={`rounded-xl border px-2 py-2.5 text-sm font-semibold tabular transition-colors disabled:opacity-60 ${
              amount === preset
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-muted hover:border-accent/40"
            }`}
          >
            {formatIDR(preset)}
          </button>
        ))}
      </div>

      {tx.phase === "error" ? (
        <p className="text-sm text-cat-disaster">{tx.message}</p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:opacity-60"
      >
        {tx.phase === "awaiting-signature"
          ? c.awaiting
          : tx.phase === "submitting"
            ? c.submitting
            : c.confirm}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(false)}
        className="w-full text-center text-sm text-muted underline underline-offset-2 hover:text-ink disabled:opacity-60"
      >
        {c.cancel}
      </button>
    </div>
  );
}
