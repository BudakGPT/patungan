"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { Config, ProjectState } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useRound, useProjects } from "@/lib/hooks";
import { mapContractError } from "@/lib/errors";
import { formatIDR } from "@/lib/format";
import { strings } from "@/strings";
import { QueryState } from "@/components/QueryState";
import { ExplorerLink } from "@/components/ExplorerLink";

const DEFAULT_POOL_AMOUNT = 100_000_000;

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting-signature" }
  | { phase: "submitting" }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };

function isPending(tx: TxState): boolean {
  return tx.phase === "awaiting-signature" || tx.phase === "submitting";
}

function txLabel(tx: TxState, idleLabel: string): string {
  if (tx.phase === "awaiting-signature") return strings.operator.awaitingSignature;
  if (tx.phase === "submitting") return strings.operator.submitting;
  return idleLabel;
}

/** C1–C4 · gated operator console: fund pool, finalise, disburse (§7 Epic C). */
export default function OperatorPage() {
  const { address, canWrite } = useWallet();
  const round = useRound();
  const projects = useProjects();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [fundAmount, setFundAmount] = useState(DEFAULT_POOL_AMOUNT);
  const [fundTx, setFundTx] = useState<TxState>({ phase: "idle" });
  const [finalizeTx, setFinalizeTx] = useState<TxState>({ phase: "idle" });
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [disburseTx, setDisburseTx] = useState<Record<number, TxState>>({});

  // §6.3: loading/error before we even know the admin address.
  if (round.data === undefined) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-3xl font-bold">{strings.operator.title}</h1>
        {round.isError ? (
          <div className="mt-4 flex items-center gap-3 text-red-600">
            <p>{strings.errorGeneric}</p>
            <button
              type="button"
              onClick={() => round.refetch()}
              className="underline underline-offset-2"
            >
              {strings.retry}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-neutral-500">{strings.loading}</p>
        )}
      </main>
    );
  }

  // C1 · gate: controls only render for the connected admin wallet.
  const isAdmin = canWrite && address === round.data.admin;
  if (!isAdmin) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-3xl font-bold">{strings.operator.title}</h1>
        <p className="mt-2 text-neutral-600">
          {canWrite ? strings.operator.notAdmin : strings.operator.gated}
        </p>
      </main>
    );
  }

  const isOpen = round.data.status.tag === "Open";
  const isFinalized = round.data.status.tag === "Finalized";

  async function submitFundPool() {
    if (isPending(fundTx) || fundAmount <= 0) return;
    setFundTx({ phase: "awaiting-signature" });
    try {
      const assembled = await contractClient.fund_pool(
        { from: address!, amount: BigInt(fundAmount) },
        { publicKey: address! },
      );
      const sent = await assembled.signAndSend({
        signTransaction: freighterApi.signTransaction,
        watcher: {
          onSubmitted: () => setFundTx({ phase: "submitting" }),
          onProgress: () => {},
        },
      });
      if (sent.result.isErr()) {
        setFundTx({
          phase: "error",
          message: mapContractError(sent.result.unwrapErr(), strings.operator.errors),
        });
        return;
      }
      queryClient.setQueryData<Config>(["round"], (old) =>
        old ? { ...old, pool: old.pool + BigInt(fundAmount) } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["round"] });
      setFundTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
    } catch (err) {
      setFundTx({ phase: "error", message: mapContractError(err, strings.operator.errors) });
    }
  }

  async function submitFinalize() {
    if (isPending(finalizeTx)) return;
    setFinalizeTx({ phase: "awaiting-signature" });
    try {
      const assembled = await contractClient.finalize({ publicKey: address! });
      const sent = await assembled.signAndSend({
        signTransaction: freighterApi.signTransaction,
        watcher: {
          onSubmitted: () => setFinalizeTx({ phase: "submitting" }),
          onProgress: () => {},
        },
      });
      if (sent.result.isErr()) {
        setFinalizeTx({
          phase: "error",
          message: mapContractError(sent.result.unwrapErr(), strings.operator.errors),
        });
        setConfirmingFinalize(false);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["round"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["previewMatches"] });
      setFinalizeTx({ phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" });
      setConfirmingFinalize(false);
      router.push("/results");
    } catch (err) {
      setFinalizeTx({ phase: "error", message: mapContractError(err, strings.operator.errors) });
      setConfirmingFinalize(false);
    }
  }

  async function submitDisburse(projectId: number) {
    if (isPending(disburseTx[projectId] ?? { phase: "idle" })) return;
    setDisburseTx((prev) => ({ ...prev, [projectId]: { phase: "awaiting-signature" } }));
    try {
      const assembled = await contractClient.disburse(
        { project_id: projectId },
        { publicKey: address! },
      );
      const sent = await assembled.signAndSend({
        signTransaction: freighterApi.signTransaction,
        watcher: {
          onSubmitted: () =>
            setDisburseTx((prev) => ({ ...prev, [projectId]: { phase: "submitting" } })),
          onProgress: () => {},
        },
      });
      if (sent.result.isErr()) {
        setDisburseTx((prev) => ({
          ...prev,
          [projectId]: {
            phase: "error",
            message: mapContractError(sent.result.unwrapErr(), strings.operator.errors),
          },
        }));
        return;
      }
      queryClient.setQueryData<ProjectState[]>(["projects"], (old) =>
        old?.map((p) => (p.id === projectId ? { ...p, disbursed: true } : p)),
      );
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDisburseTx((prev) => ({
        ...prev,
        [projectId]: { phase: "success", hash: sent.sendTransactionResponse?.hash ?? "" },
      }));
    } catch (err) {
      setDisburseTx((prev) => ({
        ...prev,
        [projectId]: { phase: "error", message: mapContractError(err, strings.operator.errors) },
      }));
    }
  }

  return (
    <main className="min-h-screen space-y-8 p-8">
      <h1 className="text-3xl font-bold">{strings.operator.title}</h1>

      {/* C2 · fund the matching pool */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">{strings.operator.fundPool.heading}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-xs uppercase text-neutral-500">
            {strings.operator.fundPool.amountLabel}
            <input
              type="number"
              min={1}
              value={fundAmount}
              disabled={isPending(fundTx) || !isOpen}
              onChange={(e) => setFundAmount(Number(e.target.value))}
              className="mt-1 w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm normal-case text-neutral-900 disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            disabled={isPending(fundTx) || !isOpen || fundAmount <= 0}
            onClick={() => void submitFundPool()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {txLabel(fundTx, strings.operator.fundPool.cta)}
          </button>
        </div>
        {!isOpen ? (
          <p className="mt-2 text-sm text-neutral-500">{strings.operator.errors.RoundNotOpen}</p>
        ) : null}
        {fundTx.phase === "error" ? (
          <p className="mt-2 text-sm text-red-600">{fundTx.message}</p>
        ) : null}
        {fundTx.phase === "success" ? (
          <p className="mt-2 text-sm text-emerald-700">
            {strings.operator.fundPool.successTitle} <ExplorerLink hash={fundTx.hash} />
          </p>
        ) : null}
      </section>

      {/* C3 · finalise the round */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">{strings.operator.finalize.heading}</h2>
        <p className="mt-1 text-sm text-neutral-600">{strings.operator.finalize.description}</p>
        {isFinalized ? (
          <p className="mt-3 text-sm text-neutral-500">{strings.operator.finalize.doneLabel}</p>
        ) : confirmingFinalize ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-amber-700">
              {strings.operator.finalize.confirmMessage}
            </p>
            <button
              type="button"
              disabled={isPending(finalizeTx)}
              onClick={() => void submitFinalize()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
            >
              {txLabel(finalizeTx, strings.operator.finalize.confirmCta)}
            </button>
            <button
              type="button"
              disabled={isPending(finalizeTx)}
              onClick={() => setConfirmingFinalize(false)}
              className="text-sm text-neutral-500 underline underline-offset-2 disabled:opacity-60"
            >
              {strings.operator.finalize.cancelCta}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingFinalize(true)}
            className="mt-3 rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            {strings.operator.finalize.cta}
          </button>
        )}
        {finalizeTx.phase === "error" ? (
          <p className="mt-2 text-sm text-red-600">{finalizeTx.message}</p>
        ) : null}
        {finalizeTx.phase === "success" ? (
          <p className="mt-2 text-sm text-emerald-700">
            {strings.operator.finalize.successTitle} <ExplorerLink hash={finalizeTx.hash} />
          </p>
        ) : null}
      </section>

      {/* C4 · disburse per project */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">{strings.operator.disburse.heading}</h2>
        {!isFinalized ? (
          <p className="mt-2 text-sm text-neutral-500">{strings.operator.disburse.needsFinalize}</p>
        ) : (
          <QueryState query={projects} isEmpty={(data) => data.length === 0}>
            {(data) => (
              <ul className="mt-3 space-y-2">
                {data.map((project) => {
                  const tx = disburseTx[project.id] ?? { phase: "idle" as const };
                  return (
                    <li
                      key={project.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-100 p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {project.emoji} {project.title}
                        </p>
                        <p className="text-sm text-neutral-500">
                          {formatIDR(project.direct)} + {formatIDR(project.matched)}
                        </p>
                      </div>
                      {project.disbursed ? (
                        <span className="text-sm text-emerald-700">
                          {strings.operator.disburse.disbursedLabel}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending(tx)}
                          onClick={() => void submitDisburse(project.id)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                        >
                          {txLabel(tx, strings.operator.disburse.cta)}
                        </button>
                      )}
                      {tx.phase === "error" ? (
                        <p className="w-full text-sm text-red-600">{tx.message}</p>
                      ) : null}
                      {tx.phase === "success" ? (
                        <p className="w-full text-sm text-emerald-700">
                          <ExplorerLink hash={tx.hash} />
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryState>
        )}
      </section>
    </main>
  );
}
