"use client";

import { useWallet } from "@/lib/wallet";
import { useTier } from "@/lib/hooks";
import { strings } from "@/strings";
import { TierBadge } from "./TierBadge";

function truncate(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { status, address, connectError, connect, disconnect } = useWallet();
  const { data: tier } = useTier(address);

  if (status === "not-installed") {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
        className="btn btn-lime min-h-11 px-4 text-sm"
      >
        {strings.wallet.notInstalled}
      </a>
    );
  }

  if (status === "disconnected" || status === "connecting") {
    return (
      <div className="flex items-center gap-2">
        {connectError ? (
          <span className="text-xs text-red-600" title={connectError}>
            {strings.wallet.connectFailed}
          </span>
        ) : null}
        <button
          type="button"
          disabled={status === "connecting"}
          onClick={() => void connect()}
          className="btn btn-lime min-h-11 px-4 text-sm disabled:opacity-60"
        >
          {status === "connecting" ? strings.wallet.connecting : strings.wallet.connect}
        </button>
      </div>
    );
  }

  const isWrongNetwork = status === "wrong-network";
  return (
    <div className="flex items-center gap-2">
      {address ? <TierBadge tier={tier} /> : null}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          isWrongNetwork
            ? "bg-red-100 text-red-700"
            : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {isWrongNetwork ? strings.wallet.wrongNetworkPill : strings.wallet.testnetPill}
      </span>
      <button
        type="button"
        onClick={disconnect}
        title={address ?? undefined}
        className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-sm font-black text-paper hover:bg-white/15"
      >
        {address ? truncate(address) : null}
      </button>
    </div>
  );
}
