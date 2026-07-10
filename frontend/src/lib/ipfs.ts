/**
 * IPFS image pinning — the one off-chain media hop.
 *
 * On-chain we store only the CID (content hash); the bytes live on IPFS. Default pinner is
 * Pinata (client-side JWT). Under the maximal-purity dial we run no backend of our own, so the
 * upload credential is a **scoped/short-lived** Pinata JWT in a `NEXT_PUBLIC_*` var — client-
 * visible by design, low blast radius, documented in the README.
 *
 * Env (git-ignored `frontend/.env.local`):
 *   NEXT_PUBLIC_IPFS_GATEWAY  e.g. https://gateway.pinata.cloud/ipfs/
 *   NEXT_PUBLIC_PINATA_JWT    a scoped upload JWT (pinFileToIPFS only)
 *
 * Env is read lazily (not at module load) so importing this file never throws during build when
 * IPFS isn't configured — only calling `upload` without a JWT errors, and only at call time.
 */

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/** Public gateway base, always trailing-slash-normalized. Falls back to the Pinata gateway. */
function gatewayBase(): string {
  const raw = process.env.NEXT_PUBLIC_IPFS_GATEWAY || DEFAULT_GATEWAY;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** Strip a leading `ipfs://` (and any `ipfs://ipfs/`) so we hold a bare CID. */
function bareCid(cid: string): string {
  return cid.replace(/^ipfs:\/\/(ipfs\/)?/, "").replace(/^\/+/, "");
}

/**
 * The seed script's stand-in CID (scripts/seed.ts) — a syntactically valid CIDv1 that isn't a
 * real campaign photo. Treated as "no image" so curated local photography renders instead.
 */
const SEED_PLACEHOLDER_CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

/** Resolve an on-chain CID to a browser-loadable gateway URL. Read-only — never throws. */
export function cidToUrl(cid: string): string {
  const c = bareCid(cid.trim());
  if (!c || c === SEED_PLACEHOLDER_CID) return "";
  return c ? `${gatewayBase()}${c}` : "";
}

export class IpfsUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IpfsUploadError";
  }
}

/**
 * Pin a file to IPFS via Pinata and return its CID.
 * Throws {@link IpfsUploadError} on missing config or a non-2xx response so callers can render the
 * error UI state (frontend four-states rule).
 */
export async function upload(file: File): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) {
    throw new IpfsUploadError(
      "IPFS upload not configured: set NEXT_PUBLIC_PINATA_JWT in frontend/.env.local.",
    );
  }

  const body = new FormData();
  body.append("file", file);
  body.append(
    "pinataMetadata",
    JSON.stringify({ name: file.name || "patungan-campaign-image" }),
  );

  let res: Response;
  try {
    res = await fetch(PINATA_PIN_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body,
    });
  } catch (e) {
    throw new IpfsUploadError(
      `IPFS upload failed to reach the pinning service: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new IpfsUploadError(
      `IPFS pin rejected (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const json = (await res.json().catch(() => ({}))) as { IpfsHash?: string };
  const cid = json.IpfsHash?.trim();
  if (!cid) {
    throw new IpfsUploadError("IPFS pin succeeded but returned no CID.");
  }
  return cid;
}
