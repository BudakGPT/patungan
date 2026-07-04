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

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Vec,
};

// Pure, chain-free quadratic-funding math (isqrt + weights + pool split). Consumed by
// `finalize` / `preview_matches` (task 1.6); unit-tested standalone here (task 1.3).
mod qf;

// Integration tests against the deployed client (setup path here in 1.4; `contribute`,
// finalize/disburse/views, the §5.6 edge cases and the §5.7 golden scenario land in 1.5–1.7).
#[cfg(test)]
mod test;

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
    // ---------- §4.3 Setup (task 1.4) ----------
    // `contribute` (1.5), finalize/disburse + the read views (1.6) land against the same
    // §4 surface; QF math (isqrt + compute_matches) lives in qf.rs (1.3).

    /// One-time setup (§4.3). The first caller authorizes as the operator (`admin`); only
    /// that address may later `register_*`/`finalize`/`disburse`. Opens the round with an
    /// empty pool and no projects. Re-init is rejected with `AlreadyInitialized` (§4.5).
    pub fn init(env: Env, admin: Address, token: Address, round_end: u64) -> Result<(), Error> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin,
                token,
                round_end,
                status: RoundStatus::Open,
                pool: 0,
            },
        );
        env.storage()
            .instance()
            .set(&DataKey::ProjectIds, &Vec::<u32>::new(&env));
        Ok(())
    }

    /// Add `who` to the verified-address registry (§4.3). Admin only (gated by
    /// `admin.require_auth()`). Idempotent — re-verifying an address is a harmless no-op.
    pub fn register_verified(env: Env, who: Address) -> Result<(), Error> {
        Self::require_admin(&env);
        env.storage().persistent().set(&DataKey::Verified(who), &true);
        Ok(())
    }

    /// Register a project (§4.3). Admin only. Rejects a duplicate `id` with
    /// `DuplicateProject` (§4.5); otherwise creates zeroed tallies and appends to
    /// `ProjectIds` so the frontend can enumerate every project.
    pub fn register_project(
        env: Env,
        id: u32,
        payout: Address,
        title: String,
        emoji: String,
    ) -> Result<(), Error> {
        Self::require_admin(&env);
        if env.storage().persistent().has(&DataKey::Project(id)) {
            return Err(Error::DuplicateProject);
        }
        env.storage().persistent().set(
            &DataKey::Project(id),
            &ProjectState {
                id,
                payout,
                title,
                emoji,
                direct: 0,
                donor_count: 0,
                matched: 0,
                disbursed: false,
            },
        );
        let mut ids: Vec<u32> = env.storage().instance().get(&DataKey::ProjectIds).unwrap();
        ids.push_back(id);
        env.storage().instance().set(&DataKey::ProjectIds, &ids);
        Ok(())
    }

    /// Deposit into the matching pool (§4.3). Callable by ANYONE (a real sponsor address can
    /// fund) — gated only by `from.require_auth()`. `amount` must be > 0 (`InvalidAmount`) and
    /// the round must still be `Open` (`RoundNotOpen`). Escrows the token into the contract
    /// (reused arisan `token::Client::transfer` idiom, §4.6) and grows `pool`.
    pub fn fund_pool(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut config = Self::load_config(&env);
        if config.status != RoundStatus::Open {
            return Err(Error::RoundNotOpen);
        }
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&from, &env.current_contract_address(), &amount);
        config.pool += amount;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    // ---------- internal helpers ----------

    fn load_config(env: &Env) -> Config {
        env.storage().instance().get(&DataKey::Config).unwrap()
    }

    /// Admin gate for the `register_*`/`finalize`/`disburse` entrypoints: the signatures
    /// carry no caller argument (§4.3), so the operator is authenticated by requiring the
    /// stored `admin`'s signature. An unauthorized caller is stopped by the auth framework;
    /// the `NotAdmin` variant (§4.5) is kept in the error set for the frontend's message map.
    fn require_admin(env: &Env) {
        Self::load_config(env).admin.require_auth();
    }
}
