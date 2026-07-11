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
import { useStrings } from "@/lib/locale";
import { ExplorerLink } from "./ExplorerLink";

const PRESETS = [10_000, 50_000, 100_000] as const;

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting-signature" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

/**
 * The one live action of the whole product: an in-place contribute panel that lives in the
 * campaign's (dark glass) ledger sidebar — an inline progressive disclosure rather than a modal.
 * It carries its own gate ladder before the money step: connect wallet → be on Testnet → hold
 * tier ≥ Basic (else route to `/verify`) → only then the preset amounts. On success it
 * optimistically patches `lifetime_direct` in both the detail and list caches (never the round
 * `matched`, which is recomputed on-chain), then invalidates so the round donor count / projected
 * match repoll.
 */
export function ContributePanel({
  campaign,
  disabled,
}: {
  campaign: ProjectState;
  disabled?: boolean;
}) {
  const strings = useStrings();
  const c = strings.campaign.contribute;
  const { address, status, connect } = useWallet();
  const tierQ = useTier(address);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(PRESETS[1]);
  const [custom, setCustom] = useState(false);
  const [customRaw, setCustomRaw] = useState("");
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const pending = tx.phase === "awaiting-signature" || tx.phase === "submitting";

  // The contract accepts any positive integer amount (`InvalidAmount` guards `amount <= 0`);
  // the input is digits-only, so the only invalid states are empty and zero.
  const customAmount = customRaw === "" ? NaN : Number(customRaw);
  const chosenAmount = custom ? customAmount : amount;
  const amountValid = Number.isInteger(chosenAmount) && chosenAmount > 0;

  if (disabled) return null;

  // Gate ladder — each rung renders its own affordance, none reaches the amount step early.
  if (status === "not-installed" || status === "disconnected" || status === "connecting") {
    return (
      <button
        type="button"
        disabled={status === "connecting"}
        onClick={() => void connect()}
        className="btn btn-lime w-full disabled:opacity-60"
      >
        {status === "connecting" ? strings.wallet.connecting : strings.wallet.connect}
      </button>
    );
  }

  if (status === "wrong-network") {
    return <p className="text-sm font-semibold text-cat-disaster">{c.wrongNetwork}</p>;
  }

  // Connected: enforce the tier gate before the amount step.
  if (tierQ.data !== undefined && tierQ.data === Tier.None) {
    return (
      <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-4 text-center">
        <p className="font-black text-paper">{c.tierGateTitle}</p>
        <p className="mt-1 text-sm text-white/60">{c.tierGateBody}</p>
        <a href="/verify" className="btn btn-lime mt-3 inline-flex">
          {c.tierGateCta}
        </a>
      </div>
    );
  }

  if (tx.phase === "success") {
    return (
      <div className="rounded-xl border border-lime/30 bg-lime/10 px-4 py-4 text-center">
        <p className="font-black text-lime">{c.successTitle}</p>
        {tx.hash ? (
          <p className="mt-2 text-sm text-lime underline-offset-2">
            <ExplorerLink hash={tx.hash} label={strings.explorer.viewTx} />
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setTx({ phase: "idle" });
            setOpen(false);
          }}
          className="mt-3 text-sm font-semibold text-white/60 underline underline-offset-2 hover:text-paper"
        >
          {c.done}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-lime w-full">
        {c.cta}
      </button>
    );
  }

  async function submit() {
    if (pending || !address || !amountValid) return;
    setTx({ phase: "awaiting-signature" });
    try {
      const assembled = await contractClient.contribute(
        { donor: address, project_id: campaign.id, amount: BigInt(chosenAmount) },
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
        setTx({ phase: "error", message: mapContractError(sent.result.unwrapErr(), strings.errors) });
        return;
      }

      // Patch lifetime_direct only; the round match/donor-count come from separate on-chain keys
      // and must repoll (invalidate), never be guessed locally.
      const delta = BigInt(chosenAmount);
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
      void queryClient.invalidateQueries({ queryKey: ["campaignContributions", campaign.id] });

      setTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
    } catch (err) {
      setTx({ phase: "error", message: mapContractError(err, strings.errors) });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-wide text-white/55">{c.amountLabel}</p>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={pending}
            onClick={() => {
              setCustom(false);
              setAmount(preset);
            }}
            className={`tabular rounded-xl border px-2 py-2.5 text-sm font-black transition-colors disabled:opacity-60 ${
              !custom && amount === preset
                ? "border-lime bg-lime text-ink"
                : "border-white/15 bg-white/10 text-paper hover:border-lime/50"
            }`}
          >
            {formatIDR(preset)}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => setCustom(true)}
        className={`w-full rounded-xl border px-2 py-2.5 text-sm font-black transition-colors disabled:opacity-60 ${
          custom
            ? "border-lime bg-lime text-ink"
            : "border-white/15 bg-white/10 text-paper hover:border-lime/50"
        }`}
      >
        {c.customChip}
      </button>

      {custom ? (
        <>
          <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 focus-within:border-lime">
            <span className="text-sm font-black text-white/60">Rp</span>
            <input
              autoFocus
              inputMode="numeric"
              value={customRaw}
              disabled={pending}
              onChange={(e) => setCustomRaw(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder={c.customPlaceholder}
              aria-label={c.customChip}
              className="tabular w-full bg-transparent text-sm font-black text-paper placeholder:text-white/40 focus:outline-none disabled:opacity-60"
            />
          </label>
          {amountValid ? (
            <p className="tabular text-xs font-bold text-white/55">= {formatIDR(chosenAmount)}</p>
          ) : customRaw !== "" ? (
            <p className="text-xs font-semibold text-cat-disaster">{c.customInvalid}</p>
          ) : null}
        </>
      ) : null}

      {tx.phase === "error" ? (
        <p className="text-sm font-semibold text-cat-disaster">{tx.message}</p>
      ) : null}

      <button
        type="button"
        disabled={pending || !amountValid}
        onClick={() => void submit()}
        className="btn btn-lime w-full disabled:opacity-60"
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
        className="w-full text-center text-sm font-semibold text-white/50 underline underline-offset-2 hover:text-paper disabled:opacity-60"
      >
        {c.cancel}
      </button>
    </div>
  );
}
