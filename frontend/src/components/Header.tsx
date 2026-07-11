"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStrings } from "@/lib/locale";
import { brand } from "@/brand";
import { config } from "@/lib/config";
import { WalletButton } from "./WalletButton";
import { NetworkBanner } from "./NetworkBanner";
import { LocaleToggle } from "./LocaleToggle";

export function Header() {
  const strings = useStrings();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduced = useReducedMotion();

  const NAV_ITEMS = useMemo(
    () =>
      [
        { href: "/", label: strings.nav.landing },
        { href: "/seasons", label: strings.nav.seasons },
        { href: "/results", label: strings.nav.results },
        { href: "/dashboard", label: strings.nav.dashboard },
        { href: "/account", label: strings.nav.account },
        { href: "/operator", label: strings.nav.operator },
      ] as const,
    [strings],
  );

  // Close the drawer on navigation and lock body scroll while it's open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <NetworkBanner />
      <header className="sticky top-0 z-40 border-b border-lime/20 bg-ink/85 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,.34)] backdrop-blur-2xl sm:px-7 lg:px-10">
        <nav className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-4" aria-label="Patungan home">
            <span className="brand-mark shrink-0">
              <img src="/assets/patungan-logo.png" alt="Patungan logo" />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-[1.45rem] font-black leading-none text-paper drop-shadow-sm sm:text-[1.65rem]">
                {strings.appName}
              </span>
              <span className="mt-2 block truncate text-[.68rem] font-black uppercase tracking-[.18em] text-lime/85">
                {brand.tagline}
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname === item.href ? "nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden lg:block">
              <LocaleToggle />
            </div>
            <WalletButton />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? strings.nav.closeMenu : strings.nav.openMenu}
              className="icon-btn lg:hidden"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="mobile-nav"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex flex-col bg-ink text-paper lg:hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-7">
              <span className="flex items-center gap-3">
                <span className="brand-mark shrink-0">
                  <img src="/assets/patungan-logo.png" alt="" aria-hidden />
                </span>
                <span className="text-xl font-black">{strings.appName}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.nav.closeMenu}
                className="icon-btn"
              >
                <MenuIcon open />
              </button>
            </div>

            <nav className="flex flex-1 flex-col justify-center gap-1 px-6 sm:px-9" aria-label={strings.nav.mainMenu}>
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={reduced ? false : { opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.05 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    href={item.href}
                    className={`group flex items-baseline gap-4 border-b border-white/10 py-4 ${
                      pathname === item.href ? "text-lime" : "text-paper"
                    }`}
                  >
                    <span className="display text-4xl leading-none sm:text-5xl">{item.label}</span>
                    <span className="mono ml-auto self-center text-xs text-white/55">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-2 px-6 pb-8 sm:px-9">
              <span className="hash-chip">
                <span className="size-1.5 rounded-full bg-lime" />
                contract: {config.contractId.slice(0, 4)}…{config.contractId.slice(-4)}
              </span>
              <LocaleToggle openUp />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function MenuIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {open ? (
        <>
          <path d="m5 5 10 10" />
          <path d="m15 5-10 10" />
        </>
      ) : (
        <>
          <path d="M3 6.5h14" />
          <path d="M3 13.5h14" />
        </>
      )}
    </svg>
  );
}
