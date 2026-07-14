import type { NextRequest } from "next/server";

/**
 * Same-origin anchor proxy. SEP-1/SEP-12 don't mandate CORS, and the SDF reference anchor omits it on
 * `stellar.toml` and `/sep12` — so a browser fetch is blocked (only `/auth` is CORS-open). This route
 * fetches the anchor server-side (no CORS) and re-serves the response same-origin, so `anchor.ts` can
 * run the full SEP-10 + SEP-12 flow from the browser.
 *
 * Not an open proxy: the `url` target is validated against `NEXT_PUBLIC_ANCHOR_HOME_DOMAIN` and must be
 * https on that exact host. Only the auth/content/accept headers (and body) are forwarded; the JWT in
 * `Authorization` is meant for the anchor and passes straight through.
 */

const ANCHOR_HOME =
  process.env.NEXT_PUBLIC_ANCHOR_HOME_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") ||
  null;

function isAllowed(target: string): boolean {
  if (!ANCHOR_HOME) return false;
  try {
    const u = new URL(target);
    return u.protocol === "https:" && u.host === ANCHOR_HOME;
  } catch {
    return false;
  }
}

async function forward(req: NextRequest): Promise<Response> {
  const target = req.nextUrl.searchParams.get("url");
  if (!target || !isAllowed(target)) {
    return Response.json({ error: "invalid or disallowed anchor target" }, { status: 400 });
  }

  // Forward only the headers the anchor needs. Deliberately NOT `Accept`: the SDF reference anchor's
  // `stellar.toml` returns 406 for `Accept: text/plain` (a content-negotiation quirk), and every anchor
  // endpoint responds correctly to the default `*/*`, so dropping it is both safe and more robust.
  const headers: Record<string, string> = {};
  for (const h of ["authorization", "content-type"]) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return Response.json({ error: `anchor unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "text/plain" },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
