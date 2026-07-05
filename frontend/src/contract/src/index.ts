import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CB3XHHEHIXV6HHXEB2CSOWMIG3MLPMTT5REZ5GBWYGUH7MX4B3Z6RYUH",
  }
} as const

/**
 * Explicit, off-chain-legible failure variants (prefer `Result<_, Error>` over
 * `panic!`). Discriminants are stable so the frontend can map them to messages.
 */
export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotAdmin"},
  3: {message:"NotVerified"},
  4: {message:"RoundClosed"},
  5: {message:"RoundNotOpen"},
  6: {message:"AlreadyFinalized"},
  7: {message:"NotFinalized"},
  8: {message:"UnknownProject"},
  9: {message:"DuplicateProject"},
  10: {message:"AlreadyDisbursed"},
  11: {message:"InvalidAmount"},
  12: {message:"NothingToMatch"}
}


/**
 * Round-level configuration. `admin` is the operator (Sponsor + Admin); only it
 * may `finalize`/`disburse`/`register_*`. `pool` is the matching pool funded so far.
 */
export interface Config {
  admin: string;
  pool: i128;
  round_end: u64;
  status: RoundStatus;
  token: string;
}

export type DataKey = {tag: "Config", values: void} | {tag: "ProjectIds", values: void} | {tag: "Project", values: readonly [u32]} | {tag: "Donors", values: readonly [u32]} | {tag: "Contribution", values: readonly [u32, string]} | {tag: "Verified", values: readonly [string]};

export type RoundStatus = {tag: "Open", values: void} | {tag: "Finalized", values: void};


/**
 * Full public state of one project. `matched` is 0 until `finalize`; then it is
 * this project's QF share of the pool. `donor_count` counts DISTINCT verified donors.
 */
export interface ProjectState {
  direct: i128;
  disbursed: boolean;
  donor_count: u32;
  emoji: string;
  id: u32;
  matched: i128;
  payout: string;
  title: string;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time setup (§4.3). The first caller authorizes as the operator (`admin`); only
   * that address may later `register_*`/`finalize`/`disburse`. Opens the round with an
   * empty pool and no projects. Re-init is rejected with `AlreadyInitialized` (§4.5).
   */
  init: ({admin, token, round_end}: {admin: string, token: string, round_end: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a disburse transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pay a finalised project out (§4.3). Admin only. Rejects if the round is not yet finalised
   * (`NotFinalized`), the project is unknown (`UnknownProject`), or it was already paid
   * (`AlreadyDisbursed`). Transfers `direct + matched` from the contract escrow to the
   * project's `payout` (reused arisan `token::Client::transfer` idiom, §4.6) and marks it
   * `disbursed` so a re-run is a rejected no-op (§10 idempotency).
   */
  disburse: ({project_id}: {project_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a finalize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Close the round and compute the QF match split (§4.3, §5). Admin only. Rejects a re-run
   * once `status == Finalized` (`AlreadyFinalized`). Computes `matched[]` from the CURRENT
   * state via the same deterministic path `preview_matches` uses (§10), writes each
   * `ProjectState.matched`, and flips `status` to `Finalized`. Pure state transition — no
   * transfers. If nobody has contributed (`total_weight == 0`) the QF math returns
   * `NothingToMatch` (§5.6): the error propagates, the pool stays, and status stays `Open`.
   */
  finalize: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a fund_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit into the matching pool (§4.3). Callable by ANYONE (a real sponsor address can
   * fund) — gated only by `from.require_auth()`. `amount` must be > 0 (`InvalidAmount`) and
   * the round must still be `Open` (`RoundNotOpen`). Escrows the token into the contract
   * (reused arisan `token::Client::transfer` idiom, §4.6) and grows `pool`.
   */
  fund_pool: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a contribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Contribute to a project's direct total (§4.3). `donor.require_auth()`. Rejects when
   * `amount <= 0` (`InvalidAmount`), the round is closed (`RoundClosed`: status != Open, or
   * `now > round_end`), the donor is not in the verified registry (`NotVerified`), or the
   * project is unknown (`UnknownProject`). Escrows the token donor -> contract, then tags the
   * contribution **cumulatively per donor** (§5.2): `Contribution(project_id, donor) +=
   * amount`, and — only when this donor is NEW to this project — appends to `Donors(project_id)`
   * and bumps `donor_count` (the DISTINCT-donor breadth QF rewards). `direct += amount` always.
   */
  contribute: ({donor, project_id, amount}: {donor: string, project_id: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The round config (§4.3): admin, token, round_end, status, pool.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One project's state (§4.3). Panics on an unknown id — the frontend catches the RPC error
   * and renders its not-found state (Epic A3); the frozen `-> ProjectState` return leaves no
   * room for an in-band error.
   */
  get_project: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<ProjectState>>

  /**
   * Construct and simulate a is_verified transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Whether `who` is in the verified-address registry (§4.3). Powers the "✓ Terverifikasi"
   * badge (Epic E1).
   */
  is_verified: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a list_projects transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Full state of every registered project, in registration order (§4.3).
   */
  list_projects: (options?: MethodOptions) => Promise<AssembledTransaction<Array<ProjectState>>>

  /**
   * Construct and simulate a preview_matches transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * LIVE projected QF split on the CURRENT state (§4.3) — lets the UI show the whale-vs-crowd
   * gap before finalise. Runs the exact same computation `finalize` writes, so after finalise
   * it equals the stored `matched[]` (§10 determinism). Before any contribution the QF math
   * yields `NothingToMatch`; since this view can't return an error (frozen `-> Vec<...>`), it
   * surfaces that as an empty vec so the frontend renders "—" for every projected match.
   */
  preview_matches: (options?: MethodOptions) => Promise<AssembledTransaction<Array<readonly [u32, i128]>>>

  /**
   * Construct and simulate a register_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a project (§4.3). Admin only. Rejects a duplicate `id` with
   * `DuplicateProject` (§4.5); otherwise creates zeroed tallies and appends to
   * `ProjectIds` so the frontend can enumerate every project.
   */
  register_project: ({id, payout, title, emoji}: {id: u32, payout: string, title: string, emoji: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a register_verified transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add `who` to the verified-address registry (§4.3). Admin only (gated by
   * `admin.require_auth()`). Idempotent — re-verifying an address is a harmless no-op.
   */
  register_verified: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAPlPbmUtdGltZSBzZXR1cCAowqc0LjMpLiBUaGUgZmlyc3QgY2FsbGVyIGF1dGhvcml6ZXMgYXMgdGhlIG9wZXJhdG9yIChgYWRtaW5gKTsgb25seQp0aGF0IGFkZHJlc3MgbWF5IGxhdGVyIGByZWdpc3Rlcl8qYC9gZmluYWxpemVgL2BkaXNidXJzZWAuIE9wZW5zIHRoZSByb3VuZCB3aXRoIGFuCmVtcHR5IHBvb2wgYW5kIG5vIHByb2plY3RzLiBSZS1pbml0IGlzIHJlamVjdGVkIHdpdGggYEFscmVhZHlJbml0aWFsaXplZGAgKMKnNC41KS4AAAAAAAAEaW5pdAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAlyb3VuZF9lbmQAAAAAAAAGAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAABAAAAJpFeHBsaWNpdCwgb2ZmLWNoYWluLWxlZ2libGUgZmFpbHVyZSB2YXJpYW50cyAocHJlZmVyIGBSZXN1bHQ8XywgRXJyb3I+YCBvdmVyCmBwYW5pYyFgKS4gRGlzY3JpbWluYW50cyBhcmUgc3RhYmxlIHNvIHRoZSBmcm9udGVuZCBjYW4gbWFwIHRoZW0gdG8gbWVzc2FnZXMuAAAAAAAAAAAABUVycm9yAAAAAAAADAAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAhOb3RBZG1pbgAAAAIAAAAAAAAAC05vdFZlcmlmaWVkAAAAAAMAAAAAAAAAC1JvdW5kQ2xvc2VkAAAAAAQAAAAAAAAADFJvdW5kTm90T3BlbgAAAAUAAAAAAAAAEEFscmVhZHlGaW5hbGl6ZWQAAAAGAAAAAAAAAAxOb3RGaW5hbGl6ZWQAAAAHAAAAAAAAAA5Vbmtub3duUHJvamVjdAAAAAAACAAAAAAAAAAQRHVwbGljYXRlUHJvamVjdAAAAAkAAAAAAAAAEEFscmVhZHlEaXNidXJzZWQAAAAKAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAACwAAAAAAAAAOTm90aGluZ1RvTWF0Y2gAAAAAAAw=",
        "AAAAAAAAAZhQYXkgYSBmaW5hbGlzZWQgcHJvamVjdCBvdXQgKMKnNC4zKS4gQWRtaW4gb25seS4gUmVqZWN0cyBpZiB0aGUgcm91bmQgaXMgbm90IHlldCBmaW5hbGlzZWQKKGBOb3RGaW5hbGl6ZWRgKSwgdGhlIHByb2plY3QgaXMgdW5rbm93biAoYFVua25vd25Qcm9qZWN0YCksIG9yIGl0IHdhcyBhbHJlYWR5IHBhaWQKKGBBbHJlYWR5RGlzYnVyc2VkYCkuIFRyYW5zZmVycyBgZGlyZWN0ICsgbWF0Y2hlZGAgZnJvbSB0aGUgY29udHJhY3QgZXNjcm93IHRvIHRoZQpwcm9qZWN0J3MgYHBheW91dGAgKHJldXNlZCBhcmlzYW4gYHRva2VuOjpDbGllbnQ6OnRyYW5zZmVyYCBpZGlvbSwgwqc0LjYpIGFuZCBtYXJrcyBpdApgZGlzYnVyc2VkYCBzbyBhIHJlLXJ1biBpcyBhIHJlamVjdGVkIG5vLW9wICjCpzEwIGlkZW1wb3RlbmN5KS4AAAAIZGlzYnVyc2UAAAABAAAAAAAAAApwcm9qZWN0X2lkAAAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAgFDbG9zZSB0aGUgcm91bmQgYW5kIGNvbXB1dGUgdGhlIFFGIG1hdGNoIHNwbGl0ICjCpzQuMywgwqc1KS4gQWRtaW4gb25seS4gUmVqZWN0cyBhIHJlLXJ1bgpvbmNlIGBzdGF0dXMgPT0gRmluYWxpemVkYCAoYEFscmVhZHlGaW5hbGl6ZWRgKS4gQ29tcHV0ZXMgYG1hdGNoZWRbXWAgZnJvbSB0aGUgQ1VSUkVOVApzdGF0ZSB2aWEgdGhlIHNhbWUgZGV0ZXJtaW5pc3RpYyBwYXRoIGBwcmV2aWV3X21hdGNoZXNgIHVzZXMgKMKnMTApLCB3cml0ZXMgZWFjaApgUHJvamVjdFN0YXRlLm1hdGNoZWRgLCBhbmQgZmxpcHMgYHN0YXR1c2AgdG8gYEZpbmFsaXplZGAuIFB1cmUgc3RhdGUgdHJhbnNpdGlvbiDigJQgbm8KdHJhbnNmZXJzLiBJZiBub2JvZHkgaGFzIGNvbnRyaWJ1dGVkIChgdG90YWxfd2VpZ2h0ID09IDBgKSB0aGUgUUYgbWF0aCByZXR1cm5zCmBOb3RoaW5nVG9NYXRjaGAgKMKnNS42KTogdGhlIGVycm9yIHByb3BhZ2F0ZXMsIHRoZSBwb29sIHN0YXlzLCBhbmQgc3RhdHVzIHN0YXlzIGBPcGVuYC4AAAAAAAAIZmluYWxpemUAAAAAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAQAAAKBSb3VuZC1sZXZlbCBjb25maWd1cmF0aW9uLiBgYWRtaW5gIGlzIHRoZSBvcGVyYXRvciAoU3BvbnNvciArIEFkbWluKTsgb25seSBpdAptYXkgYGZpbmFsaXplYC9gZGlzYnVyc2VgL2ByZWdpc3Rlcl8qYC4gYHBvb2xgIGlzIHRoZSBtYXRjaGluZyBwb29sIGZ1bmRlZCBzbyBmYXIuAAAAAAAAAAZDb25maWcAAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAEcG9vbAAAAAsAAAAAAAAACXJvdW5kX2VuZAAAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtSb3VuZFN0YXR1cwAAAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAAAAAU5EZXBvc2l0IGludG8gdGhlIG1hdGNoaW5nIHBvb2wgKMKnNC4zKS4gQ2FsbGFibGUgYnkgQU5ZT05FIChhIHJlYWwgc3BvbnNvciBhZGRyZXNzIGNhbgpmdW5kKSDigJQgZ2F0ZWQgb25seSBieSBgZnJvbS5yZXF1aXJlX2F1dGgoKWAuIGBhbW91bnRgIG11c3QgYmUgPiAwIChgSW52YWxpZEFtb3VudGApIGFuZAp0aGUgcm91bmQgbXVzdCBzdGlsbCBiZSBgT3BlbmAgKGBSb3VuZE5vdE9wZW5gKS4gRXNjcm93cyB0aGUgdG9rZW4gaW50byB0aGUgY29udHJhY3QKKHJldXNlZCBhcmlzYW4gYHRva2VuOjpDbGllbnQ6OnRyYW5zZmVyYCBpZGlvbSwgwqc0LjYpIGFuZCBncm93cyBgcG9vbGAuAAAAAAAJZnVuZF9wb29sAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAAAAAAAAAAAKUHJvamVjdElkcwAAAAAAAQAAAAAAAAAHUHJvamVjdAAAAAABAAAABAAAAAEAAAAAAAAABkRvbm9ycwAAAAAAAQAAAAQAAAABAAAAAAAAAAxDb250cmlidXRpb24AAAACAAAABAAAABMAAAABAAAAAAAAAAhWZXJpZmllZAAAAAEAAAAT",
        "AAAAAAAAAm5Db250cmlidXRlIHRvIGEgcHJvamVjdCdzIGRpcmVjdCB0b3RhbCAowqc0LjMpLiBgZG9ub3IucmVxdWlyZV9hdXRoKClgLiBSZWplY3RzIHdoZW4KYGFtb3VudCA8PSAwYCAoYEludmFsaWRBbW91bnRgKSwgdGhlIHJvdW5kIGlzIGNsb3NlZCAoYFJvdW5kQ2xvc2VkYDogc3RhdHVzICE9IE9wZW4sIG9yCmBub3cgPiByb3VuZF9lbmRgKSwgdGhlIGRvbm9yIGlzIG5vdCBpbiB0aGUgdmVyaWZpZWQgcmVnaXN0cnkgKGBOb3RWZXJpZmllZGApLCBvciB0aGUKcHJvamVjdCBpcyB1bmtub3duIChgVW5rbm93blByb2plY3RgKS4gRXNjcm93cyB0aGUgdG9rZW4gZG9ub3IgLT4gY29udHJhY3QsIHRoZW4gdGFncyB0aGUKY29udHJpYnV0aW9uICoqY3VtdWxhdGl2ZWx5IHBlciBkb25vcioqICjCpzUuMik6IGBDb250cmlidXRpb24ocHJvamVjdF9pZCwgZG9ub3IpICs9CmFtb3VudGAsIGFuZCDigJQgb25seSB3aGVuIHRoaXMgZG9ub3IgaXMgTkVXIHRvIHRoaXMgcHJvamVjdCDigJQgYXBwZW5kcyB0byBgRG9ub3JzKHByb2plY3RfaWQpYAphbmQgYnVtcHMgYGRvbm9yX2NvdW50YCAodGhlIERJU1RJTkNULWRvbm9yIGJyZWFkdGggUUYgcmV3YXJkcykuIGBkaXJlY3QgKz0gYW1vdW50YCBhbHdheXMuAAAAAAAKY29udHJpYnV0ZQAAAAAAAwAAAAAAAAAFZG9ub3IAAAAAAAATAAAAAAAAAApwcm9qZWN0X2lkAAAAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAEBUaGUgcm91bmQgY29uZmlnICjCpzQuMyk6IGFkbWluLCB0b2tlbiwgcm91bmRfZW5kLCBzdGF0dXMsIHBvb2wuAAAACmdldF9jb25maWcAAAAAAAAAAAABAAAH0AAAAAZDb25maWcAAA==",
        "AAAAAAAAAM9PbmUgcHJvamVjdCdzIHN0YXRlICjCpzQuMykuIFBhbmljcyBvbiBhbiB1bmtub3duIGlkIOKAlCB0aGUgZnJvbnRlbmQgY2F0Y2hlcyB0aGUgUlBDIGVycm9yCmFuZCByZW5kZXJzIGl0cyBub3QtZm91bmQgc3RhdGUgKEVwaWMgQTMpOyB0aGUgZnJvemVuIGAtPiBQcm9qZWN0U3RhdGVgIHJldHVybiBsZWF2ZXMgbm8Kcm9vbSBmb3IgYW4gaW4tYmFuZCBlcnJvci4AAAAAC2dldF9wcm9qZWN0AAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAB9AAAAAMUHJvamVjdFN0YXRl",
        "AAAAAAAAAGpXaGV0aGVyIGB3aG9gIGlzIGluIHRoZSB2ZXJpZmllZC1hZGRyZXNzIHJlZ2lzdHJ5ICjCpzQuMykuIFBvd2VycyB0aGUgIuKckyBUZXJ2ZXJpZmlrYXNpIgpiYWRnZSAoRXBpYyBFMSkuAAAAAAALaXNfdmVyaWZpZWQAAAAAAQAAAAAAAAADd2hvAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAEZGdWxsIHN0YXRlIG9mIGV2ZXJ5IHJlZ2lzdGVyZWQgcHJvamVjdCwgaW4gcmVnaXN0cmF0aW9uIG9yZGVyICjCpzQuMykuAAAAAAANbGlzdF9wcm9qZWN0cwAAAAAAAAAAAAABAAAD6gAAB9AAAAAMUHJvamVjdFN0YXRl",
        "AAAAAgAAAAAAAAAAAAAAC1JvdW5kU3RhdHVzAAAAAAIAAAAAAAAAAAAAAARPcGVuAAAAAAAAAAAAAAAJRmluYWxpemVkAAAA",
        "AAAAAQAAAKFGdWxsIHB1YmxpYyBzdGF0ZSBvZiBvbmUgcHJvamVjdC4gYG1hdGNoZWRgIGlzIDAgdW50aWwgYGZpbmFsaXplYDsgdGhlbiBpdCBpcwp0aGlzIHByb2plY3QncyBRRiBzaGFyZSBvZiB0aGUgcG9vbC4gYGRvbm9yX2NvdW50YCBjb3VudHMgRElTVElOQ1QgdmVyaWZpZWQgZG9ub3JzLgAAAAAAAAAAAAAMUHJvamVjdFN0YXRlAAAACAAAAAAAAAAGZGlyZWN0AAAAAAALAAAAAAAAAAlkaXNidXJzZWQAAAAAAAABAAAAAAAAAAtkb25vcl9jb3VudAAAAAAEAAAAAAAAAAVlbW9qaQAAAAAAABAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAdtYXRjaGVkAAAAAAsAAAAAAAAABnBheW91dAAAAAAAEwAAAAAAAAAFdGl0bGUAAAAAAAAQ",
        "AAAAAAAAAcBMSVZFIHByb2plY3RlZCBRRiBzcGxpdCBvbiB0aGUgQ1VSUkVOVCBzdGF0ZSAowqc0LjMpIOKAlCBsZXRzIHRoZSBVSSBzaG93IHRoZSB3aGFsZS12cy1jcm93ZApnYXAgYmVmb3JlIGZpbmFsaXNlLiBSdW5zIHRoZSBleGFjdCBzYW1lIGNvbXB1dGF0aW9uIGBmaW5hbGl6ZWAgd3JpdGVzLCBzbyBhZnRlciBmaW5hbGlzZQppdCBlcXVhbHMgdGhlIHN0b3JlZCBgbWF0Y2hlZFtdYCAowqcxMCBkZXRlcm1pbmlzbSkuIEJlZm9yZSBhbnkgY29udHJpYnV0aW9uIHRoZSBRRiBtYXRoCnlpZWxkcyBgTm90aGluZ1RvTWF0Y2hgOyBzaW5jZSB0aGlzIHZpZXcgY2FuJ3QgcmV0dXJuIGFuIGVycm9yIChmcm96ZW4gYC0+IFZlYzwuLi4+YCksIGl0CnN1cmZhY2VzIHRoYXQgYXMgYW4gZW1wdHkgdmVjIHNvIHRoZSBmcm9udGVuZCByZW5kZXJzICLigJQiIGZvciBldmVyeSBwcm9qZWN0ZWQgbWF0Y2guAAAAD3ByZXZpZXdfbWF0Y2hlcwAAAAAAAAAAAQAAA+oAAAPtAAAAAgAAAAQAAAAL",
        "AAAAAAAAAMtSZWdpc3RlciBhIHByb2plY3QgKMKnNC4zKS4gQWRtaW4gb25seS4gUmVqZWN0cyBhIGR1cGxpY2F0ZSBgaWRgIHdpdGgKYER1cGxpY2F0ZVByb2plY3RgICjCpzQuNSk7IG90aGVyd2lzZSBjcmVhdGVzIHplcm9lZCB0YWxsaWVzIGFuZCBhcHBlbmRzIHRvCmBQcm9qZWN0SWRzYCBzbyB0aGUgZnJvbnRlbmQgY2FuIGVudW1lcmF0ZSBldmVyeSBwcm9qZWN0LgAAAAAQcmVnaXN0ZXJfcHJvamVjdAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAZwYXlvdXQAAAAAABMAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAFZW1vamkAAAAAAAAQAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAJ1BZGQgYHdob2AgdG8gdGhlIHZlcmlmaWVkLWFkZHJlc3MgcmVnaXN0cnkgKMKnNC4zKS4gQWRtaW4gb25seSAoZ2F0ZWQgYnkKYGFkbWluLnJlcXVpcmVfYXV0aCgpYCkuIElkZW1wb3RlbnQg4oCUIHJlLXZlcmlmeWluZyBhbiBhZGRyZXNzIGlzIGEgaGFybWxlc3Mgbm8tb3AuAAAAAAAAEXJlZ2lzdGVyX3ZlcmlmaWVkAAAAAAAAAQAAAAAAAAADd2hvAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>,
        disburse: this.txFromJSON<Result<void>>,
        finalize: this.txFromJSON<Result<void>>,
        fund_pool: this.txFromJSON<Result<void>>,
        contribute: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Config>,
        get_project: this.txFromJSON<ProjectState>,
        is_verified: this.txFromJSON<boolean>,
        list_projects: this.txFromJSON<Array<ProjectState>>,
        preview_matches: this.txFromJSON<Array<readonly [u32, i128]>>,
        register_project: this.txFromJSON<Result<void>>,
        register_verified: this.txFromJSON<Result<void>>
  }
}