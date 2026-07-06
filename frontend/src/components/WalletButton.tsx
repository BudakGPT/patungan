"use client";

import { useWallet } from "@/lib/wallet";
import { strings } from "@/strings";
import { VerifiedBadge } from "./VerifiedBadge";

function truncate(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { status, address, connectError, connect, disconnect } = useWallet();

  if (status === "not-installed") {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
        className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
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
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {status === "connecting" ? strings.wallet.connecting : strings.wallet.connect}
        </button>
      </div>
    );
  }

  const isWrongNetwork = status === "wrong-network";
  return (
    <div className="flex items-center gap-2">
      {address ? <VerifiedBadge address={address} /> : null}
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
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
      >
        {address ? truncate(address) : null}
      </button>
    </div>
  );
}
