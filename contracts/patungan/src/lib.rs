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

// The QF pool split (`finalize`/`preview_matches`) reads a project's per-donor totals out of
// storage and feeds them to `qf`'s slice-based math (`&[i128]`/`&[u128]`). Bridging soroban
// storage `Vec`s to those slices needs a transient heap `Vec`; soroban-sdk installs a wasm
// global allocator, so `alloc` is available under `#![no_std]`.
extern crate alloc;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    String, Vec,
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
    SumSqrt(u32),                // u128 — running Σ isqrt(per-donor cumulative) for the project,
                                 // maintained by `contribute` so the QF split reads ONE aggregate
                                 // per project instead of every per-donor entry (tx-footprint safe)
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
        config.pool = config.pool.checked_add(amount).ok_or(Error::InvalidAmount)?;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish((symbol_short!("fund"), from), amount);
        Ok(())
    }

    // ---------- §4.3 Round (task 1.5) ----------

    /// Contribute to a project's direct total (§4.3). `donor.require_auth()`. Rejects when
    /// `amount <= 0` (`InvalidAmount`), the round is closed (`RoundClosed`: status != Open, or
    /// `now > round_end`), the donor is not in the verified registry (`NotVerified`), or the
    /// project is unknown (`UnknownProject`). Escrows the token donor -> contract, then tags the
    /// contribution **cumulatively per donor** (§5.2): `Contribution(project_id, donor) +=
    /// amount`, and — only when this donor is NEW to this project — appends to `Donors(project_id)`
    /// and bumps `donor_count` (the DISTINCT-donor breadth QF rewards). `direct += amount` always.
    pub fn contribute(
        env: Env,
        donor: Address,
        project_id: u32,
        amount: i128,
    ) -> Result<(), Error> {
        donor.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let config = Self::load_config(&env);
        if config.status != RoundStatus::Open {
            return Err(Error::RoundClosed);
        }
        if env.ledger().timestamp() > config.round_end {
            return Err(Error::RoundClosed);
        }
        if !env
            .storage()
            .persistent()
            .get(&DataKey::Verified(donor.clone()))
            .unwrap_or(false)
        {
            return Err(Error::NotVerified);
        }
        let mut project: ProjectState =
            match env.storage().persistent().get(&DataKey::Project(project_id)) {
                Some(p) => p,
                None => return Err(Error::UnknownProject),
            };

        // Escrow the contribution into the contract (reused arisan transfer idiom, §4.6).
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // CUMULATIVE per-donor tagging (§5.2): sum this donor's cumulative total to the project
        // so the QF weight `isqrt`s that summed total ONCE. Since every contribution is `> 0`, a
        // returning donor always has `prior > 0`; only a first-time donor (`prior == 0`) grows the
        // distinct-donor set and `donor_count` — a repeat gift must not inflate QF breadth.
        let contrib_key = DataKey::Contribution(project_id, donor.clone());
        let prior: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);
        if prior == 0 {
            let mut donors: Vec<Address> = env
                .storage()
                .persistent()
                .get(&DataKey::Donors(project_id))
                .unwrap_or_else(|| Vec::new(&env));
            donors.push_back(donor.clone());
            env.storage()
                .persistent()
                .set(&DataKey::Donors(project_id), &donors);
            project.donor_count = project
                .donor_count
                .checked_add(1)
                .ok_or(Error::InvalidAmount)?;
        }
        let new_total = prior.checked_add(amount).ok_or(Error::InvalidAmount)?;
        env.storage().persistent().set(&contrib_key, &new_total);

        // Maintain the running Σ√ aggregate (§5.2 semantics unchanged — always √ of the
        // CUMULATIVE per-donor total): swap this donor's old isqrt for the new one. This keeps
        // `finalize`/`preview_matches` at ONE storage read per project instead of one per donor,
        // so the QF split fits Soroban's per-tx ledger-entry footprint at any crowd size.
        let sum_key = DataKey::SumSqrt(project_id);
        let sum_sqrt: u128 = env.storage().persistent().get(&sum_key).unwrap_or(0);
        let new_sum_sqrt = sum_sqrt
            .checked_sub(qf::isqrt(prior as u128))
            .and_then(|s| s.checked_add(qf::isqrt(new_total as u128)))
            .ok_or(Error::InvalidAmount)?;
        env.storage().persistent().set(&sum_key, &new_sum_sqrt);

        project.direct = project.direct.checked_add(amount).ok_or(Error::InvalidAmount)?;
        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);
        env.events()
            .publish((symbol_short!("contrib"), project_id, donor), amount);
        Ok(())
    }

    // ---------- §4.3 Finalisation (task 1.6) ----------

    /// Close the round and compute the QF match split (§4.3, §5). Admin only. Rejects a re-run
    /// once `status == Finalized` (`AlreadyFinalized`). Computes `matched[]` from the CURRENT
    /// state via the same deterministic path `preview_matches` uses (§10), writes each
    /// `ProjectState.matched`, and flips `status` to `Finalized`. Pure state transition — no
    /// transfers. If nobody has contributed (`total_weight == 0`) the QF math returns
    /// `NothingToMatch` (§5.6): the error propagates, the pool stays, and status stays `Open`.
    pub fn finalize(env: Env) -> Result<(), Error> {
        Self::require_admin(&env);
        let mut config = Self::load_config(&env);
        if config.status != RoundStatus::Open {
            return Err(Error::AlreadyFinalized);
        }
        // Runs the QF split on live state; `NothingToMatch` short-circuits before any write, so a
        // no-contribution round is left untouched and still `Open`.
        let matches = Self::compute_matches_now(&env)?;
        for (id, matched) in matches.iter() {
            let mut project: ProjectState =
                env.storage().persistent().get(&DataKey::Project(id)).unwrap();
            project.matched = matched;
            env.storage().persistent().set(&DataKey::Project(id), &project);
            env.events().publish((symbol_short!("match"), id), matched);
        }
        config.status = RoundStatus::Finalized;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish((symbol_short!("final"),), config.pool);
        Ok(())
    }

    /// Pay a finalised project out (§4.3). Admin only. Rejects if the round is not yet finalised
    /// (`NotFinalized`), the project is unknown (`UnknownProject`), or it was already paid
    /// (`AlreadyDisbursed`). Transfers `direct + matched` from the contract escrow to the
    /// project's `payout` (reused arisan `token::Client::transfer` idiom, §4.6) and marks it
    /// `disbursed` so a re-run is a rejected no-op (§10 idempotency).
    pub fn disburse(env: Env, project_id: u32) -> Result<(), Error> {
        Self::require_admin(&env);
        let config = Self::load_config(&env);
        if config.status != RoundStatus::Finalized {
            return Err(Error::NotFinalized);
        }
        let mut project: ProjectState =
            match env.storage().persistent().get(&DataKey::Project(project_id)) {
                Some(p) => p,
                None => return Err(Error::UnknownProject),
            };
        if project.disbursed {
            return Err(Error::AlreadyDisbursed);
        }
        let amount = project
            .direct
            .checked_add(project.matched)
            .ok_or(Error::InvalidAmount)?;
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&env.current_contract_address(), &project.payout, &amount);
        project.disbursed = true;
        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);
        env.events()
            .publish((symbol_short!("payout"), project_id), amount);
        Ok(())
    }

    // ---------- §4.3 Views (read-only; consumed by the frontend) ----------

    /// The round config (§4.3): admin, token, round_end, status, pool.
    pub fn get_config(env: Env) -> Config {
        Self::load_config(&env)
    }

    /// Full state of every registered project, in registration order (§4.3).
    pub fn list_projects(env: Env) -> Vec<ProjectState> {
        let ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::ProjectIds)
            .unwrap_or_else(|| Vec::new(&env));
        let mut out = Vec::new(&env);
        for id in ids.iter() {
            let project: ProjectState =
                env.storage().persistent().get(&DataKey::Project(id)).unwrap();
            out.push_back(project);
        }
        out
    }

    /// One project's state (§4.3). Panics on an unknown id — the frontend catches the RPC error
    /// and renders its not-found state (Epic A3); the frozen `-> ProjectState` return leaves no
    /// room for an in-band error.
    pub fn get_project(env: Env, id: u32) -> ProjectState {
        env.storage().persistent().get(&DataKey::Project(id)).unwrap()
    }

    /// Whether `who` is in the verified-address registry (§4.3). Powers the "✓ Terverifikasi"
    /// badge (Epic E1).
    pub fn is_verified(env: Env, who: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Verified(who))
            .unwrap_or(false)
    }

    /// LIVE projected QF split on the CURRENT state (§4.3) — lets the UI show the whale-vs-crowd
    /// gap before finalise. Runs the exact same computation `finalize` writes, so after finalise
    /// it equals the stored `matched[]` (§10 determinism). Before any contribution the QF math
    /// yields `NothingToMatch`; since this view can't return an error (frozen `-> Vec<...>`), it
    /// surfaces that as an empty vec so the frontend renders "—" for every projected match.
    pub fn preview_matches(env: Env) -> Vec<(u32, i128)> {
        Self::compute_matches_now(&env).unwrap_or_else(|_| Vec::new(&env))
    }

    // ---------- internal helpers ----------

    /// The one canonical QF computation over the current on-chain state (§5), shared by
    /// `finalize` (which persists it) and `preview_matches` (which returns it) so the two are
    /// deterministic and always agree (§10). For each project (in `ProjectIds` order) it reads
    /// the running `SumSqrt` aggregate `contribute` maintains (Σ isqrt of each distinct donor's
    /// CUMULATIVE total, §5.2) and squares it via `qf::weight_from_sum_sqrt` — ONE storage read
    /// per project, so the split's tx footprint is O(projects) regardless of crowd size. Then it
    /// splits `pool` proportional to the weights with the largest-weight remainder rule (§5.3)
    /// via `qf::compute_matches`. Returns `NothingToMatch` when no project has a donor
    /// (`total_weight == 0`, §5.6). The transient heap `Vec`s bridge soroban storage to `qf`'s
    /// slice API and never touch chain state.
    fn compute_matches_now(env: &Env) -> Result<Vec<(u32, i128)>, Error> {
        let config = Self::load_config(env);
        let ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::ProjectIds)
            .unwrap_or_else(|| Vec::new(env));

        let mut weights: alloc::vec::Vec<u128> = alloc::vec::Vec::new();
        for id in ids.iter() {
            let sum_sqrt: u128 = env
                .storage()
                .persistent()
                .get(&DataKey::SumSqrt(id))
                .unwrap_or(0);
            weights.push(qf::weight_from_sum_sqrt(sum_sqrt)?);
        }

        let mut matched = alloc::vec![0i128; weights.len()];
        qf::compute_matches(config.pool, &weights, &mut matched)?;

        let mut out = Vec::new(env);
        for (i, id) in ids.iter().enumerate() {
            out.push_back((id, matched[i]));
        }
        Ok(out)
    }

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
