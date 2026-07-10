"use client";

import { useWallet } from "@/lib/wallet";
import { useStrings } from "@/lib/locale";

/** Persistent banner for E2 — wrong network must be impossible to miss before a live tx. */
export function NetworkBanner() {
  const strings = useStrings();
  const { status } = useWallet();
  if (status !== "wrong-network") return null;

  return (
    <div role="alert" className="w-full bg-red-600 px-4 py-2 text-center text-sm text-white">
      {strings.wallet.wrongNetworkBanner}
    </div>
  );
}
