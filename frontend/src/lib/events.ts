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

// The `contrib` topic symbol, XDR-encoded once — the getEvents filter matches on exact topic XDR.
const CONTRIB_TOPIC = nativeToScVal("contrib", { type: "symbol" }).toXDR("base64");

/**
 * Reconstruct every direct contribution `donor` has made, newest first, from the contract's
 * `contrib` events over Soroban RPC (`getEvents`) — the "no backend, events are the source"
 * account history. The donor is a topic, so the RPC filters server-side to just this wallet.
 *
 * getEvents needs a `startLedger` inside the node's retention window; we probe the latest ledger
 * to learn the retention floor (`oldestLedger`), then scan the whole retained window forward with
 * cursor pagination. Gifts older than the node's retention are unrecoverable by design (testnet
 * RPC prunes) — an honest limit of the pure, backend-free reconstruction.
 */
export async function fetchContributions(donor: string): Promise<Contribution[]> {
  const server = new Server(config.sorobanRpcUrl, {
    allowHttp: config.sorobanRpcUrl.startsWith("http://"),
  });

  const donorTopic = Address.fromString(donor).toScVal().toXDR("base64");
  const filters = [
    {
      type: "contract" as const,
      contractIds: [config.contractId],
      topics: [[CONTRIB_TOPIC, "*", donorTopic]],
    },
  ];

  const latest = (await server.getLatestLedger()).sequence;
  // Probe the newest ledger only to read the retention floor back off the response.
  const probe = await server.getEvents({ filters, startLedger: latest, limit: 1 });
  const startLedger = Math.max(probe.oldestLedger, 1);

  const out: Contribution[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 30; page++) {
    const res = cursor
      ? await server.getEvents({ filters, cursor, limit: 100 })
      : await server.getEvents({ filters, startLedger, limit: 100 });
    for (const e of res.events) {
      out.push({
        projectId: Number(scValToNative(e.topic[1])),
        amount: BigInt(scValToNative(e.value) as bigint | number),
        ledger: e.ledger,
        at: e.ledgerClosedAt,
        txHash: e.txHash,
      });
    }
    if (res.events.length < 100) break;
    cursor = res.cursor;
  }

  // Newest gift first — the account reads top-to-bottom like a bank statement.
  return out.sort((a, b) => b.ledger - a.ledger);
}
