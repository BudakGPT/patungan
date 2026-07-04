#![no_std]
//! Patungan — quadratic-funding matching pool on Soroban.
//!
//! Forked from `../prototype-arisan/contracts/arisan/` (task 1.1); this file now
//! hosts the **frozen §4 data surface** the whole app codes against — the types
//! (§4.1), the storage keys (§4.2), and the error enum (§4.5).
//!
//! The reused arisan primitives (the `token::Client` escrow pattern,
//! `require_auth()`, the `Config`/`DataKey` storage idiom, the `register`/client
//! test harness) carry forward into the entrypoints that land in tasks 1.4–1.6:
//! setup (`init`/`register_verified`/`register_project`/`fund_pool`), `contribute`,
//! and `finalize`/`disburse` + the read views. The QF math lands in `qf.rs` (1.3).

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, String};

// Pure, chain-free quadratic-funding math (isqrt + weights + pool split). Consumed by
// `finalize` / `preview_matches` (task 1.6); unit-tested standalone here (task 1.3).
mod qf;

// ---------- §4.1 Types ----------

/// Round-level configuration. `admin` is the operator (Sponsor + Admin); only it
/// may `finalize`/`disburse`/`register_*`. `pool` is the matching pool funded so far.
#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub admin: Address,   // the operator; only address allowed to finalize/disburse/register
    pub token: Address,   // the IDR-stand-in Stellar Asset Contract (SAC)
    pub round_end: u64,   // ledger timestamp after which contribute() is rejected
    pub status: RoundStatus,
    pub pool: i128,       // total matching pool currently funded
}

#[derive(Clone, Copy, PartialEq, Eq)]
#[contracttype]
pub enum RoundStatus {
    Open,
    Finalized,
}

/// Full public state of one project. `matched` is 0 until `finalize`; then it is
/// this project's QF share of the pool. `donor_count` counts DISTINCT verified donors.
#[derive(Clone)]
#[contracttype]
pub struct ProjectState {
    pub id: u32,
    pub payout: Address,
    pub title: String,       // short; e.g. "Atap Sekolah SDN 2"
    pub emoji: String,       // 1 char for the UI, e.g. "🏫"
    pub direct: i128,        // sum of all contributions to this project
    pub donor_count: u32,    // number of DISTINCT verified donors
    pub matched: i128,       // 0 until finalize; then this project's share of the pool
    pub disbursed: bool,     // true after disburse() paid out
}

// ---------- §4.2 Storage keys ----------

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    ProjectIds,                  // Vec<u32> — enumeration of registered projects
    Project(u32),                // ProjectState
    Donors(u32),                 // Vec<Address> — distinct donors of project (for QF sum)
    Contribution(u32, Address),  // i128 — CUMULATIVE amount from this donor to this project
    Verified(Address),           // bool — in the one-ID-per-address registry
}

// ---------- §4.5 Errors ----------

/// Explicit, off-chain-legible failure variants (prefer `Result<_, Error>` over
/// `panic!`). Discriminants are stable so the frontend can map them to messages.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
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
}

#[contract]
pub struct Patungan;

#[contractimpl]
impl Patungan {
    // Entrypoints land in tasks 1.4–1.6 against the §4 surface above:
    //   1.4 init / register_verified / register_project / fund_pool
    //   1.5 contribute (cumulative per-donor tagging)
    //   1.6 finalize / disburse / get_config / list_projects / get_project /
    //       is_verified / preview_matches
    // QF math (isqrt + compute_matches) lands in qf.rs (task 1.3).
}
