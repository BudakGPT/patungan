"use client";

/**
 * Off-chain account provenance for an organizer wallet — a deliberately empty seam for now.
 *
 * The council verdict (and our own "no backend, events are the source" constraint) landed here: the
 * only account-provenance field worth surfacing to a donor is a *verified* `home_domain` — a wallet
 * that has cryptographically attested a domain via that domain's `stellar.toml`. Account age and
 * signer counts are gameable or meaningless to donors, so we never show them. And a verified domain
 * only exists in practice on mainnet once real organizations set one; on testnet every field is
 * empty. So this returns `null` everywhere today and the organizer panel renders nothing extra.
 *
 * Wiring it up later is a one-function change with no caller churn: implement this to fetch the
 * account's `home_domain` (Horizon) and validate it against the domain's `stellar.toml`, gate on
 * mainnet, and return a `Provenance` only when the attestation actually checks out.
 */
export interface Provenance {
  /** A `home_domain` the wallet has cryptographically attested via its `stellar.toml`. */
  verifiedDomain: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getProvenance(pubkey: string): Promise<Provenance | null> {
  // Intentionally null: no Horizon dependency until mainnet + a real verified domain make it worth it.
  return null;
}
