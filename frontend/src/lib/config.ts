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
