/**
 * Brand-register constants — copy that is deliberately identical in every locale, per the
 * bilingual register rule (DESIGN.md §3): display slogans and machine-voice chips are brand
 * identity, not product copy, so they never translate. Everything a user must *understand*
 * (labels, states, figures) lives in the `strings.<locale>.ts` catalogs instead.
 *
 * Living in one module (rather than four identical copies in the locale files) makes drift
 * impossible.
 */
export const brand = {
  /** The lime marquee strip: deliberate EN/ID alternating pairs — each English slogan is
   * followed by its Indonesian sibling, so the bilingual mix reads as rhythm, not as
   * unfinished localization. */
  marquee: [
    "Crowd beats whale.",
    "Dana padanan mengikuti jumlah orang",
    "Soroban records every contribution",
    "Setiap kontribusi tercatat on-chain",
    "Contract computes (sum sqrt c)^2",
    "Rp50rb × 200 perantau > Rp10jt × 1 donor",
    "Public payout, no backroom allocation",
    "Pencairan publik, bisa diaudit siapa pun",
  ],
  /** Machine-voice status chips — mono/uppercase artifacts of the engine, not UI copy. */
  machine: {
    ready: "READY",
    idle: "IDLE",
    live: "live",
    queued: "queued",
    escrow: "escrow",
    registry: "registry",
    payout: "payout",
  },
  /** Header tagline — brand identity line, constant across locales. */
  tagline: "gotong royong on-chain",
} as const;
