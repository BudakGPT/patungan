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
    contractId: "CBXIWGXBR5SZWT65N4EAXXSRHH54YYYDGTZNOOUB5NRJ4HZJXIQUR3ZN",
  }
} as const

/**
 * The on-chain verification attestation — the *only* KYC state the contract sees (the PII lives
 * off-chain in the anchor). Ordered so `Basic < Institution`: contributors need `≥ Basic`, pool
 * funders need `Institution`.
 */
export enum Tier {
  None = 0,
  Basic = 1,
  Institution = 2,
}

/**
 * Explicit, off-chain-legible failure variants (prefer `Result<_, Error>` over `panic!`).
 * Discriminants are **stable** — the frontend maps them to Bahasa messages. Note:
 * `RoundNotOpen`/`RoundClosed` are reused at 4/5, so the 18/19 slots are intentionally left as
 * gaps rather than duplicated.
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
  12: {message:"NothingToMatch"},
  13: {message:"NotCurator"},
  14: {message:"ProjectNotApproved"},
  15: {message:"ProjectNotPending"},
  16: {message:"AlreadyClaimed"},
  17: {message:"UnknownRound"},
  20: {message:"RoundAlreadyOpen"},
  21: {message:"CategoryNotInRound"},
  22: {message:"TierTooLow"},
  23: {message:"NothingToClaim"},
  24: {message:"NotOwner"},
  25: {message:"NotAttester"},
  26: {message:"InvalidCid"},
  27: {message:"InvalidTitle"}
}


/**
 * The global role/token config, composed from the instance keys for the `get_config` view
 * so the frontend reads admin/curator/attester/token in one call.
 */
export interface Config {
  admin: string;
  attester: string;
  curator: string;
  token: string;
}

/**
 * Storage class: the global scalars/lists (`Admin/Curator/Attester/Token/NextRoundId/
 * NextProjectId/RoundIds`) live in **instance**; everything project/round/donor-scoped — plus the
 * unbounded `ProjectIds` set — lives in **persistent** so it never bloats the instance entry.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "Curator", values: void} | {tag: "Attester", values: void} | {tag: "Token", values: void} | {tag: "NextRoundId", values: void} | {tag: "NextProjectId", values: void} | {tag: "RoundIds", values: void} | {tag: "ProjectIds", values: void} | {tag: "Project", values: readonly [u32]} | {tag: "Round", values: readonly [u32]} | {tag: "RoundContribution", values: readonly [u32, u32, string]} | {tag: "RoundDirect", values: readonly [u32, u32]} | {tag: "RoundDonorCount", values: readonly [u32, u32]} | {tag: "RoundSumSqrt", values: readonly [u32, u32]} | {tag: "RoundMatched", values: readonly [u32, u32]} | {tag: "RoundClaimed", values: readonly [u32, u32]} | {tag: "Verification", values: readonly [string]};

/**
 * The curated, extensible set of social-impact categories a campaign belongs to. **Append
 * variants only, never renumber** — the frontend and generated bindings map them by position.
 */
export type Category = {tag: "DevelopingRegions", values: void} | {tag: "DisasterRelief", values: void} | {tag: "EducationHealth", values: void};


/**
 * Full public state of one matching round. `categories` scopes which campaigns the round matches;
 * an **empty** vec means all categories. `pool` is the sponsor-funded matching pool for this
 * round only.
 */
export interface RoundState {
  categories: Array<Category>;
  id: u32;
  pool: i128;
  round_end: u64;
  sponsor: string;
  status: RoundStatus;
}

/**
 * Lifecycle of one matching round ("season"). **Invariant: at most one `Open` round at a time**
 * (a single clean QF snapshot). `Cancelled` is a pre-finalize refund path.
 */
export type RoundStatus = {tag: "Open", values: void} | {tag: "Finalized", values: void} | {tag: "Cancelled", values: void};


/**
 * Full public state of one campaign — continuous and global (not scoped to a round). Direct
 * donations are always-open; `lifetime_direct` is every contribution ever, while
 * `unrounded_direct` is the slice given while no in-scope round was open (claimable via
 * `claim_unmatched`). Per-round tallies live in the `Round*` keys, not here.
 */
export interface ProjectState {
  category: Category;
  created_ledger: u64;
  id: u32;
  image_cid: string;
  lifetime_direct: i128;
  owner: string;
  payout: string;
  status: ProjectStatus;
  story: string;
  title: string;
  unrounded_direct: i128;
}

/**
 * Curation state of a campaign. Only `Approved` campaigns are contributable and matchable;
 * discovery hides everything else (the owner still sees their own via the dashboard).
 */
export type ProjectStatus = {tag: "Pending", values: void} | {tag: "Approved", values: void} | {tag: "Rejected", values: void} | {tag: "Cancelled", values: void};

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time bootstrap: fix the `admin` (round + curation authority), the escrow `token`, the
   * `attester` (KYC-tier writer — the anchor's key in prod, the operator on testnet), and the
   * `curator` (campaign approver). Re-`init` ⇒ `AlreadyInitialized`.
   */
  init: ({admin, token, attester, curator}: {admin: string, token: string, attester: string, curator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pay a finalized round's `RoundDirect + RoundMatched` for one campaign to its `payout`
   * address. Authorized by the campaign **owner**. Round must be `Finalized` (`NotFinalized`);
   * not already claimed (`AlreadyClaimed`). Sets `RoundClaimed`, emits `("payout", r, p)`.
   */
  claim: ({round_id, project_id}: {round_id: u32, project_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a bump_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Keep-alive for a campaign's hot persistent entries. **Anyone** may call it — extending
   * TTL is neutral upkeep, not a privileged write — so a long-lived campaign never expires
   * mid-round even between contributions. Extends the campaign entry and, when a round is open,
   * that campaign's per-round aggregate entries too (guarded by `has` so absent keys are skipped,
   * never panicking). `UnknownProject` on an unknown id.
   */
  bump_ttl: ({project_id}: {project_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a fund_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fund an `Open` round's matching pool. `from` must authorize, give `amount > 0`, and hold the
   * `Institution` tier (`TierTooLow`) — pool funders are the KYC-heavy role. Escrows the
   * tokens into the contract and grows `round.pool`. Emit `("fund", round_id, from)`.
   */
  fund_pool: ({from, round_id, amount}: {from: string, round_id: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One round by id (panics on unknown id — callers use ids from `list_rounds`).
   */
  get_round: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<RoundState>>

  /**
   * Construct and simulate a contribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Donate directly to an `Approved` campaign. Continuous (always-open): every gift grows
   * `lifetime_direct`. If a round is `Open` **and** the campaign's category is in scope, the gift
   * also feeds that round's QF aggregates (per-round cumulative-sqrt, keyed `(round, project)`);
   * otherwise it grows `unrounded_direct`, claimable via `claim_unmatched`.
   * `donor` must be `≥ Basic` (`TierTooLow`); target must be `Approved` (`ProjectNotApproved`).
   */
  contribute: ({donor, project_id, amount}: {donor: string, project_id: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The global role/token config in one call.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a open_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Open a new matching round ("season"). **Admin only.** Enforces the **at-most-one-open**
   * invariant (`RoundAlreadyOpen`) so QF settles over one clean snapshot. `sponsor` is recorded
   * metadata (the institution the pool is credited to); `categories` scopes which campaigns the
   * round matches (EMPTY = all). Assigns `NextRoundId++`, `pool = 0`, status `Open`; appends to
   * `RoundIds`. Emit `("roundopen", id)`.
   */
  open_round: ({sponsor, round_end, categories}: {sponsor: string, round_end: u64, categories: Array<Category>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a get_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One campaign by id (panics on unknown id — callers use ids from `list_projects`).
   */
  get_project: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<ProjectState>>

  /**
   * Construct and simulate a list_rounds transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * All rounds, in creation order.
   */
  list_rounds: (options?: MethodOptions) => Promise<AssembledTransaction<Array<RoundState>>>

  /**
   * Construct and simulate a set_curator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rotate the curator (admin only).
   */
  set_curator: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel an `Open` round pre-finalize. **Admin only.** Refunds `round.pool` to the sponsor and
   * **rolls each `RoundDirect(r,p)` into that campaign's `unrounded_direct`** — donors meant to
   * fund the campaign regardless of the match, so campaigns keep their direct gifts; only the
   * match pool refunds. Zeroes `pool`, status `Cancelled`. Emits `("rndcancel", r)`.
   */
  cancel_round: ({round_id}: {round_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rotate the attester (admin only) — the pluggable-verifier seam: swapping the anchor swaps
   * who holds this key, not the code.
   */
  set_attester: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a list_projects transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * **All** campaigns regardless of status — the frontend filters for discovery vs. the owner
   * dashboard.
   */
  list_projects: (options?: MethodOptions) => Promise<AssembledTransaction<Array<ProjectState>>>

  /**
   * Construct and simulate a open_round_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The id of the single currently-`Open` round, if any.
   */
  open_round_id: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

  /**
   * Construct and simulate a preview_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only projection of a round's QF split — the same deterministic computation as
   * `finalize_round`, so it equals the stored `RoundMatched` after finalize. Returns an **empty
   * vec** when there is nothing to match (or the round is unknown); it never writes.
   */
  preview_round: ({round_id}: {round_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<readonly [u32, i128]>>>

  /**
   * Construct and simulate a round_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Per-(round, project) tallies for the frontend: `(direct, donors, matched, claimed)`.
   */
  round_project: ({round_id, project_id}: {round_id: u32, project_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<readonly [i128, u32, i128, boolean]>>

  /**
   * Construct and simulate a cancel_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The owner withdraws a campaign → `Cancelled`. Any already-collected direct donations remain
   * claimable via `claim_unmatched`; only the campaign's future visibility ends here.
   */
  cancel_project: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a finalize_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Settle a round's matching pool by QF. **Admin only.** Round must be `Open` (else
   * `AlreadyFinalized`). Runs the deterministic `compute_matches_now` split over the round's
   * participating **Approved, in-scope** projects (`RoundSumSqrt` → `qf::weight_from_sum_sqrt`
   * → `qf::compute_matches`); `NothingToMatch` short-circuits **before any write**. Writes each
   * `RoundMatched(r,p)`, flips status `Finalized`. **`Σ RoundMatched(r,·) == round.pool`.** Emits
   * `("match", r, p)` per project + `("final", r)`.
   */
  finalize_round: ({round_id}: {round_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reject_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Curator rejects a `Pending` campaign → `Rejected`.
   */
  reject_project: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a submit_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a campaign for curation. `owner` must be `≥ Basic` (`TierTooLow`); title/story/cid
   * must be non-empty and within the input limits. Assigns `NextProjectId++`, status `Pending`,
   * zeroed tallies; appends to `ProjectIds`. Curation — not registration — is the gate, so any
   * verified wallet may submit.
   */
  submit_project: ({owner, title, category, story, image_cid, payout}: {owner: string, title: string, category: Category, story: string, image_cid: string, payout: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a approve_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Curator approves a `Pending` campaign → `Approved` (now contributable + matchable).
   */
  approve_project: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a claim_unmatched transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sweep a campaign's `unrounded_direct` (donations made while no in-scope round was open, or
   * rolled in from a cancelled round) to its `payout`. Owner-authorized; `NothingToClaim` if the
   * balance is zero. Zeroes `unrounded_direct` so escrow never sticks. Emits `("payout", p)`.
   */
  claim_unmatched: ({project_id}: {project_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Write a wallet's KYC tier — **attester only**. The contract never sees PII, only the
   * resulting `Tier`.
   */
  set_verification: ({who, tier}: {who: string, tier: Tier}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a verification_tier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read a wallet's tier (default `None`) — powers the badge and the contribute/fund gates.
   */
  verification_tier: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Tier>>

  /**
   * Construct and simulate a list_projects_by_category transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * **Approved** campaigns in one category — the public discovery listing.
   */
  list_projects_by_category: ({category}: {category: Category}, options?: MethodOptions) => Promise<AssembledTransaction<Array<ProjectState>>>

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
      new ContractSpec([ "AAAAAAAAAPhPbmUtdGltZSBib290c3RyYXA6IGZpeCB0aGUgYGFkbWluYCAocm91bmQgKyBjdXJhdGlvbiBhdXRob3JpdHkpLCB0aGUgZXNjcm93IGB0b2tlbmAsIHRoZQpgYXR0ZXN0ZXJgIChLWUMtdGllciB3cml0ZXIg4oCUIHRoZSBhbmNob3IncyBrZXkgaW4gcHJvZCwgdGhlIG9wZXJhdG9yIG9uIHRlc3RuZXQpLCBhbmQgdGhlCmBjdXJhdG9yYCAoY2FtcGFpZ24gYXBwcm92ZXIpLiBSZS1gaW5pdGAg4oeSIGBBbHJlYWR5SW5pdGlhbGl6ZWRgLgAAAARpbml0AAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAWJQYXkgYSBmaW5hbGl6ZWQgcm91bmQncyBgUm91bmREaXJlY3QgKyBSb3VuZE1hdGNoZWRgIGZvciBvbmUgY2FtcGFpZ24gdG8gaXRzIGBwYXlvdXRgCmFkZHJlc3MuIEF1dGhvcml6ZWQgYnkgdGhlIGNhbXBhaWduICoqb3duZXIqKiAodGhlIGZyb3plbiBzaWduYXR1cmUgY2FycmllcyBubyBjYWxsZXIgdG8KZGlzdGluZ3Vpc2ggYW4gYWRtaW4g4oCUIHNlZSB0aGUgRGVjaXNpb25zIGxvZykuIFJvdW5kIG11c3QgYmUgYEZpbmFsaXplZGAgKGBOb3RGaW5hbGl6ZWRgKTsKbm90IGFscmVhZHkgY2xhaW1lZCAoYEFscmVhZHlDbGFpbWVkYCkuIFNldHMgYFJvdW5kQ2xhaW1lZGAsIGVtaXRzIGAoInBheW91dCIsIHIsIHApYC4AAAAAAAVjbGFpbQAAAAAAAAIAAAAAAAAACHJvdW5kX2lkAAAABAAAAAAAAAAKcHJvamVjdF9pZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAwAAANtUaGUgb24tY2hhaW4gdmVyaWZpY2F0aW9uIGF0dGVzdGF0aW9uIOKAlCB0aGUgKm9ubHkqIEtZQyBzdGF0ZSB0aGUgY29udHJhY3Qgc2VlcyAodGhlIFBJSSBsaXZlcwpvZmYtY2hhaW4gaW4gdGhlIGFuY2hvcikuIE9yZGVyZWQgc28gYEJhc2ljIDwgSW5zdGl0dXRpb25gOiBjb250cmlidXRvcnMgbmVlZCBg4omlIEJhc2ljYCwgcG9vbApmdW5kZXJzIG5lZWQgYEluc3RpdHV0aW9uYC4AAAAAAAAAAARUaWVyAAAAAwAAAAAAAAAETm9uZQAAAAAAAAAAAAAABUJhc2ljAAAAAAAAAQAAAAAAAAALSW5zdGl0dXRpb24AAAAAAg==",
        "AAAABAAAAhFFeHBsaWNpdCwgb2ZmLWNoYWluLWxlZ2libGUgZmFpbHVyZSB2YXJpYW50cyAocHJlZmVyIGBSZXN1bHQ8XywgRXJyb3I+YCBvdmVyIGBwYW5pYyFgKS4KRGlzY3JpbWluYW50cyBhcmUgKipzdGFibGUqKiDigJQgdGhlIGZyb250ZW5kIG1hcHMgdGhlbSB0byBCYWhhc2EgbWVzc2FnZXMg4oCUIHNvIHYyIGtlZXBzIHRoZQpkZW1vJ3MgMeKAkzEyIHVuY2hhbmdlZCBhbmQgYXBwZW5kcyBuZXcgb25lcy4gTm90ZTogYFJvdW5kQ2xvc2VkYC9gUm91bmROb3RPcGVuYCB0aGUgwqdWMyB0YWJsZQpsaXN0cyBhdCAxOC8xOSBhbHJlYWR5IGV4aXN0IGF0IDQvNSwgc28gdGhvc2UgdHdvIGRpc2NyaW1pbmFudHMgYXJlIGludGVudGlvbmFsbHkgbGVmdCBhcyBnYXBzCnJhdGhlciB0aGFuIGR1cGxpY2F0ZWQ7IGFuZCB0aGUgdGFibGUncyBzaGFyZWQgIjI2IEludmFsaWRDaWQgLyBJbnZhbGlkVGl0bGUiIGlzIHNwbGl0IGludG8gdHdvCmRpc3RpbmN0IHZhcmlhbnRzICgyNi8yNyksIGJvdGggb2Ygd2hpY2ggwqdWNS/Cp1Y3IHJlcXVpcmUuAAAAAAAAAAAAAAVFcnJvcgAAAAAAABkAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAITm90QWRtaW4AAAACAAAAAAAAAAtOb3RWZXJpZmllZAAAAAADAAAAAAAAAAtSb3VuZENsb3NlZAAAAAAEAAAAAAAAAAxSb3VuZE5vdE9wZW4AAAAFAAAAAAAAABBBbHJlYWR5RmluYWxpemVkAAAABgAAAAAAAAAMTm90RmluYWxpemVkAAAABwAAAAAAAAAOVW5rbm93blByb2plY3QAAAAAAAgAAAAAAAAAEER1cGxpY2F0ZVByb2plY3QAAAAJAAAAAAAAABBBbHJlYWR5RGlzYnVyc2VkAAAACgAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAsAAAAAAAAADk5vdGhpbmdUb01hdGNoAAAAAAAMAAAAAAAAAApOb3RDdXJhdG9yAAAAAAANAAAAAAAAABJQcm9qZWN0Tm90QXBwcm92ZWQAAAAAAA4AAAAAAAAAEVByb2plY3ROb3RQZW5kaW5nAAAAAAAADwAAAAAAAAAOQWxyZWFkeUNsYWltZWQAAAAAABAAAAAAAAAADFVua25vd25Sb3VuZAAAABEAAAAAAAAAEFJvdW5kQWxyZWFkeU9wZW4AAAAUAAAAAAAAABJDYXRlZ29yeU5vdEluUm91bmQAAAAAABUAAAAAAAAAClRpZXJUb29Mb3cAAAAAABYAAAAAAAAADk5vdGhpbmdUb0NsYWltAAAAAAAXAAAAAAAAAAhOb3RPd25lcgAAABgAAAAAAAAAC05vdEF0dGVzdGVyAAAAABkAAAAAAAAACkludmFsaWRDaWQAAAAAABoAAAAAAAAADEludmFsaWRUaXRsZQAAABs=",
        "AAAAAAAAAadLZWVwLWFsaXZlIGZvciBhIGNhbXBhaWduJ3MgaG90IHBlcnNpc3RlbnQgZW50cmllcyAowqdWNykuICoqQW55b25lKiogbWF5IGNhbGwgaXQg4oCUIGV4dGVuZGluZwpUVEwgaXMgbmV1dHJhbCB1cGtlZXAsIG5vdCBhIHByaXZpbGVnZWQgd3JpdGUg4oCUIHNvIGEgbG9uZy1saXZlZCBjYW1wYWlnbiBuZXZlciBleHBpcmVzCm1pZC1yb3VuZCBldmVuIGJldHdlZW4gY29udHJpYnV0aW9ucy4gRXh0ZW5kcyB0aGUgY2FtcGFpZ24gZW50cnkgYW5kLCB3aGVuIGEgcm91bmQgaXMgb3BlbiwKdGhhdCBjYW1wYWlnbidzIHBlci1yb3VuZCBhZ2dyZWdhdGUgZW50cmllcyB0b28gKGd1YXJkZWQgYnkgYGhhc2Agc28gYWJzZW50IGtleXMgYXJlIHNraXBwZWQsCm5ldmVyIHBhbmlja2luZykuIGBVbmtub3duUHJvamVjdGAgb24gYW4gdW5rbm93biBpZC4AAAAACGJ1bXBfdHRsAAAAAQAAAAAAAAAKcHJvamVjdF9pZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAQAAAJ5UaGUgZ2xvYmFsIHJvbGUvdG9rZW4gY29uZmlnLCBjb21wb3NlZCBmcm9tIHRoZSBpbnN0YW5jZSBrZXlzIGZvciB0aGUgYGdldF9jb25maWdgIHZpZXcgKMKnVjkpCnNvIHRoZSBmcm9udGVuZCByZWFkcyBhZG1pbi9jdXJhdG9yL2F0dGVzdGVyL3Rva2VuIGluIG9uZSBjYWxsLgAAAAAAAAAAAAZDb25maWcAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAAdjdXJhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAAAAAQxGdW5kIGFuIGBPcGVuYCByb3VuZCdzIG1hdGNoaW5nIHBvb2wuIGBmcm9tYCBtdXN0IGF1dGhvcml6ZSwgZ2l2ZSBgYW1vdW50ID4gMGAsIGFuZCBob2xkIHRoZQpgSW5zdGl0dXRpb25gIHRpZXIgKGBUaWVyVG9vTG93YCkg4oCUIHBvb2wgZnVuZGVycyBhcmUgdGhlIEtZQy1oZWF2eSByb2xlICjCp1Y4KS4gRXNjcm93cyB0aGUKdG9rZW5zIGludG8gdGhlIGNvbnRyYWN0IGFuZCBncm93cyBgcm91bmQucG9vbGAuIEVtaXQgYCgiZnVuZCIsIHJvdW5kX2lkLCBmcm9tKWAuAAAACWZ1bmRfcG9vbAAAAAAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAhyb3VuZF9pZAAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAE5PbmUgcm91bmQgYnkgaWQgKHBhbmljcyBvbiB1bmtub3duIGlkIOKAlCBjYWxsZXJzIHVzZSBpZHMgZnJvbSBgbGlzdF9yb3VuZHNgKS4AAAAAAAlnZXRfcm91bmQAAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAfQAAAAClJvdW5kU3RhdGUAAA==",
        "AAAAAgAAARxTdG9yYWdlIGNsYXNzIHBlciDCp1YyOiB0aGUgZ2xvYmFsIHNjYWxhcnMvbGlzdHMgKGBBZG1pbi9DdXJhdG9yL0F0dGVzdGVyL1Rva2VuL05leHRSb3VuZElkLwpOZXh0UHJvamVjdElkL1JvdW5kSWRzYCkgbGl2ZSBpbiAqKmluc3RhbmNlKio7IGV2ZXJ5dGhpbmcgcHJvamVjdC9yb3VuZC9kb25vci1zY29wZWQg4oCUIHBsdXMgdGhlCnVuYm91bmRlZCBgUHJvamVjdElkc2Agc2V0IOKAlCBsaXZlcyBpbiAqKnBlcnNpc3RlbnQqKiBzbyBpdCBuZXZlciBibG9hdHMgdGhlIGluc3RhbmNlIGVudHJ5LgAAAAAAAAAHRGF0YUtleQAAAAARAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAdDdXJhdG9yAAAAAAAAAAAAAAAACEF0dGVzdGVyAAAAAAAAAAAAAAAFVG9rZW4AAAAAAAAAAAAAAAAAAAtOZXh0Um91bmRJZAAAAAAAAAAAAAAAAA1OZXh0UHJvamVjdElkAAAAAAAAAAAAAAAAAAAIUm91bmRJZHMAAAAAAAAAAAAAAApQcm9qZWN0SWRzAAAAAAABAAAAAAAAAAdQcm9qZWN0AAAAAAEAAAAEAAAAAQAAAAAAAAAFUm91bmQAAAAAAAABAAAABAAAAAEAAAAAAAAAEVJvdW5kQ29udHJpYnV0aW9uAAAAAAAAAwAAAAQAAAAEAAAAEwAAAAEAAAAAAAAAC1JvdW5kRGlyZWN0AAAAAAIAAAAEAAAABAAAAAEAAAAAAAAAD1JvdW5kRG9ub3JDb3VudAAAAAACAAAABAAAAAQAAAABAAAAAAAAAAxSb3VuZFN1bVNxcnQAAAACAAAABAAAAAQAAAABAAAAAAAAAAxSb3VuZE1hdGNoZWQAAAACAAAABAAAAAQAAAABAAAAAAAAAAxSb3VuZENsYWltZWQAAAACAAAABAAAAAQAAAABAAAAAAAAAAxWZXJpZmljYXRpb24AAAABAAAAEw==",
        "AAAAAAAAAc1Eb25hdGUgZGlyZWN0bHkgdG8gYW4gYEFwcHJvdmVkYCBjYW1wYWlnbi4gQ29udGludW91cyAoYWx3YXlzLW9wZW4pOiBldmVyeSBnaWZ0IGdyb3dzCmBsaWZldGltZV9kaXJlY3RgLiBJZiBhIHJvdW5kIGlzIGBPcGVuYCAqKmFuZCoqIHRoZSBjYW1wYWlnbidzIGNhdGVnb3J5IGlzIGluIHNjb3BlLCB0aGUgZ2lmdAphbHNvIGZlZWRzIHRoYXQgcm91bmQncyBRRiBhZ2dyZWdhdGVzIChwZXItcm91bmQgY3VtdWxhdGl2ZS1zcXJ0LCBrZXllZCBgKHJvdW5kLCBwcm9qZWN0KWApOwpvdGhlcndpc2UgaXQgZ3Jvd3MgYHVucm91bmRlZF9kaXJlY3RgICh0aGUgwqdWNiBlbHNlLWJyYW5jaCksIGNsYWltYWJsZSB2aWEgYGNsYWltX3VubWF0Y2hlZGAuCmBkb25vcmAgbXVzdCBiZSBg4omlIEJhc2ljYCAoYFRpZXJUb29Mb3dgKTsgdGFyZ2V0IG11c3QgYmUgYEFwcHJvdmVkYCAoYFByb2plY3ROb3RBcHByb3ZlZGApLgAAAAAAAApjb250cmlidXRlAAAAAAADAAAAAAAAAAVkb25vcgAAAAAAABMAAAAAAAAACnByb2plY3RfaWQAAAAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAClUaGUgZ2xvYmFsIHJvbGUvdG9rZW4gY29uZmlnIGluIG9uZSBjYWxsLgAAAAAAAApnZXRfY29uZmlnAAAAAAAAAAAAAQAAB9AAAAAGQ29uZmlnAAA=",
        "AAAAAAAAAZFPcGVuIGEgbmV3IG1hdGNoaW5nIHJvdW5kICgic2Vhc29uIikuICoqQWRtaW4gb25seS4qKiBFbmZvcmNlcyB0aGUgKiphdC1tb3N0LW9uZS1vcGVuKioKaW52YXJpYW50IChgUm91bmRBbHJlYWR5T3BlbmApIHNvIFFGIHNldHRsZXMgb3ZlciBvbmUgY2xlYW4gc25hcHNob3QuIGBzcG9uc29yYCBpcyByZWNvcmRlZAptZXRhZGF0YSAodGhlIGluc3RpdHV0aW9uIHRoZSBwb29sIGlzIGNyZWRpdGVkIHRvKTsgYGNhdGVnb3JpZXNgIHNjb3BlcyB3aGljaCBjYW1wYWlnbnMgdGhlCnJvdW5kIG1hdGNoZXMgKEVNUFRZID0gYWxsKS4gQXNzaWducyBgTmV4dFJvdW5kSWQrK2AsIGBwb29sID0gMGAsIHN0YXR1cyBgT3BlbmA7IGFwcGVuZHMgdG8KYFJvdW5kSWRzYC4gRW1pdCBgKCJyb3VuZG9wZW4iLCBpZClgLgAAAAAAAApvcGVuX3JvdW5kAAAAAAADAAAAAAAAAAdzcG9uc29yAAAAABMAAAAAAAAACXJvdW5kX2VuZAAAAAAAAAYAAAAAAAAACmNhdGVnb3JpZXMAAAAAA+oAAAfQAAAACENhdGVnb3J5AAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAgAAALVUaGUgY3VyYXRlZCwgZXh0ZW5zaWJsZSBzZXQgb2Ygc29jaWFsLWltcGFjdCBjYXRlZ29yaWVzIGEgY2FtcGFpZ24gYmVsb25ncyB0by4gKipBcHBlbmQKdmFyaWFudHMgb25seSwgbmV2ZXIgcmVudW1iZXIqKiDigJQgdGhlIGZyb250ZW5kIGFuZCBnZW5lcmF0ZWQgYmluZGluZ3MgbWFwIHRoZW0gYnkgcG9zaXRpb24uAAAAAAAAAAAAAAhDYXRlZ29yeQAAAAMAAAAAAAAAAAAAABFEZXZlbG9waW5nUmVnaW9ucwAAAAAAAAAAAAAAAAAADkRpc2FzdGVyUmVsaWVmAAAAAAAAAAAAAAAAAA9FZHVjYXRpb25IZWFsdGgA",
        "AAAAAAAAAFNPbmUgY2FtcGFpZ24gYnkgaWQgKHBhbmljcyBvbiB1bmtub3duIGlkIOKAlCBjYWxsZXJzIHVzZSBpZHMgZnJvbSBgbGlzdF9wcm9qZWN0c2ApLgAAAAALZ2V0X3Byb2plY3QAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAH0AAAAAxQcm9qZWN0U3RhdGU=",
        "AAAAAAAAAB5BbGwgcm91bmRzLCBpbiBjcmVhdGlvbiBvcmRlci4AAAAAAAtsaXN0X3JvdW5kcwAAAAAAAAAAAQAAA+oAAAfQAAAAClJvdW5kU3RhdGUAAA==",
        "AAAAAAAAACBSb3RhdGUgdGhlIGN1cmF0b3IgKGFkbWluIG9ubHkpLgAAAAtzZXRfY3VyYXRvcgAAAAABAAAAAAAAAAN3aG8AAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAWVDYW5jZWwgYW4gYE9wZW5gIHJvdW5kIHByZS1maW5hbGl6ZS4gKipBZG1pbiBvbmx5LioqIFJlZnVuZHMgYHJvdW5kLnBvb2xgIHRvIHRoZSBzcG9uc29yIGFuZAoqKnJvbGxzIGVhY2ggYFJvdW5kRGlyZWN0KHIscClgIGludG8gdGhhdCBjYW1wYWlnbidzIGB1bnJvdW5kZWRfZGlyZWN0YCoqIOKAlCBkb25vcnMgbWVhbnQgdG8KZnVuZCB0aGUgY2FtcGFpZ24gcmVnYXJkbGVzcyBvZiB0aGUgbWF0Y2gsIHNvIGNhbXBhaWducyBrZWVwIHRoZWlyIGRpcmVjdCBnaWZ0czsgb25seSB0aGUKbWF0Y2ggcG9vbCByZWZ1bmRzLiBaZXJvZXMgYHBvb2xgLCBzdGF0dXMgYENhbmNlbGxlZGAuIEVtaXRzIGAoInJuZGNhbmNlbCIsIHIpYC4AAAAAAAAMY2FuY2VsX3JvdW5kAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAH1Sb3RhdGUgdGhlIGF0dGVzdGVyIChhZG1pbiBvbmx5KSDigJQgdGhlIHBsdWdnYWJsZS12ZXJpZmllciBzZWFtOiBzd2FwcGluZyB0aGUgYW5jaG9yIHN3YXBzCndobyBob2xkcyB0aGlzIGtleSwgbm90IHRoZSBjb2RlLgAAAAAAAAxzZXRfYXR0ZXN0ZXIAAAABAAAAAAAAAAN3aG8AAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAQAAAMZGdWxsIHB1YmxpYyBzdGF0ZSBvZiBvbmUgbWF0Y2hpbmcgcm91bmQuIGBjYXRlZ29yaWVzYCBzY29wZXMgd2hpY2ggY2FtcGFpZ25zIHRoZSByb3VuZCBtYXRjaGVzOwphbiAqKmVtcHR5KiogdmVjIG1lYW5zIGFsbCBjYXRlZ29yaWVzLiBgcG9vbGAgaXMgdGhlIHNwb25zb3ItZnVuZGVkIG1hdGNoaW5nIHBvb2wgZm9yIHRoaXMKcm91bmQgb25seS4AAAAAAAAAAAAKUm91bmRTdGF0ZQAAAAAABgAAAAAAAAAKY2F0ZWdvcmllcwAAAAAD6gAAB9AAAAAIQ2F0ZWdvcnkAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAARwb29sAAAACwAAAAAAAAAJcm91bmRfZW5kAAAAAAAABgAAAAAAAAAHc3BvbnNvcgAAAAATAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAALUm91bmRTdGF0dXMA",
        "AAAAAAAAAGYqKkFsbCoqIGNhbXBhaWducyByZWdhcmRsZXNzIG9mIHN0YXR1cyDigJQgdGhlIGZyb250ZW5kIGZpbHRlcnMgZm9yIGRpc2NvdmVyeSB2cy4gdGhlIG93bmVyCmRhc2hib2FyZC4AAAAAAA1saXN0X3Byb2plY3RzAAAAAAAAAAAAAAEAAAPqAAAH0AAAAAxQcm9qZWN0U3RhdGU=",
        "AAAAAAAAAEVUaGUgaWQgb2YgdGhlIHNpbmdsZSBjdXJyZW50bHktYE9wZW5gIHJvdW5kLCBpZiBhbnkgKMKnVjYgaW52YXJpYW50KS4AAAAAAAANb3Blbl9yb3VuZF9pZAAAAAAAAAAAAAABAAAD6AAAAAQ=",
        "AAAAAAAAAQFSZWFkLW9ubHkgcHJvamVjdGlvbiBvZiBhIHJvdW5kJ3MgUUYgc3BsaXQg4oCUIHRoZSBzYW1lIGRldGVybWluaXN0aWMgY29tcHV0YXRpb24gYXMKYGZpbmFsaXplX3JvdW5kYCwgc28gaXQgZXF1YWxzIHRoZSBzdG9yZWQgYFJvdW5kTWF0Y2hlZGAgYWZ0ZXIgZmluYWxpemUuIFJldHVybnMgYW4gKiplbXB0eQp2ZWMqKiB3aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gbWF0Y2ggKG9yIHRoZSByb3VuZCBpcyB1bmtub3duKTsgaXQgbmV2ZXIgd3JpdGVzLgAAAAAAAA1wcmV2aWV3X3JvdW5kAAAAAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAQAAA+oAAAPtAAAAAgAAAAQAAAAL",
        "AAAAAAAAAFRQZXItKHJvdW5kLCBwcm9qZWN0KSB0YWxsaWVzIGZvciB0aGUgZnJvbnRlbmQ6IGAoZGlyZWN0LCBkb25vcnMsIG1hdGNoZWQsIGNsYWltZWQpYC4AAAANcm91bmRfcHJvamVjdAAAAAAAAAIAAAAAAAAACHJvdW5kX2lkAAAABAAAAAAAAAAKcHJvamVjdF9pZAAAAAAABAAAAAEAAAPtAAAABAAAAAsAAAAEAAAACwAAAAE=",
        "AAAAAgAAAKZMaWZlY3ljbGUgb2Ygb25lIG1hdGNoaW5nIHJvdW5kICgic2Vhc29uIikuICoqSW52YXJpYW50OiBhdCBtb3N0IG9uZSBgT3BlbmAgcm91bmQgYXQgYSB0aW1lKioKKGEgc2luZ2xlIGNsZWFuIFFGIHNuYXBzaG90KS4gYENhbmNlbGxlZGAgaXMgYSBwcmUtZmluYWxpemUgcmVmdW5kIHBhdGguAAAAAAAAAAAAC1JvdW5kU3RhdHVzAAAAAAMAAAAAAAAAAAAAAARPcGVuAAAAAAAAAAAAAAAJRmluYWxpemVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAAAAALZUaGUgb3duZXIgd2l0aGRyYXdzIGEgY2FtcGFpZ24g4oaSIGBDYW5jZWxsZWRgLiBBbnkgYWxyZWFkeS1jb2xsZWN0ZWQgZGlyZWN0IGRvbmF0aW9ucyByZW1haW4KY2xhaW1hYmxlIHZpYSBgY2xhaW1fdW5tYXRjaGVkYCAowqdWNik7IG9ubHkgdGhlIGNhbXBhaWduJ3MgZnV0dXJlIHZpc2liaWxpdHkgZW5kcyBoZXJlLgAAAAAADmNhbmNlbF9wcm9qZWN0AAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAfRTZXR0bGUgYSByb3VuZCdzIG1hdGNoaW5nIHBvb2wgYnkgUUYuICoqQWRtaW4gb25seS4qKiBSb3VuZCBtdXN0IGJlIGBPcGVuYCAoZWxzZQpgQWxyZWFkeUZpbmFsaXplZGApLiBSdW5zIHRoZSBkZXRlcm1pbmlzdGljIGBjb21wdXRlX21hdGNoZXNfbm93YCBzcGxpdCBvdmVyIHRoZSByb3VuZCdzCnBhcnRpY2lwYXRpbmcgKipBcHByb3ZlZCwgaW4tc2NvcGUqKiBwcm9qZWN0cyAoYFJvdW5kU3VtU3FydGAg4oaSIGBxZjo6d2VpZ2h0X2Zyb21fc3VtX3NxcnRgCuKGkiBgcWY6OmNvbXB1dGVfbWF0Y2hlc2ApOyBgTm90aGluZ1RvTWF0Y2hgIHNob3J0LWNpcmN1aXRzICoqYmVmb3JlIGFueSB3cml0ZSoqLiBXcml0ZXMgZWFjaApgUm91bmRNYXRjaGVkKHIscClgLCBmbGlwcyBzdGF0dXMgYEZpbmFsaXplZGAuICoqYM6jIFJvdW5kTWF0Y2hlZChyLMK3KSA9PSByb3VuZC5wb29sYC4qKiBFbWl0cwpgKCJtYXRjaCIsIHIsIHApYCBwZXIgcHJvamVjdCArIGAoImZpbmFsIiwgcilgLgAAAA5maW5hbGl6ZV9yb3VuZAAAAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADRDdXJhdG9yIHJlamVjdHMgYSBgUGVuZGluZ2AgY2FtcGFpZ24g4oaSIGBSZWplY3RlZGAuAAAADnJlamVjdF9wcm9qZWN0AAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAS1TdWJtaXQgYSBjYW1wYWlnbiBmb3IgY3VyYXRpb24uIGBvd25lcmAgbXVzdCBiZSBg4omlIEJhc2ljYCAoYFRpZXJUb29Mb3dgKTsgdGl0bGUvc3RvcnkvY2lkCm11c3QgYmUgbm9uLWVtcHR5IGFuZCB3aXRoaW4gwqdWNyBsaW1pdHMuIEFzc2lnbnMgYE5leHRQcm9qZWN0SWQrK2AsIHN0YXR1cyBgUGVuZGluZ2AsCnplcm9lZCB0YWxsaWVzOyBhcHBlbmRzIHRvIGBQcm9qZWN0SWRzYC4gQ3VyYXRpb24g4oCUIG5vdCByZWdpc3RyYXRpb24g4oCUIGlzIHRoZSBnYXRlLCBzbyBhbnkKdmVyaWZpZWQgd2FsbGV0IG1heSBzdWJtaXQuAAAAAAAADnN1Ym1pdF9wcm9qZWN0AAAAAAAGAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAAAVzdG9yeQAAAAAAABAAAAAAAAAACWltYWdlX2NpZAAAAAAAABAAAAAAAAAABnBheW91dAAAAAAAEwAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAQAAAUtGdWxsIHB1YmxpYyBzdGF0ZSBvZiBvbmUgY2FtcGFpZ24g4oCUIGNvbnRpbnVvdXMgYW5kIGdsb2JhbCAobm90IHNjb3BlZCB0byBhIHJvdW5kKS4gRGlyZWN0CmRvbmF0aW9ucyBhcmUgYWx3YXlzLW9wZW47IGBsaWZldGltZV9kaXJlY3RgIGlzIGV2ZXJ5IGNvbnRyaWJ1dGlvbiBldmVyLCB3aGlsZQpgdW5yb3VuZGVkX2RpcmVjdGAgaXMgdGhlIHNsaWNlIGdpdmVuIHdoaWxlIG5vIGluLXNjb3BlIHJvdW5kIHdhcyBvcGVuIChjbGFpbWFibGUgdmlhCmBjbGFpbV91bm1hdGNoZWRgKS4gUGVyLXJvdW5kIHRhbGxpZXMgbGl2ZSBpbiB0aGUgYFJvdW5kKmAga2V5cywgbm90IGhlcmUuAAAAAAAAAAAMUHJvamVjdFN0YXRlAAAACwAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAAA5jcmVhdGVkX2xlZGdlcgAAAAAABgAAAAAAAAACaWQAAAAAAAQAAAAAAAAACWltYWdlX2NpZAAAAAAAABAAAAAAAAAAD2xpZmV0aW1lX2RpcmVjdAAAAAALAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnBheW91dAAAAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADVByb2plY3RTdGF0dXMAAAAAAAAAAAAABXN0b3J5AAAAAAAAEAAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAABB1bnJvdW5kZWRfZGlyZWN0AAAACw==",
        "AAAAAAAAAFVDdXJhdG9yIGFwcHJvdmVzIGEgYFBlbmRpbmdgIGNhbXBhaWduIOKGkiBgQXBwcm92ZWRgIChub3cgY29udHJpYnV0YWJsZSArIG1hdGNoYWJsZSkuAAAAAAAAD2FwcHJvdmVfcHJvamVjdAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAARFTd2VlcCBhIGNhbXBhaWduJ3MgYHVucm91bmRlZF9kaXJlY3RgIChkb25hdGlvbnMgbWFkZSB3aGlsZSBubyBpbi1zY29wZSByb3VuZCB3YXMgb3Blbiwgb3IKcm9sbGVkIGluIGZyb20gYSBjYW5jZWxsZWQgcm91bmQpIHRvIGl0cyBgcGF5b3V0YC4gT3duZXItYXV0aG9yaXplZDsgYE5vdGhpbmdUb0NsYWltYCBpZiB0aGUKYmFsYW5jZSBpcyB6ZXJvLiBaZXJvZXMgYHVucm91bmRlZF9kaXJlY3RgIHNvIGVzY3JvdyBuZXZlciBzdGlja3MuIEVtaXRzIGAoInBheW91dCIsIHApYC4AAAAAAAAPY2xhaW1fdW5tYXRjaGVkAAAAAAEAAAAAAAAACnByb2plY3RfaWQAAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAgAAAKxDdXJhdGlvbiBzdGF0ZSBvZiBhIGNhbXBhaWduLiBPbmx5IGBBcHByb3ZlZGAgY2FtcGFpZ25zIGFyZSBjb250cmlidXRhYmxlIGFuZCBtYXRjaGFibGU7CmRpc2NvdmVyeSBoaWRlcyBldmVyeXRoaW5nIGVsc2UgKHRoZSBvd25lciBzdGlsbCBzZWVzIHRoZWlyIG93biB2aWEgdGhlIGRhc2hib2FyZCkuAAAAAAAAAA1Qcm9qZWN0U3RhdHVzAAAAAAAABAAAAAAAAAAAAAAAB1BlbmRpbmcAAAAAAAAAAAAAAAAIQXBwcm92ZWQAAAAAAAAAAAAAAAhSZWplY3RlZAAAAAAAAAAAAAAACUNhbmNlbGxlZAAAAA==",
        "AAAAAAAAAG9Xcml0ZSBhIHdhbGxldCdzIEtZQyB0aWVyIOKAlCAqKmF0dGVzdGVyIG9ubHkqKiAowqdWOCkuIFRoZSBjb250cmFjdCBuZXZlciBzZWVzIFBJSSwgb25seSB0aGUKcmVzdWx0aW5nIGBUaWVyYC4AAAAAEHNldF92ZXJpZmljYXRpb24AAAACAAAAAAAAAAN3aG8AAAAAEwAAAAAAAAAEdGllcgAAB9AAAAAEVGllcgAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAGBSZWFkIGEgd2FsbGV0J3MgdGllciAoZGVmYXVsdCBgTm9uZWApIOKAlCBwb3dlcnMgdGhlIGJhZGdlIGFuZCB0aGUgY29udHJpYnV0ZS9mdW5kIGdhdGVzICjCp1Y4KS4AAAARdmVyaWZpY2F0aW9uX3RpZXIAAAAAAAABAAAAAAAAAAN3aG8AAAAAEwAAAAEAAAfQAAAABFRpZXI=",
        "AAAAAAAAAEgqKkFwcHJvdmVkKiogY2FtcGFpZ25zIGluIG9uZSBjYXRlZ29yeSDigJQgdGhlIHB1YmxpYyBkaXNjb3ZlcnkgbGlzdGluZy4AAAAZbGlzdF9wcm9qZWN0c19ieV9jYXRlZ29yeQAAAAAAAAEAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAEAAAPqAAAH0AAAAAxQcm9qZWN0U3RhdGU=" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>,
        claim: this.txFromJSON<Result<void>>,
        bump_ttl: this.txFromJSON<Result<void>>,
        fund_pool: this.txFromJSON<Result<void>>,
        get_round: this.txFromJSON<RoundState>,
        contribute: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Config>,
        open_round: this.txFromJSON<Result<u32>>,
        get_project: this.txFromJSON<ProjectState>,
        list_rounds: this.txFromJSON<Array<RoundState>>,
        set_curator: this.txFromJSON<Result<void>>,
        cancel_round: this.txFromJSON<Result<void>>,
        set_attester: this.txFromJSON<Result<void>>,
        list_projects: this.txFromJSON<Array<ProjectState>>,
        open_round_id: this.txFromJSON<Option<u32>>,
        preview_round: this.txFromJSON<Array<readonly [u32, i128]>>,
        round_project: this.txFromJSON<readonly [i128, u32, i128, boolean]>,
        cancel_project: this.txFromJSON<Result<void>>,
        finalize_round: this.txFromJSON<Result<void>>,
        reject_project: this.txFromJSON<Result<void>>,
        submit_project: this.txFromJSON<Result<u32>>,
        approve_project: this.txFromJSON<Result<void>>,
        claim_unmatched: this.txFromJSON<Result<void>>,
        set_verification: this.txFromJSON<Result<void>>,
        verification_tier: this.txFromJSON<Tier>,
        list_projects_by_category: this.txFromJSON<Array<ProjectState>>
  }
}