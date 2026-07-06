"use client";

import { useIsVerified } from "@/lib/hooks";
import { strings } from "@/strings";

/**
 * E1 · Sybil-resistance badge: "✓ Terverifikasi" when the address is in the registry, a
 * neutral "Belum terverifikasi" otherwise (not alarming — contribute is still blocked
 * server-side by `NotVerified`). Renders nothing while the lookup is in flight.
 */
export function VerifiedBadge({ address }: { address: string }) {
  const { data: verified } = useIsVerified(address);
  if (verified === undefined) return null;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        verified ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {verified ? strings.verified.yes : strings.verified.no}
    </span>
  );
}
