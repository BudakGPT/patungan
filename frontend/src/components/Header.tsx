import Link from "next/link";
import { strings } from "@/strings";
import { WalletButton } from "./WalletButton";
import { NetworkBanner } from "./NetworkBanner";

export function Header() {
  return (
    <>
      <NetworkBanner />
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/">{strings.appName}</Link>
          <Link href="/results" className="text-neutral-600 hover:text-neutral-900">
            {strings.nav.results}
          </Link>
          <Link href="/operator" className="text-neutral-600 hover:text-neutral-900">
            {strings.nav.operator}
          </Link>
        </nav>
        <WalletButton />
      </header>
    </>
  );
}
