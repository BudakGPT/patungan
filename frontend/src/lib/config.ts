function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  network: required("NEXT_PUBLIC_NETWORK", process.env.NEXT_PUBLIC_NETWORK),
  sorobanRpcUrl: required(
    "NEXT_PUBLIC_SOROBAN_RPC_URL",
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
  ),
  networkPassphrase: required(
    "NEXT_PUBLIC_NETWORK_PASSPHRASE",
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
  ),
  contractId: required(
    "NEXT_PUBLIC_CONTRACT_ID",
    process.env.NEXT_PUBLIC_CONTRACT_ID,
  ),
  tokenId: required("NEXT_PUBLIC_TOKEN_ID", process.env.NEXT_PUBLIC_TOKEN_ID),
  explorerBase: required(
    "NEXT_PUBLIC_EXPLORER_BASE",
    process.env.NEXT_PUBLIC_EXPLORER_BASE,
  ),
  adminAddress: required(
    "NEXT_PUBLIC_ADMIN_ADDRESS",
    process.env.NEXT_PUBLIC_ADMIN_ADDRESS,
  ),
} as const;

/**
 * Anchor (SEP-10) config — **optional**, not `required()`: verification degrades gracefully to the
 * labeled testnet stand-in when no anchor is wired. The KYC PII never touches us; only
 * the on-chain tier attestation does. `homeDomain` resolves `WEB_AUTH_ENDPOINT`/`SIGNING_KEY` from
 * `stellar.toml` when `authEndpoint` is left blank. No secrets here — the attester key stays operator-side.
 */
export const anchorConfig = {
  homeDomain: process.env.NEXT_PUBLIC_ANCHOR_HOME_DOMAIN?.trim() || null,
  authEndpoint: process.env.NEXT_PUBLIC_ANCHOR_AUTH_ENDPOINT?.trim() || null,
} as const;

/** True when at least a home domain or an explicit auth endpoint is configured — gates the SEP-10 UI. */
export const anchorConfigured = anchorConfig.homeDomain !== null || anchorConfig.authEndpoint !== null;
