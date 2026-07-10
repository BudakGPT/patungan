"use client";

import { config } from "@/lib/config";
import { useStrings } from "@/lib/locale";

/**
 * F1 · link a successful tx hash to stellar.expert so a skeptical judge can verify it's
 * genuinely on-chain. Renders nothing for an empty hash (e.g. before a tx lands).
 */
export function ExplorerLink({ hash, label }: { hash: string; label?: string }) {
  const strings = useStrings();
  if (!hash) return null;
  return (
    <a
      href={`${config.explorerBase}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {label ?? strings.explorer.viewTx}
    </a>
  );
}

/** F1 · footer link to the contract itself on stellar.expert. */
export function ContractExplorerLink() {
  const strings = useStrings();
  return (
    <a
      href={`${config.explorerBase}/contract/${config.contractId}`}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {strings.explorer.viewContract}
    </a>
  );
}
