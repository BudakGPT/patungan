"use client";

import { Tier } from "@/contract/src";
import { useStrings } from "@/lib/locale";
import type { Strings } from "@/strings.id";

/**
 * Tier-aware verification badge — the ascending-trust signal reused across the
 * app. Hue climbs with tier: `None` is neutral (not alarming — the contribute gate blocks on-chain,
 * the badge just states the fact), `Basic` wears the interaction accent (indigo), `Institution` the
 * reserved match/emerald (the "highest" hue, same one that carries the quadratic-match figure).
 * Two variants share one token table: an inline pill for headers/rows and a large status block for
 * the `/verify` hero. Copy comes from the active locale's `strings.tierBadge`.
 */

interface TierStyle {
  /** Small pill classes. */ pill: string;
  /** Large status-block accent classes (border + tint). */ block: string;
  /** Muted text-only tint for the header's merged wallet-status capsule (no pill chrome of its own). */
  tint: string;
  /** Check glyph — a single ✓ for any verified tier (Basic/Institution), empty for None. Rank is
   *  carried by hue + label, not by doubling the check. Shared by the pill, block, and capsule. */
  mark: string;
  label: string;
  unlocks: string;
}

function styleFor(tier: Tier, tb: Strings["tierBadge"]): TierStyle {
  switch (tier) {
    case Tier.Institution:
      return {
        pill: "bg-match-soft text-match-ink",
        block: "border-match/30 bg-match-soft",
        tint: "text-match/70",
        mark: "✓",
        label: tb.tiers.Institution,
        unlocks: tb.unlocks.Institution,
      };
    case Tier.Basic:
      return {
        pill: "bg-accent-soft text-accent-ink",
        block: "border-accent/25 bg-accent-soft",
        tint: "text-accent/70",
        mark: "✓",
        label: tb.tiers.Basic,
        unlocks: tb.unlocks.Basic,
      };
    default:
      return {
        pill: "bg-paper text-muted",
        block: "border-line bg-paper",
        tint: "text-paper/55",
        mark: "",
        label: tb.tiers.None,
        unlocks: tb.unlocks.None,
      };
  }
}

/**
 * Inline pill — headers, rows, wallet button. Renders nothing while the tier is still loading.
 * `variant: "inline"` drops the pill chrome entirely and just tints the label text — used inside
 * the header's merged wallet-status capsule, which supplies its own shared border/background.
 * Every other caller keeps the default light pill untouched.
 */
export function TierBadge({ tier, variant = "light" }: { tier: Tier | undefined; variant?: "light" | "inline" }) {
  const { tierBadge: tb } = useStrings();
  if (tier === undefined) return null;
  const s = styleFor(tier, tb);
  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold ${s.tint}`}>
        {s.mark ? <span aria-hidden>{s.mark}</span> : null}
        {s.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.pill}`}>
      {s.mark ? <span aria-hidden>{s.mark}</span> : null}
      {s.label}
    </span>
  );
}

/**
 * Large status block — the `/verify` current-state anchor. Names the tier, shows the ascending mark,
 * and states what it unlocks in one line, so a cold visitor reads "where am I / what does it give me"
 * without a legend.
 */
export function TierStatusBlock({ tier }: { tier: Tier }) {
  const { tierBadge: tb } = useStrings();
  const s = styleFor(tier, tb);
  return (
    <div className={`rounded-2xl border px-5 py-4 sm:px-6 sm:py-5 ${s.block}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{tb.currentLabel}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        {s.mark ? (
          <span aria-hidden className="text-lg font-semibold text-ink">
            {s.mark}
          </span>
        ) : null}
        <span className="text-2xl font-bold tracking-tight text-ink">{s.label}</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{s.unlocks}</p>
    </div>
  );
}
