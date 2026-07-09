/** Renders a raw integer token amount (1 minor-unit = Rp1) as Indonesian Rupiah. */
export function formatIDR(amount: number | bigint): string {
  const n = typeof amount === "bigint" ? amount : Math.trunc(amount);
  return `Rp${n.toLocaleString("id-ID")}`;
}

/** `G…4CHARS` — a Stellar address truncated for a byline (sponsor, owner). */
export function truncateAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/**
 * Compact countdown to a unix-second deadline (round_end is `u64` seconds), coarsening to the
 * two most significant non-zero units: `2h 4j`, `5j 12m`, `< 1m`. Returns `null` once elapsed so
 * callers can switch to the "ended" copy. `units` supplies the localized suffixes.
 */
export function formatCountdown(
  endSec: number | bigint,
  units: { day: string; hour: string; min: string },
  nowMs = Date.now(),
): string | null {
  const remainingSec = Number(endSec) - Math.floor(nowMs / 1000);
  if (remainingSec <= 0) return null;
  const d = Math.floor(remainingSec / 86_400);
  const h = Math.floor((remainingSec % 86_400) / 3_600);
  const m = Math.floor((remainingSec % 3_600) / 60);
  if (d > 0) return `${d}${units.day} ${h}${units.hour}`;
  if (h > 0) return `${h}${units.hour} ${m}${units.min}`;
  if (m > 0) return `${m}${units.min}`;
  return `< 1${units.min}`;
}

/** Compact IDR for tight hero/stat surfaces: `Rp1,2jt`, `Rp850rb`, falling back to `formatIDR` under Rp1.000. */
export function formatCompactIDR(amount: number | bigint): string {
  const n = Number(typeof amount === "bigint" ? amount : Math.trunc(amount));

  if (n >= 1_000_000_000) {
    return `Rp${(n / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })}M`;
  }

  if (n >= 1_000_000) {
    const million = n / 1_000_000;
    return `Rp${million.toLocaleString("id-ID", {
      maximumFractionDigits: million >= 10 ? 1 : 2,
    })}jt`;
  }

  if (n >= 1_000) {
    return `Rp${Math.round(n / 1_000).toLocaleString("id-ID")}rb`;
  }

  return formatIDR(n);
}
