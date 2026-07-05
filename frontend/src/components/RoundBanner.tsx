"use client";

import { useRound } from "@/lib/hooks";
import { formatIDR } from "@/lib/format";
import { strings } from "@/strings";

const NOT_INITIALIZED_PATTERN = /MissingValue|not.?init/i;

/** A1 · round summary banner: pool, sponsor, status, round-end (§7 Epic A1). */
export function RoundBanner() {
  const round = useRound();

  // Data wins over a failed background refetch (H1): the 4s poll against public testnet
  // RPC can hiccup, and a stale banner beats a blank error mid-demo.
  if (round.data === undefined) {
    if (round.isError) {
      if (NOT_INITIALIZED_PATTERN.test(String(round.error))) {
        return <p className="text-neutral-500">{strings.landing.notInitialized}</p>;
      }
      return (
        <div className="flex items-center gap-3 text-red-600">
          <p>{strings.errorGeneric}</p>
          <button
            type="button"
            onClick={() => round.refetch()}
            className="underline underline-offset-2"
          >
            {strings.retry}
          </button>
        </div>
      );
    }
    return <p className="text-neutral-500">{strings.loading}</p>;
  }

  const config = round.data;
  const isOpen = config.status.tag === "Open";
  const roundEnd = new Date(Number(config.round_end) * 1000);

  return (
    <div>
      {round.isError ? (
        <p className="mb-1 text-xs text-amber-700">{strings.staleData}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-neutral-200 p-4">
        <div>
          <p className="text-xs uppercase text-neutral-500">{strings.landing.poolLabel}</p>
          <p className="text-xl font-semibold">
            {config.pool === 0n ? strings.landing.waitingSponsor : formatIDR(config.pool)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-neutral-500">{strings.landing.sponsorLabel}</p>
          <p className="font-medium">{strings.landing.sponsorName}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            isOpen ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-800"
          }`}
        >
          {isOpen ? strings.landing.statusOpen : strings.landing.statusFinalized}
        </span>
        <p className="text-sm text-neutral-600">
          {strings.landing.roundEndLabel}{" "}
          {roundEnd.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
    </div>
  );
}
