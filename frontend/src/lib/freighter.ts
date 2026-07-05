import freighterApi from "@stellar/freighter-api";

export interface FreighterAccessResult {
  address: string | null;
  error: string | null;
}

export async function isFreighterInstalled(): Promise<boolean> {
  const result = await freighterApi.isConnected();
  return !result.error && result.isConnected;
}

/** Reads the current address without prompting, iff this origin was already granted access. */
export async function getAllowedAddress(): Promise<FreighterAccessResult> {
  const allowed = await freighterApi.isAllowed();
  if (allowed.error || !allowed.isAllowed) return { address: null, error: null };

  const addr = await freighterApi.getAddress();
  if (addr.error) return { address: null, error: addr.error.message };
  return { address: addr.address, error: null };
}

/** Prompts the user for access (Freighter's connect popup) and returns the address. */
export async function requestFreighterAccess(): Promise<FreighterAccessResult> {
  const access = await freighterApi.requestAccess();
  if (access.error) return { address: null, error: access.error.message };
  return { address: access.address, error: null };
}

export async function getFreighterNetwork(): Promise<string | null> {
  const result = await freighterApi.getNetwork();
  if (result.error) return null;
  return result.network;
}

export async function signTransactionXdr(
  xdr: string,
  opts: { networkPassphrase: string; address: string },
): Promise<{ signedTxXdr: string | null; error: string | null }> {
  const result = await freighterApi.signTransaction(xdr, opts);
  if (result.error) return { signedTxXdr: null, error: result.error.message };
  return { signedTxXdr: result.signedTxXdr, error: null };
}
