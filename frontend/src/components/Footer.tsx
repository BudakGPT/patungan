import { strings } from "@/strings";
import { ContractExplorerLink } from "./ExplorerLink";

/** Transparency footer: everything is on-chain, and here's the contract to prove it. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-ink px-4 py-6 text-xs font-semibold leading-6 text-white/42 sm:px-7 lg:px-10">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span>{strings.footer.transparency}</span>
        <ContractExplorerLink />
      </div>
    </footer>
  );
}
