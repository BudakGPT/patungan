import { strings } from "@/strings";
import { ContractExplorerLink } from "./ExplorerLink";

/** Transparency footer: everything is on-chain, and here's the contract to prove it. */
export function Footer() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-neutral-200 px-6 py-4 text-center text-xs text-neutral-500">
      <span>{strings.footer.transparency}</span>
      <ContractExplorerLink />
    </footer>
  );
}
