import type { NextRequest } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Tier } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { config } from "@/lib/config";

/**
 * Automated attester service (the "issuer" in a real anchor pipeline). After a wallet passes SEP-10 +
 * SEP-12, the browser POSTs its anchor JWT here and the server writes the on-chain verification tier —
 * modelling how a licensed anchor issues the credential once KYC clears. No human operator on the
 * happy path; the operator console stays as a manual break-glass fallback.
 *
 * SECURITY MODEL — the reason this is safe:
 *  - The account to attest comes from the JWT's `sub`, NEVER from client-supplied input. The worst a
 *    caller can do is attest the wallet their own JWT is bound to. Sybil-granting arbitrary addresses
 *    is structurally impossible.
 *  - KYC is re-confirmed against the anchor with that same JWT. The anchor validates the JWT's
 *    signature, so a forged token fails the re-check — we don't have to verify it ourselves.
 *  - The attester secret lives ONLY in server env (`ATTESTER_SECRET`, never `NEXT_PUBLIC_`). In
 *    production it moves behind a KMS/HSM signing service — same code seam, key never in process.
 *  - The key is least-privilege: it can only grant tiers, not move funds or admin the contract. We
 *    also assert it matches the on-chain verifier role before using it.
 */

export const runtime = "nodejs";

const ANCHOR_HOME =
  process.env.NEXT_PUBLIC_ANCHOR_HOME_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") ||
  null;
const ATTESTER_SECRET = process.env.ATTESTER_SECRET?.trim() || null;
const STELLAR_ADDR = /^G[A-Z2-7]{55}$/;

function scrapeToml(toml: string, key: string): string | null {
  const m = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m"));
  return m ? m[1] : null;
}

/**
 * SEP-10 JWT `sub` is the authenticated account (optionally `G...:memo`). Decode-only — we never
 * trust it on its own; the anchor KYC re-check below is what authenticates the token.
 */
function accountFromJwt(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const sub = (JSON.parse(json) as { sub?: string }).sub;
    const account = typeof sub === "string" ? sub.split(":")[0] : null;
    return account && STELLAR_ADDR.test(account) ? account : null;
  } catch {
    return null;
  }
}

/** Discover the anchor's SEP-12 server from its toml (server-side — no CORS to worry about). */
async function resolveKycServer(): Promise<string | null> {
  if (!ANCHOR_HOME) return null;
  const res = await fetch(`https://${ANCHOR_HOME}/.well-known/stellar.toml`);
  if (!res.ok) return null;
  const toml = await res.text();
  return scrapeToml(toml, "KYC_SERVER") ?? scrapeToml(toml, "TRANSFER_SERVER_SEP0012");
}

async function kycIsAccepted(kycServer: string, account: string, jwt: string): Promise<boolean> {
  const url = new URL(`${kycServer.replace(/\/+$/, "")}/customer`);
  url.searchParams.set("account", account);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return false;
  const body = (await res.json()) as { status?: string };
  return (body.status ?? "").toUpperCase() === "ACCEPTED";
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!ATTESTER_SECRET) {
    return Response.json({ error: "Attester service is not configured on the server." }, { status: 500 });
  }

  const authz = req.headers.get("authorization") ?? "";
  const jwt = /^bearer /i.test(authz) ? authz.slice(7).trim() : "";
  if (!jwt) return Response.json({ error: "Missing bearer token." }, { status: 401 });

  const account = accountFromJwt(jwt);
  if (!account) return Response.json({ error: "Invalid token subject." }, { status: 401 });

  // 1 · Re-confirm KYC at the anchor (this also validates the JWT signature, server-side).
  let kycServer: string | null;
  try {
    kycServer = await resolveKycServer();
  } catch {
    kycServer = null;
  }
  if (!kycServer) {
    return Response.json({ error: "Anchor KYC server is not discoverable." }, { status: 502 });
  }
  const accepted = await kycIsAccepted(kycServer, account, jwt).catch(() => false);
  if (!accepted) {
    return Response.json({ error: "The anchor has not accepted this wallet's KYC." }, { status: 403 });
  }

  // 2 · Load the attester key and guard it matches the on-chain verifier role.
  let kp: Keypair;
  try {
    kp = Keypair.fromSecret(ATTESTER_SECRET);
  } catch {
    return Response.json({ error: "Attester secret is malformed." }, { status: 500 });
  }
  const cfg = (await contractClient.get_config()).result;
  if (cfg.attester !== kp.publicKey()) {
    return Response.json(
      { error: "Server attester key does not match the on-chain verifier role." },
      { status: 500 },
    );
  }

  // 3 · Idempotency — already verified? Nothing to write.
  const current = (await contractClient.verification_tier({ who: account })).result;
  if (current >= Tier.Basic) {
    return Response.json({ ok: true, account, tier: Tier[current], alreadyVerified: true });
  }

  // 4 · Attest Basic, signed server-side by the attester key (source-account auth, like the console).
  try {
    const signer = basicNodeSigner(kp, config.networkPassphrase);
    const tx = await contractClient.set_verification(
      { who: account, tier: Tier.Basic },
      { publicKey: kp.publicKey() },
    );
    const sent = await tx.signAndSend({ signTransaction: signer.signTransaction });
    if (sent.result.isErr()) {
      return Response.json({ error: "On-chain attestation was rejected." }, { status: 502 });
    }
    return Response.json({
      ok: true,
      account,
      tier: "Basic",
      hash: sent.sendTransactionResponse?.hash ?? null,
    });
  } catch (e) {
    return Response.json({ error: `Attestation failed: ${(e as Error).message}` }, { status: 502 });
  }
}
