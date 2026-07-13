"use client";

import { Address, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import { config } from "./config";

/**
 * One reconstructed `contrib` event: a single direct donation this wallet signed. The contract
 * publishes `(symbol "contrib", project_id, donor) -> amount` (lib.rs), so the topic carries the
 * campaign and the value carries the gift — no backend, the chain's own event log is the ledger.
 */
export interface Contribution {
  projectId: number;
  amount: bigint;
  ledger: number;
  /** RFC3339 close time of the ledger the gift landed in — the "when" of each row. */
  at: string;
  txHash: string;
}

// Topic symbols, XDR-encoded once — the getEvents filter matches on exact topic XDR.
const CONTRIB_TOPIC = nativeToScVal("contrib", { type: "symbol" }).toXDR("base64");
// The `payout` topic symbol — matches `symbol_short!("payout")` on-chain (lib.rs).
const PAYOUT_TOPIC = nativeToScVal("payout", { type: "symbol" }).toXDR("base64");

type EventFilters = Parameters<Server["getEvents"]>[0]["filters"];
type RawEvent = Awaited<ReturnType<Server["getEvents"]>>["events"][number];

function makeServer(): Server {
  return new Server(config.sorobanRpcUrl, {
    allowHttp: config.sorobanRpcUrl.startsWith("http://"),
  });
}

/**
 * Scan every contract event matching `filters` across the node's whole retention window (caller
 * decodes + sorts). The subtlety that makes this correct: getEvents caps how many ledgers it scans
 * per call (~10k) and returns a cursor **even for an empty page**, so a sparse window — a handful of
 * events spread across days — looks empty unless you follow the cursor to the tip. We must NOT stop
 * on a short/empty page (the classic bug); instead we page until the cursor reaches the latest
 * ledger. The cursor is a TOID whose high 32 bits are the ledger sequence. Events older than the
 * retention floor are unrecoverable by design (testnet RPC prunes) — an honest limit of the pure,
 * backend-free reconstruction.
 */
async function scanEvents(server: Server, filters: EventFilters): Promise<RawEvent[]> {
  const latest = (await server.getLatestLedger()).sequence;
  // Probe the newest ledger only to read the retention floor back off the response; the +1 keeps the
  // first scan's startLedger inside the window even as the floor slides forward between calls.
  const probe = await server.getEvents({ filters, startLedger: latest, limit: 1 });
  const startLedger = Math.max(probe.oldestLedger + 1, 1);

  const events: RawEvent[] = [];
  let cursor: string | undefined;
  // ~10k ledgers/page over a ~7-day (~120k-ledger) window is ~13 pages; 60 is a generous safety cap.
  for (let page = 0; page < 60; page++) {
    const res = cursor
      ? await server.getEvents({ filters, cursor, limit: 100 })
      : await server.getEvents({ filters, startLedger, limit: 100 });
    events.push(...res.events);
    if (!res.cursor) break;
    // Stop once the cursor has paged past the tip — otherwise empty pages burn the whole cap.
    const cursorLedger = Number(BigInt(res.cursor.split("-")[0]) >> 32n);
    if (cursorLedger >= res.latestLedger) break;
    cursor = res.cursor;
  }
  return events;
}

/**
 * Reconstruct every direct contribution `donor` has made, newest first, from the contract's
 * `contrib` events over Soroban RPC — the "no backend, events are the source" account history. The
 * donor is a topic, so the RPC filters server-side to just this wallet.
 */
export async function fetchContributions(donor: string): Promise<Contribution[]> {
  const donorTopic = Address.fromString(donor).toScVal().toXDR("base64");
  const events = await scanEvents(makeServer(), [
    {
      type: "contract",
      contractIds: [config.contractId],
      topics: [[CONTRIB_TOPIC, "*", donorTopic]],
    },
  ]);

  return events
    .map((e) => ({
      projectId: Number(scValToNative(e.topic[1])),
      amount: BigInt(scValToNative(e.value) as bigint | number),
      ledger: e.ledger,
      at: e.ledgerClosedAt,
      txHash: e.txHash,
    }))
    // Newest gift first — the account reads top-to-bottom like a bank statement.
    .sort((a, b) => b.ledger - a.ledger);
}

/**
 * One reconstructed event in a campaign's public money trail — either a donation landing in the
 * contract (`contrib`) or a payout leaving escrow to the owner's payout address (`payout`). The
 * two halves are what let a donor watch a gift go *in* and then watch it settle *out* to the owner.
 */
export type CampaignActivity =
  | {
      kind: "contrib";
      donor: string;
      amount: bigint;
      ledger: number;
      at: string;
      txHash: string;
    }
  | {
      kind: "payout";
      /** The round this payout settled (`claim`), or null for a direct payout (`claim_unmatched`). */
      roundId: number | null;
      amount: bigint;
      ledger: number;
      at: string;
      txHash: string;
    };

/**
 * Reconstruct one campaign's full public money trail, newest first — the interactive activity feed
 * on `/campaign/[id]`. Unlike a contrib-only backer list, this merges both directions: `contrib`
 * events (donations in) and `payout` events (funds released to the owner via `claim` /
 * `claim_unmatched`). A single scan matches all three topic shapes with OR semantics, so the "money
 * in" and "money out to owner" halves come back together. The `payout` topic is `(round_id,
 * project_id)` for a round settlement and `(project_id)` for a direct payout — we key off the topic
 * length to tell them apart. The same RPC retention limit applies as elsewhere: events older than
 * the node's window are unrecoverable by design (an honest limit of the backend-free reconstruction).
 */
export async function fetchCampaignActivity(projectId: number): Promise<CampaignActivity[]> {
  const projectTopic = nativeToScVal(projectId, { type: "u32" }).toXDR("base64");
  const events = await scanEvents(makeServer(), [
    {
      type: "contract",
      contractIds: [config.contractId],
      topics: [
        // contrib(project_id, donor) -> amount   ·  a donation landing in escrow
        [CONTRIB_TOPIC, projectTopic, "*"],
        // payout(round_id, project_id) -> amount  ·  a round settlement to the owner
        [PAYOUT_TOPIC, "*", projectTopic],
        // payout(project_id) -> amount            ·  a direct (unmatched) payout to the owner
        [PAYOUT_TOPIC, projectTopic],
      ],
    },
  ]);

  return events
    .map((e): CampaignActivity => {
      const amount = BigInt(scValToNative(e.value) as bigint | number);
      if (String(scValToNative(e.topic[0])) === "contrib") {
        return {
          kind: "contrib",
          donor: String(scValToNative(e.topic[2])),
          amount,
          ledger: e.ledger,
          at: e.ledgerClosedAt,
          txHash: e.txHash,
        };
      }
      return {
        kind: "payout",
        // 3 topics = round settlement (topic[1] = round_id); 2 topics = direct payout.
        roundId: e.topic.length === 3 ? Number(scValToNative(e.topic[1])) : null,
        amount,
        ledger: e.ledger,
        at: e.ledgerClosedAt,
        txHash: e.txHash,
      };
    })
    .sort((a, b) => b.ledger - a.ledger);
}
