import Link from "next/link";
import { strings } from "@/strings";
import { WalletButton } from "./WalletButton";
import { NetworkBanner } from "./NetworkBanner";

export function Header() {
  return (
    <>
      <NetworkBanner />
      <header className="sticky top-0 z-40 border-b border-lime/20 bg-ink/82 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,.34)] backdrop-blur-2xl sm:px-7 lg:px-10">
        <nav className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-4" aria-label="Patungan home">
            <span className="brand-mark shrink-0">
              <img src="/assets/patungan-logo.png" alt="Patungan logo" />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-[1.45rem] font-black leading-none text-paper drop-shadow-sm sm:text-[1.65rem]">
                {strings.appName}
              </span>
              <span className="mt-2 block truncate text-[.68rem] font-black uppercase tracking-[.18em] text-lime/82">
                gotong royong on-chain
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            <Link href="/" className="nav-pill">
              <span className="size-2 rounded-full bg-lime" />
              {strings.nav.landing}
            </Link>
            <Link href="/seasons" className="nav-pill">
              <span className="size-2 rounded-full bg-green" />
              {strings.nav.seasons}
            </Link>
            <Link href="/results" className="nav-pill">
              <span className="size-2 rounded-full bg-sea" />
              {strings.nav.results}
            </Link>
            <Link href="/dashboard" className="nav-pill">
              <span className="size-2 rounded-full bg-clay" />
              {strings.nav.dashboard}
            </Link>
            <Link href="/account" className="nav-pill">
              <span className="size-2 rounded-full bg-deep" />
              {strings.nav.account}
            </Link>
            <Link href="/operator" className="nav-pill">
              <span className="size-2 rounded-full bg-gold" />
              {strings.nav.operator}
            </Link>
          </div>

          <WalletButton />
        </nav>
      </header>
    </>
  );
}
