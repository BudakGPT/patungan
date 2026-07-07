#![no_std]
//! Patungan — a transparent quadratic-matching platform for curated social-impact causes.
//!
//! This module holds the data surface the whole product codes against — the types
//! (`Category`/`ProjectStatus`/`RoundStatus`/`Tier` + the per-campaign `ProjectState` and the
//! per-season `RoundState`), the storage keys (`DataKey`), and the error enum. Every QF aggregate
//! is re-keyed **per round**, and campaigns, curation, and tiered verification are first-class. The
//! QF math itself lives in `qf.rs`; only its inputs are re-keyed per round.
//!
//! The entrypoints that operate over this surface: setup/roles, campaign lifecycle, round lifecycle
//! + QF, and the read views.

// The QF pool split (finalize/preview) reads per-round Σ√ aggregates out of storage and feeds them
// to `qf`'s slice-based math; bridging soroban storage `Vec`s to those slices needs a transient
// heap `Vec`, and soroban-sdk installs a wasm global allocator, so `alloc` is available under
// `#![no_std]`. `compute_matches_now` uses it.
extern crate alloc;

use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, symbol_short, token, Address, Env, String,
    Vec,
};

// Pure, chain-free quadratic-funding math (isqrt + weights + pool split), re-keyed per round.
// `contribute` calls `isqrt` to keep the running per-round Σ√; `finalize_round`/`preview_round`
// call `weight_from_sum_sqrt` + `compute_matches`.
mod qf;

// Integration tests; `#[cfg(test)]`-gated, so `cargo build` does not compile them.
#[cfg(test)]
mod test;

// ---------- Types ----------

/// The curated, extensible set of social-impact categories a campaign belongs to. **Append
/// variants only, never renumber** — the frontend and generated bindings map them by position.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Category {
    DevelopingRegions,
    DisasterRelief,
    EducationHealth,
}

/// Curation state of a campaign. Only `Approved` campaigns are contributable and matchable;
/// discovery hides everything else (the owner still sees their own via the dashboard).
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ProjectStatus {
    Pending,
    Approved,
    Rejected,
    Cancelled,
}

/// Lifecycle of one matching round ("season"). **Invariant: at most one `Open` round at a time**
/// (a single clean QF snapshot). `Cancelled` is a pre-finalize refund path.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RoundStatus {
    Open,
    Finalized,
    Cancelled,
}

/// The on-chain verification attestation — the *only* KYC state the contract sees (the PII lives
/// off-chain in the anchor). Ordered so `Basic < Institution`: contributors need `≥ Basic`, pool
/// funders need `Institution`.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Tier {
    None = 0,
    Basic = 1,
    Institution = 2,
}

/// Full public state of one campaign — continuous and global (not scoped to a round). Direct
/// donations are always-open; `lifetime_direct` is every contribution ever, while
/// `unrounded_direct` is the slice given while no in-scope round was open (claimable via
/// `claim_unmatched`). Per-round tallies live in the `Round*` keys, not here.
#[contracttype]
#[derive(Clone)]
pub struct ProjectState {
    pub id: u32,
    pub owner: Address,
    pub payout: Address,
    pub title: String,
    pub category: Category,
    pub story: String,         // on-chain (bounded; see the input limits below)
    pub image_cid: String,     // IPFS CID only — the image bytes live off-chain
    pub status: ProjectStatus,
    pub lifetime_direct: i128, // Σ all contributions ever (across rounds + unrounded)
    pub unrounded_direct: i128, // direct donations made while NO in-scope round was open
    pub created_ledger: u64,
}

/// Full public state of one matching round. `categories` scopes which campaigns the round matches;
/// an **empty** vec means all categories. `pool` is the sponsor-funded matching pool for this
/// round only.
#[contracttype]
#[derive(Clone)]
pub struct RoundState {
    pub id: u32,
    pub sponsor: Address,
    pub pool: i128,
    pub status: RoundStatus,
    pub round_end: u64,
    pub categories: Vec<Category>, // in-scope categories; EMPTY = all categories
}

/// The global role/token config, composed from the instance keys for the `get_config` view
/// so the frontend reads admin/curator/attester/token in one call.
#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    pub curator: Address,
    pub attester: Address,
    pub token: Address,
}

// ---------- Storage keys ----------

/// Storage class: the global scalars/lists (`Admin/Curator/Attester/Token/NextRoundId/
/// NextProjectId/RoundIds`) live in **instance**; everything project/round/donor-scoped — plus the
/// unbounded `ProjectIds` set — lives in **persistent** so it never bloats the instance entry.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // ---- global ----
    Admin,
    Curator,
    Attester,
    Token,
    NextRoundId,
    NextProjectId,
    RoundIds,  // Vec<u32>
    ProjectIds, // Vec<u32> — ALL campaigns; views filter by status/category
    // ---- campaign (continuous) ----
    Project(u32), // ProjectState
    // ---- round ----
    Round(u32), // RoundState
    // ---- per (round, project) QF aggregates ----
    RoundContribution(u32, u32, Address), // i128 cumulative per donor IN THIS ROUND
    RoundDirect(u32, u32),                // i128 sum of contributions to project in this round
    RoundDonorCount(u32, u32),            // u32 distinct donors in this round
    RoundSumSqrt(u32, u32),               // u128 Σ isqrt(per-donor cumulative) — the ONLY QF read
    RoundMatched(u32, u32),               // i128 set at finalize
    RoundClaimed(u32, u32),               // bool
    // ---- identity ----
    Verification(Address), // Tier
}

// ---------- Errors ----------

/// Explicit, off-chain-legible failure variants (prefer `Result<_, Error>` over `panic!`).
/// Discriminants are **stable** — the frontend maps them to Bahasa messages. Note:
/// `RoundNotOpen`/`RoundClosed` are reused at 4/5, so the 18/19 slots are intentionally left as
/// gaps rather than duplicated.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // ---- core 1–12 ----
    AlreadyInitialized = 1,
    NotAdmin = 2,
    NotVerified = 3,
    RoundClosed = 4,
    RoundNotOpen = 5,
    AlreadyFinalized = 6,
    NotFinalized = 7,
    UnknownProject = 8,
    DuplicateProject = 9,
    AlreadyDisbursed = 10,
    InvalidAmount = 11,
    NothingToMatch = 12,
    // ---- appended variants ----
    NotCurator = 13,
    ProjectNotApproved = 14,
    ProjectNotPending = 15,
    AlreadyClaimed = 16,
    UnknownRound = 17,
    // 18 RoundNotOpen / 19 RoundClosed — already defined above (5 / 4); left as gaps.
    RoundAlreadyOpen = 20,
    CategoryNotInRound = 21,
    TierTooLow = 22,
    NothingToClaim = 23,
    NotOwner = 24,
    NotAttester = 25,
    InvalidCid = 26,
    InvalidTitle = 27,
}

// ---------- Input limits ----------

const MAX_TITLE_LEN: u32 = 96; // ~a headline
const MAX_STORY_LEN: u32 = 1024; // bounded on-chain story
const MAX_CID_LEN: u32 = 80; // a CIDv1 is ~60 chars

// ---------- TTL policy ----------

/// ~1 day of 5-second Stellar ledgers — the unit the bump windows below are expressed in.
const LEDGERS_PER_DAY: u32 = 17_280;
/// Bump-on-write windows. On every persistent write we extend the entry to ~30 days once it drops
/// below ~10 days of remaining life, so a campaign/round's hot data never expires mid-round. Both
/// stay well under the test/default `max_entry_ttl`, so `extend_ttl` never overshoots and panics.
const PERSISTENT_BUMP_THRESHOLD: u32 = 10 * LEDGERS_PER_DAY;
const PERSISTENT_BUMP_AMOUNT: u32 = 30 * LEDGERS_PER_DAY;
/// Instance window (global config + round/project indexes), bumped on `init` and each `open_round`.
const INSTANCE_BUMP_THRESHOLD: u32 = 10 * LEDGERS_PER_DAY;
const INSTANCE_BUMP_AMOUNT: u32 = 30 * LEDGERS_PER_DAY;

// ---------- Storage / auth helpers (private; not contract entrypoints) ----------

/// Bump-on-write: set a persistent entry **and** extend its TTL in one step. Every persistent
/// write in the contract goes through here, so hot campaign/round data is refreshed each time it is
/// touched and never lapses while the platform is active.
fn put<K, V>(env: &Env, key: &K, val: &V)
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
    V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    let ps = env.storage().persistent();
    ps.set(key, val);
    ps.extend_ttl(key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

/// Extend the instance entry's TTL — called on `init` and each `open_round` so the global
/// config and the round/project indexes never expire while the platform is in use.
fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

/// Load the stored admin and assert its authorization. Absent admin ⇒ not initialized.
fn require_admin(env: &Env) -> Result<Address, Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotAdmin)?;
    admin.require_auth();
    Ok(admin)
}

/// Load the stored curator and assert its authorization.
fn require_curator(env: &Env) -> Result<(), Error> {
    let curator: Address = env
        .storage()
        .instance()
        .get(&DataKey::Curator)
        .ok_or(Error::NotCurator)?;
    curator.require_auth();
    Ok(())
}

/// The on-chain tier of an address (`None` when never attested).
fn tier_of(env: &Env, who: &Address) -> Tier {
    env.storage()
        .persistent()
        .get(&DataKey::Verification(who.clone()))
        .unwrap_or(Tier::None)
}

/// Load a campaign or fail with `UnknownProject`.
fn load_project(env: &Env, id: u32) -> Result<ProjectState, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Project(id))
        .ok_or(Error::UnknownProject)
}

/// The single currently-`Open` round, if any (its `(id, state)`). The **at-most-one-open**
/// invariant (enforced in `open_round`) makes this the round `contribute` tags against; scanning
/// `RoundIds` is O(rounds) and fine at product scale (no `OpenRoundId` pointer key is added).
fn find_open_round(env: &Env) -> Option<(u32, RoundState)> {
    let ids: Vec<u32> = env
        .storage()
        .instance()
        .get(&DataKey::RoundIds)
        .unwrap_or(Vec::new(env));
    for id in ids.iter() {
        if let Some(round) = env
            .storage()
            .persistent()
            .get::<DataKey, RoundState>(&DataKey::Round(id))
        {
            if round.status == RoundStatus::Open {
                return Some((id, round));
            }
        }
    }
    None
}

/// The contract: setup/roles, campaign lifecycle, the recurring-round machinery
/// (`open_round`/`fund_pool`/`finalize`), continuous donation, and the read views.
#[contract]
pub struct Patungan;

#[contractimpl]
impl Patungan {
    // ---------- setup & roles ----------

    /// One-time bootstrap: fix the `admin` (round + curation authority), the escrow `token`, the
    /// `attester` (KYC-tier writer — the anchor's key in prod, the operator on testnet), and the
    /// `curator` (campaign approver). Re-`init` ⇒ `AlreadyInitialized`.
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        attester: Address,
        curator: Address,
    ) -> Result<(), Error> {
        let s = env.storage().instance();
        if s.has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Attester, &attester);
        s.set(&DataKey::Curator, &curator);
        s.set(&DataKey::NextProjectId, &0u32);
        s.set(&DataKey::NextRoundId, &0u32);
        s.set(&DataKey::RoundIds, &Vec::<u32>::new(&env));
        put(&env, &DataKey::ProjectIds, &Vec::<u32>::new(&env));
        bump_instance(&env);
        Ok(())
    }

    /// Rotate the attester (admin only) — the pluggable-verifier seam: swapping the anchor swaps
    /// who holds this key, not the code.
    pub fn set_attester(env: Env, who: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Attester, &who);
        Ok(())
    }

    /// Rotate the curator (admin only).
    pub fn set_curator(env: Env, who: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Curator, &who);
        Ok(())
    }

    /// Write a wallet's KYC tier — **attester only**. The contract never sees PII, only the
    /// resulting `Tier`.
    pub fn set_verification(env: Env, who: Address, tier: Tier) -> Result<(), Error> {
        let attester: Address = env
            .storage()
            .instance()
            .get(&DataKey::Attester)
            .ok_or(Error::NotAttester)?;
        attester.require_auth();
        put(&env, &DataKey::Verification(who.clone()), &tier);
        env.events().publish((symbol_short!("verify"), who), tier);
        Ok(())
    }

    /// Read a wallet's tier (default `None`) — powers the badge and the contribute/fund gates.
    pub fn verification_tier(env: Env, who: Address) -> Tier {
        tier_of(&env, &who)
    }

    // ---------- campaign lifecycle (continuous) ----------

    /// Submit a campaign for curation. `owner` must be `≥ Basic` (`TierTooLow`); title/story/cid
    /// must be non-empty and within the input limits. Assigns `NextProjectId++`, status `Pending`,
    /// zeroed tallies; appends to `ProjectIds`. Curation — not registration — is the gate, so any
    /// verified wallet may submit.
    pub fn submit_project(
        env: Env,
        owner: Address,
        title: String,
        category: Category,
        story: String,
        image_cid: String,
        payout: Address,
    ) -> Result<u32, Error> {
        owner.require_auth();
        if title.len() == 0 || title.len() > MAX_TITLE_LEN || story.len() == 0
            || story.len() > MAX_STORY_LEN
        {
            return Err(Error::InvalidTitle);
        }
        if image_cid.len() == 0 || image_cid.len() > MAX_CID_LEN {
            return Err(Error::InvalidCid);
        }
        if tier_of(&env, &owner) < Tier::Basic {
            return Err(Error::TierTooLow);
        }

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextProjectId)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::NextProjectId, &(id + 1));

        let project = ProjectState {
            id,
            owner: owner.clone(),
            payout,
            title,
            category,
            story,
            image_cid,
            status: ProjectStatus::Pending,
            lifetime_direct: 0,
            unrounded_direct: 0,
            created_ledger: env.ledger().sequence() as u64,
        };
        put(&env, &DataKey::Project(id), &project);

        let mut ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::ProjectIds)
            .unwrap_or(Vec::new(&env));
        ids.push_back(id);
        put(&env, &DataKey::ProjectIds, &ids);

        env.events().publish((symbol_short!("submit"), id, owner), ());
        Ok(id)
    }

    /// Curator approves a `Pending` campaign → `Approved` (now contributable + matchable).
    pub fn approve_project(env: Env, id: u32) -> Result<(), Error> {
        require_curator(&env)?;
        let mut p = load_project(&env, id)?;
        if p.status != ProjectStatus::Pending {
            return Err(Error::ProjectNotPending);
        }
        p.status = ProjectStatus::Approved;
        put(&env, &DataKey::Project(id), &p);
        env.events().publish((symbol_short!("approve"), id), ());
        Ok(())
    }

    /// Curator rejects a `Pending` campaign → `Rejected`.
    pub fn reject_project(env: Env, id: u32) -> Result<(), Error> {
        require_curator(&env)?;
        let mut p = load_project(&env, id)?;
        if p.status != ProjectStatus::Pending {
            return Err(Error::ProjectNotPending);
        }
        p.status = ProjectStatus::Rejected;
        put(&env, &DataKey::Project(id), &p);
        env.events().publish((symbol_short!("reject"), id), ());
        Ok(())
    }

    /// The owner withdraws a campaign → `Cancelled`. Any already-collected direct donations remain
    /// claimable via `claim_unmatched`; only the campaign's future visibility ends here.
    pub fn cancel_project(env: Env, id: u32) -> Result<(), Error> {
        let mut p = load_project(&env, id)?;
        p.owner.require_auth();
        p.status = ProjectStatus::Cancelled;
        put(&env, &DataKey::Project(id), &p);
        env.events().publish((symbol_short!("cancel"), id), ());
        Ok(())
    }

    /// Keep-alive for a campaign's hot persistent entries. **Anyone** may call it — extending
    /// TTL is neutral upkeep, not a privileged write — so a long-lived campaign never expires
    /// mid-round even between contributions. Extends the campaign entry and, when a round is open,
    /// that campaign's per-round aggregate entries too (guarded by `has` so absent keys are skipped,
    /// never panicking). `UnknownProject` on an unknown id.
    pub fn bump_ttl(env: Env, project_id: u32) -> Result<(), Error> {
        load_project(&env, project_id)?; // fail cleanly on unknown ids rather than touching a missing key
        let ps = env.storage().persistent();
        ps.extend_ttl(
            &DataKey::Project(project_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
        if let Some((round_id, _)) = find_open_round(&env) {
            for key in [
                DataKey::RoundDirect(round_id, project_id),
                DataKey::RoundSumSqrt(round_id, project_id),
                DataKey::RoundDonorCount(round_id, project_id),
            ] {
                if ps.has(&key) {
                    ps.extend_ttl(&key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
                }
            }
        }
        Ok(())
    }
}
