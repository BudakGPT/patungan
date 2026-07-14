"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useTier } from "@/lib/hooks";
import { useStrings } from "@/lib/locale";
import { TierBadge } from "./TierBadge";

function truncate(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const strings = useStrings();
  const { status, address, connectError, connect, disconnect } = useWallet();
  const { data: tier } = useTier(address);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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
          <span className="hidden text-xs text-red-300 sm:inline" title={connectError}>
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
      {/* Verification tier + network, merged into one quiet capsule matching the header's other chips. */}
      <span className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm lg:inline-flex">
        {address ? (
          <span className="hidden items-center gap-2 xl:flex">
            <TierBadge tier={tier} variant="inline" />
            <span className="h-3.5 w-px bg-white/15" />
          </span>
        ) : null}
        <span className={`font-semibold ${isWrongNetwork ? "text-red-300/80" : "text-gold/70"}`}>
          {isWrongNetwork ? strings.wallet.wrongNetworkPill : strings.wallet.testnetPill}
        </span>
      </span>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={address ?? undefined}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-black text-paper hover:bg-white/15"
        >
          {address ? truncate(address) : null}
          <ChevronIcon open={menuOpen} />
        </button>

        {menuOpen ? (
          <div role="menu" className="glass-dark absolute right-0 top-full z-50 mt-2 w-48 rounded-xl p-1">
            <Link
              href="/verify"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-paper/80 hover:bg-white/10 hover:text-paper"
            >
              {strings.wallet.verify}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-paper/80 hover:bg-white/10 hover:text-paper"
            >
              {strings.wallet.disconnect}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m1.5 1.5 4.5 5 4.5-5" />
    </svg>
  );
}
