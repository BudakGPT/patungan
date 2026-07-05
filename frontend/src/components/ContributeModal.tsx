"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { ProjectState } from "@/contract/dist/index.js";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { formatIDR } from "@/lib/format";
import { config } from "@/lib/config";
import { strings } from "@/strings";
import { hasContributed, markContributed } from "@/lib/contributionTracker";

const PRESETS = [10_000, 50_000, 100_000] as const;

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting-signature" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

/** Maps a thrown error or an unwrapped contract `Error` variant to Bahasa copy (§7 B2 edge cases). */
function mapError(err: unknown): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  if (/reject|declin|cancel/i.test(raw)) return strings.contribute.errors.rejected;
  return strings.contribute.errors[raw] ?? raw;
}

/** B2/B3 · preset chip-in + full tx UX (§6.4) + required optimistic cache patch (§6.2). */
export function ContributeModal({
  projectId,
  projectTitle,
  onClose,
}: {
  projectId: number;
  projectTitle: string;
  onClose: () => void;
}) {
  const { address, canWrite } = useWallet();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(PRESETS[0]);
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const pending = tx.phase === "awaiting-signature" || tx.phase === "submitting";

  async function submit() {
    if (pending || !address) return;
    setTx({ phase: "awaiting-signature" });
    try {
      const assembled = await contractClient.contribute(
        { donor: address, project_id: projectId, amount: BigInt(amount) },
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
        setTx({ phase: "error", message: mapError(sent.result.unwrapErr()) });
        return;
      }

      // §6.2: direct patched immediately; donor_count only if session knows this is first-time;
      // matched is never recomputed locally — it stays whatever the last poll/preview set.
      const wasFirstTime = !hasContributed(projectId, address);
      markContributed(projectId, address);
      const patch = (p: ProjectState): ProjectState =>
        p.id === projectId
          ? {
              ...p,
              direct: p.direct + BigInt(amount),
              donor_count: wasFirstTime ? p.donor_count + 1 : p.donor_count,
            }
          : p;
      queryClient.setQueryData<ProjectState[]>(["projects"], (old) => old?.map(patch));
      queryClient.setQueryData<ProjectState>(["project", projectId], (old) =>
        old ? patch(old) : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["previewMatches"] });

      setTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
    } catch (err) {
      setTx({ phase: "error", message: mapError(err) });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">
          {strings.contribute.title} {projectTitle}
        </h2>

        {!canWrite ? (
          <p className="mt-4 text-sm text-neutral-600">{strings.contribute.connectFirst}</p>
        ) : tx.phase === "success" ? (
          <div className="mt-4 space-y-3">
            <p className="text-emerald-700">{strings.contribute.successTitle}</p>
            {tx.hash ? (
              <a
                href={`${config.explorerBase}/tx/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="block text-sm underline underline-offset-2"
              >
                {strings.contribute.viewOnExplorer}
              </a>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase text-neutral-500">
                {strings.contribute.amountLabel}
              </p>
              <div className="mt-2 flex gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={pending}
                    onClick={() => setAmount(preset)}
                    className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-60 ${
                      amount === preset
                        ? "border-neutral-800 bg-neutral-800 text-white"
                        : "border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    {formatIDR(preset)}
                  </button>
                ))}
              </div>
            </div>

            {tx.phase === "error" ? <p className="text-sm text-red-600">{tx.message}</p> : null}

            <button
              type="button"
              disabled={pending}
              onClick={() => void submit()}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {tx.phase === "awaiting-signature"
                ? strings.contribute.awaitingSignature
                : tx.phase === "submitting"
                  ? strings.contribute.submitting
                  : strings.contribute.confirmCta}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="mt-4 text-sm text-neutral-500 underline underline-offset-2 disabled:opacity-60"
        >
          {tx.phase === "success" ? strings.contribute.close : strings.contribute.cancel}
        </button>
      </div>
    </div>
  );
}
