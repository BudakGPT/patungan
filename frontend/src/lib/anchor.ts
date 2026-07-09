import { WebAuth, TransactionBuilder, Transaction } from "@stellar/stellar-sdk";
import freighterApi from "@stellar/freighter-api";
import { anchorConfig, config } from "./config";

/**
 * SEP-10 web-auth client: prove the connected wallet owns its key to the anchor and
 * receive a short-lived JWT. This is the *real* seam — production swaps the anchor's key for a
 * licensed one, no code change. Nothing here is a secret: the attester key that writes the on-chain
 * tier stays operator-side, never in the browser.
 *
 * SEP-12 KYC (below `submitKyc`/`pollKyc`) is attempted for real against the anchor's advertised
 * `KYC_SERVER` when one is discoverable from `stellar.toml`. When no `KYC_SERVER` is published (the
 * default on this testnet deployment — no reference anchor is wired), `resolveKycServer` resolves to
 * `null` and the `/verify` UI degrades to the clearly-labeled simulated attest path: the attester
 * key writes the tier directly. Neither path ever sees KYC PII persist here —
 * fields are forwarded to the anchor and only the resulting on-chain `Tier` is read back.
 *
 * Flow: resolve the anchor's `WEB_AUTH_ENDPOINT` + `SIGNING_KEY` (from `stellar.toml`, or the env
 * override) → GET a challenge transaction → validate its SEP-10 shape with `readChallengeTx` →
 * sign it in Freighter (adds the client signature; the anchor's fee/source signature is already
 * there) → POST it back for the JWT. Every network failure surfaces as a typed `AnchorError` the UI
 * maps to a Bahasa message, so a flaky anchor never hard-crashes the verify screen.
 */

/** Verification-flow error codes the `/verify` UI maps to Bahasa copy (never a raw fetch throw). */
export type AnchorErrorCode =
  | "not-configured"
  | "toml"
  | "challenge"
  | "invalid-challenge"
  | "signature"
  | "token"
  | "network"
  | "kyc-not-configured"
  | "kyc-rejected";

export class AnchorError extends Error {
  constructor(
    public code: AnchorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AnchorError";
  }
}

interface AnchorEndpoints {
  authEndpoint: string;
  /** The anchor's SEP-10 server signing key, when discoverable from `stellar.toml`. */
  signingKey: string | null;
  /** The domain the challenge's `web_auth_domain` must match — the auth endpoint host. */
  webAuthDomain: string;
}

/** Minimal `stellar.toml` scrape for the two keys SEP-10 needs — avoids pulling a TOML parser. */
function scrapeToml(toml: string, key: string): string | null {
  const m = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m"));
  return m ? m[1] : null;
}

/**
 * Resolve the auth endpoint + signing key. Prefers an explicit `NEXT_PUBLIC_ANCHOR_AUTH_ENDPOINT`;
 * otherwise reads `stellar.toml` at the home domain (SEP-1). Throws `AnchorError("not-configured")`
 * when nothing is wired, which the UI renders as the "anchor not configured" stand-in state.
 */
async function resolveEndpoints(): Promise<AnchorEndpoints> {
  const { homeDomain, authEndpoint } = anchorConfig;
  if (!homeDomain && !authEndpoint) {
    throw new AnchorError("not-configured", "Anchor tidak dikonfigurasi.");
  }

  let signingKey: string | null = null;
  let resolvedEndpoint = authEndpoint;

  if (homeDomain) {
    const tomlUrl = `https://${homeDomain.replace(/\/+$/, "")}/.well-known/stellar.toml`;
    try {
      const res = await fetch(tomlUrl, { headers: { Accept: "text/plain" } });
      if (res.ok) {
        const toml = await res.text();
        signingKey = scrapeToml(toml, "SIGNING_KEY");
        resolvedEndpoint = resolvedEndpoint || scrapeToml(toml, "WEB_AUTH_ENDPOINT");
      }
    } catch {
      // Non-fatal: fall through to the env endpoint if the TOML is unreachable.
    }
  }

  if (!resolvedEndpoint) {
    throw new AnchorError("toml", "Endpoint SEP-10 anchor tidak ditemukan.");
  }
  return { authEndpoint: resolvedEndpoint, signingKey, webAuthDomain: new URL(resolvedEndpoint).host };
}

/** GET the SEP-10 challenge transaction for `account`. */
async function fetchChallenge(
  authEndpoint: string,
  account: string,
  homeDomain: string | null,
): Promise<{ transaction: string; networkPassphrase: string }> {
  const url = new URL(authEndpoint);
  url.searchParams.set("account", account);
  if (homeDomain) url.searchParams.set("home_domain", homeDomain);

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new AnchorError("network", (e as Error).message);
  }
  if (!res.ok) {
    throw new AnchorError("challenge", `Anchor menolak permintaan challenge (${res.status}).`);
  }
  const body = (await res.json()) as { transaction?: string; network_passphrase?: string };
  if (!body.transaction) {
    throw new AnchorError("challenge", "Anchor tidak mengembalikan challenge yang valid.");
  }
  return {
    transaction: body.transaction,
    networkPassphrase: body.network_passphrase ?? config.networkPassphrase,
  };
}

/** POST the signed challenge back to the anchor and unwrap the JWT. */
async function postForToken(authEndpoint: string, signedXdr: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(authEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: signedXdr }),
    });
  } catch (e) {
    throw new AnchorError("network", (e as Error).message);
  }
  if (!res.ok) {
    throw new AnchorError("token", `Anchor menolak challenge yang ditandatangani (${res.status}).`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) {
    throw new AnchorError("token", "Anchor tidak mengembalikan token.");
  }
  return body.token;
}

/**
 * Run the full SEP-10 handshake for `address` and return the anchor JWT. Throws `AnchorError` on any
 * failure. The returned token is short-lived and used only to prove ownership for the SEP-12 seam;
 * we never persist it.
 */
export async function authenticate(address: string): Promise<string> {
  const { authEndpoint, signingKey, webAuthDomain } = await resolveEndpoints();
  const { transaction, networkPassphrase } = await fetchChallenge(
    authEndpoint,
    address,
    anchorConfig.homeDomain,
  );

  // Validate the challenge is a well-formed SEP-10 tx before signing it. Use the anchor's published
  // SIGNING_KEY when we have it; otherwise fall back to the challenge's own source account (a lighter
  // structural check — the POST step still fully authenticates server-side).
  let serverKey = signingKey;
  if (!serverKey) {
    const challengeTx = TransactionBuilder.fromXDR(transaction, networkPassphrase);
    if (!(challengeTx instanceof Transaction)) {
      throw new AnchorError("invalid-challenge", "Anchor mengembalikan fee-bump transaction, bukan challenge SEP-10.");
    }
    serverKey = challengeTx.source;
  }
  try {
    WebAuth.readChallengeTx(
      transaction,
      serverKey,
      networkPassphrase,
      anchorConfig.homeDomain ?? webAuthDomain,
      webAuthDomain,
    );
  } catch (e) {
    throw new AnchorError("invalid-challenge", (e as Error).message);
  }

  let signedXdr: string;
  try {
    const signed = await freighterApi.signTransaction(transaction, {
      networkPassphrase,
      address,
    });
    if (signed.error) throw new Error(signed.error.message ?? String(signed.error));
    signedXdr = signed.signedTxXdr;
  } catch (e) {
    throw new AnchorError("signature", (e as Error).message);
  }

  return postForToken(authEndpoint, signedXdr);
}

/** SEP-12 customer status values (a subset — the ones the `/verify` UI branches on). */
export type KycStatus = "NEEDS_INFO" | "PROCESSING" | "PENDING" | "ACCEPTED" | "REJECTED";

export interface KycFields {
  first_name: string;
  last_name: string;
  email_address: string;
}

export interface KycResult {
  id: string;
  status: KycStatus;
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Discover the anchor's SEP-12 `KYC_SERVER` from `stellar.toml` (falling back to the shared
 * `TRANSFER_SERVER_SEP0012` key some anchors publish instead). Returns `null` when neither key is
 * present — the caller treats that as "no reference anchor KYC available here" and the UI falls
 * back to the simulated attest path.
 */
export async function resolveKycServer(): Promise<string | null> {
  const { homeDomain } = anchorConfig;
  if (!homeDomain) return null;
  try {
    const res = await fetch(`https://${normalizeBase(homeDomain)}/.well-known/stellar.toml`, {
      headers: { Accept: "text/plain" },
    });
    if (!res.ok) return null;
    const toml = await res.text();
    return scrapeToml(toml, "KYC_SERVER") ?? scrapeToml(toml, "TRANSFER_SERVER_SEP0012");
  } catch {
    return null;
  }
}

/** GET `/customer` on the SEP-12 server and normalize the status field. */
export async function pollKyc(kycServer: string, jwt: string, id: string): Promise<KycResult> {
  const url = new URL(`${normalizeBase(kycServer)}/customer`);
  url.searchParams.set("id", id);
  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${jwt}` } });
  } catch (e) {
    throw new AnchorError("network", (e as Error).message);
  }
  if (!res.ok) {
    throw new AnchorError("kyc-rejected", `Anchor menolak pemeriksaan status KYC (${res.status}).`);
  }
  const body = (await res.json()) as { status?: string };
  return { id, status: (body.status ?? "PENDING").toUpperCase() as KycStatus };
}

/**
 * Submit SEP-12 KYC fields (`PUT /customer`) authenticated by the SEP-10 `jwt`, then poll once for
 * the resulting status. The caller (the `/verify` UI) re-polls on a timer while `PENDING`/
 * `PROCESSING`. Throws `AnchorError("kyc-not-configured")` if no `KYC_SERVER` is discoverable —
 * the UI treats that as "use the simulated attest path instead," never a hard failure.
 */
export async function submitKyc(account: string, jwt: string, fields: KycFields): Promise<KycResult> {
  const kycServer = await resolveKycServer();
  if (!kycServer) {
    throw new AnchorError("kyc-not-configured", "Anchor ini tidak mempublikasikan KYC_SERVER.");
  }

  let res: Response;
  try {
    res = await fetch(`${normalizeBase(kycServer)}/customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ account, ...fields }),
    });
  } catch (e) {
    throw new AnchorError("network", (e as Error).message);
  }
  if (!res.ok) {
    throw new AnchorError("kyc-rejected", `Anchor menolak pengajuan KYC (${res.status}).`);
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    throw new AnchorError("kyc-rejected", "Anchor tidak mengembalikan id pelanggan.");
  }
  return pollKyc(kycServer, jwt, body.id);
}
