//! Integration tests against the deployed `PatunganClient`.
//!
//! Task 1.4 covers the §4.3 **setup path** — `init → register_verified → register_project →
//! fund_pool` — and its §4.5 rejections (AlreadyInitialized, DuplicateProject, InvalidAmount,
//! RoundNotOpen, plus the admin-auth gate). `contribute` (1.5), finalize/disburse + the read
//! views (1.6), and the §5.6 edge cases + §5.7 golden whale-vs-crowd scenario (1.7) append here.

#![cfg(test)]

use super::{Config, DataKey, Error, Patungan, PatunganClient, ProjectState, RoundStatus};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, String, Vec,
};

/// Register a fresh contract with a test SAC as its token, `init`-ed and Open with a far-future
/// `round_end`. Returns the admin, the token id, the client, and the SAC's mint client.
fn setup(env: &Env) -> (Address, Address, PatunganClient<'_>, token::StellarAssetClient<'_>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = sac.address();
    let token_admin = token::StellarAssetClient::new(env, &token_id);

    let contract_id = env.register(Patungan, ());
    let client = PatunganClient::new(env, &contract_id);
    client.init(&admin, &token_id, &u64::MAX);
    (admin, token_id, client, token_admin)
}

#[test]
fn setup_path_registers_and_funds() {
    let env = Env::default();
    let (admin, token_id, client, token_admin) = setup(&env);
    let contract_id = client.address.clone();

    // Fund the admin so it can deposit the matching pool.
    token_admin.mint(&admin, &100_000_000);

    // A verified donor, one project, and the pool funded.
    let donor = Address::generate(&env);
    client.register_verified(&donor);

    let payout = Address::generate(&env);
    client.register_project(
        &0u32,
        &payout,
        &String::from_str(&env, "Atap Sekolah SDN 2"),
        &String::from_str(&env, "\u{1F3EB}"),
    );

    client.fund_pool(&admin, &100_000_000);

    // The pool escrow actually moved token into the contract (arisan transfer idiom).
    let token = token::Client::new(&env, &token_id);
    assert_eq!(token.balance(&contract_id), 100_000_000);
    assert_eq!(token.balance(&admin), 0);

    // State reads (the public views land in 1.6, so read storage directly for now).
    env.as_contract(&contract_id, || {
        let cfg: Config = env.storage().instance().get(&DataKey::Config).unwrap();
        assert_eq!(cfg.admin, admin);
        assert_eq!(cfg.pool, 100_000_000);
        assert!(cfg.status == RoundStatus::Open);

        let ids: Vec<u32> = env.storage().instance().get(&DataKey::ProjectIds).unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.get(0).unwrap(), 0);

        let proj: ProjectState = env.storage().persistent().get(&DataKey::Project(0)).unwrap();
        assert_eq!(proj.id, 0);
        assert_eq!(proj.payout, payout);
        assert_eq!(proj.direct, 0);
        assert_eq!(proj.donor_count, 0);
        assert_eq!(proj.matched, 0);
        assert!(!proj.disbursed);

        let verified: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Verified(donor.clone()))
            .unwrap();
        assert!(verified);
    });
}

#[test]
fn register_verified_is_idempotent() {
    let env = Env::default();
    let (_admin, _token_id, client, _token_admin) = setup(&env);
    let donor = Address::generate(&env);

    client.register_verified(&donor);
    client.register_verified(&donor); // no-op; must not error or double-count

    env.as_contract(&client.address, || {
        let verified: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Verified(donor.clone()))
            .unwrap();
        assert!(verified);
    });
}

#[test]
fn init_twice_is_already_initialized() {
    let env = Env::default();
    let (admin, token_id, client, _token_admin) = setup(&env);
    assert_eq!(
        client.try_init(&admin, &token_id, &u64::MAX),
        Err(Ok(Error::AlreadyInitialized))
    );
}

#[test]
fn register_duplicate_project_rejected() {
    let env = Env::default();
    let (_admin, _token_id, client, _token_admin) = setup(&env);
    let payout = Address::generate(&env);

    client.register_project(
        &0u32,
        &payout,
        &String::from_str(&env, "First"),
        &String::from_str(&env, "\u{1F3EB}"),
    );
    assert_eq!(
        client.try_register_project(
            &0u32,
            &payout,
            &String::from_str(&env, "Duplicate id"),
            &String::from_str(&env, "\u{1F331}"),
        ),
        Err(Ok(Error::DuplicateProject))
    );
}

#[test]
fn fund_pool_rejects_non_positive_amount() {
    let env = Env::default();
    let (admin, _token_id, client, _token_admin) = setup(&env);
    assert_eq!(
        client.try_fund_pool(&admin, &0i128),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_fund_pool(&admin, &-1i128),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn fund_pool_rejects_when_round_not_open() {
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    token_admin.mint(&admin, &100);

    // `finalize` lands in 1.6; force the Finalized status directly to prove the guard.
    env.as_contract(&client.address, || {
        let mut cfg: Config = env.storage().instance().get(&DataKey::Config).unwrap();
        cfg.status = RoundStatus::Finalized;
        env.storage().instance().set(&DataKey::Config, &cfg);
    });

    assert_eq!(
        client.try_fund_pool(&admin, &100i128),
        Err(Ok(Error::RoundNotOpen))
    );
}

// ---------- contribute (task 1.5) ----------

/// Register a verified donor with `balance` minted, plus project `0` if it isn't there yet.
/// Keeps the contribute tests terse.
fn verified_donor(
    env: &Env,
    client: &PatunganClient<'_>,
    token_admin: &token::StellarAssetClient<'_>,
    balance: i128,
) -> Address {
    let donor = Address::generate(env);
    client.register_verified(&donor);
    token_admin.mint(&donor, &balance);
    donor
}

fn register_project0(env: &Env, client: &PatunganClient<'_>) {
    let payout = Address::generate(env);
    client.register_project(
        &0u32,
        &payout,
        &String::from_str(env, "Atap Sekolah SDN 2"),
        &String::from_str(env, "\u{1F3EB}"),
    );
}

#[test]
fn contribute_tags_direct_and_distinct_donor() {
    let env = Env::default();
    let (_admin, token_id, client, token_admin) = setup(&env);
    register_project0(&env, &client);
    let donor = verified_donor(&env, &client, &token_admin, 50_000);

    client.contribute(&donor, &0u32, &50_000);

    // Token escrowed donor -> contract.
    let token = token::Client::new(&env, &token_id);
    assert_eq!(token.balance(&client.address), 50_000);
    assert_eq!(token.balance(&donor), 0);

    env.as_contract(&client.address, || {
        let proj: ProjectState = env.storage().persistent().get(&DataKey::Project(0)).unwrap();
        assert_eq!(proj.direct, 50_000);
        assert_eq!(proj.donor_count, 1);

        let cum: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(0, donor.clone()))
            .unwrap();
        assert_eq!(cum, 50_000);

        let donors: Vec<Address> = env.storage().persistent().get(&DataKey::Donors(0)).unwrap();
        assert_eq!(donors.len(), 1);
        assert_eq!(donors.get(0).unwrap(), donor);
    });
}

#[test]
fn same_donor_twice_sums_cumulative_once() {
    // §5.2 correctness crux: two gifts from one donor sum to ONE cumulative total (sqrt'd once
    // at finalize) and the donor is counted ONCE — splitting a gift must not inflate breadth.
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    register_project0(&env, &client);
    let donor = verified_donor(&env, &client, &token_admin, 50_000);

    client.contribute(&donor, &0u32, &10_000);
    client.contribute(&donor, &0u32, &40_000);

    env.as_contract(&client.address, || {
        let proj: ProjectState = env.storage().persistent().get(&DataKey::Project(0)).unwrap();
        assert_eq!(proj.direct, 50_000);
        assert_eq!(proj.donor_count, 1, "repeat gift must not bump donor_count");

        let cum: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(0, donor.clone()))
            .unwrap();
        assert_eq!(cum, 50_000, "per-donor total is cumulative");

        let donors: Vec<Address> = env.storage().persistent().get(&DataKey::Donors(0)).unwrap();
        assert_eq!(donors.len(), 1, "donor listed once");
    });
}

#[test]
fn donor_across_two_projects_counted_in_each() {
    // §5.6: a donor to multiple projects is counted independently in each project's tally.
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    register_project0(&env, &client);
    let payout1 = Address::generate(&env);
    client.register_project(
        &1u32,
        &payout1,
        &String::from_str(&env, "Kebun"),
        &String::from_str(&env, "\u{1F331}"),
    );
    let donor = verified_donor(&env, &client, &token_admin, 30_000);

    client.contribute(&donor, &0u32, &10_000);
    client.contribute(&donor, &1u32, &20_000);

    env.as_contract(&client.address, || {
        let p0: ProjectState = env.storage().persistent().get(&DataKey::Project(0)).unwrap();
        let p1: ProjectState = env.storage().persistent().get(&DataKey::Project(1)).unwrap();
        assert_eq!(p0.donor_count, 1);
        assert_eq!(p0.direct, 10_000);
        assert_eq!(p1.donor_count, 1);
        assert_eq!(p1.direct, 20_000);
    });
}

#[test]
fn contribute_rejects_unverified_donor() {
    let env = Env::default();
    let (_admin, _token_id, client, _token_admin) = setup(&env);
    register_project0(&env, &client);
    let donor = Address::generate(&env); // never registered

    assert_eq!(
        client.try_contribute(&donor, &0u32, &10_000),
        Err(Ok(Error::NotVerified))
    );
}

#[test]
fn contribute_rejects_unknown_project() {
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    let donor = verified_donor(&env, &client, &token_admin, 10_000);

    assert_eq!(
        client.try_contribute(&donor, &99u32, &10_000),
        Err(Ok(Error::UnknownProject))
    );
}

#[test]
fn contribute_rejects_non_positive_amount() {
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    register_project0(&env, &client);
    let donor = verified_donor(&env, &client, &token_admin, 10_000);

    assert_eq!(
        client.try_contribute(&donor, &0u32, &0i128),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_contribute(&donor, &0u32, &-1i128),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn contribute_rejects_when_round_finalized() {
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    register_project0(&env, &client);
    let donor = verified_donor(&env, &client, &token_admin, 10_000);

    // `finalize` lands in 1.6; force Finalized directly to prove the guard.
    env.as_contract(&client.address, || {
        let mut cfg: Config = env.storage().instance().get(&DataKey::Config).unwrap();
        cfg.status = RoundStatus::Finalized;
        env.storage().instance().set(&DataKey::Config, &cfg);
    });

    assert_eq!(
        client.try_contribute(&donor, &0u32, &10_000),
        Err(Ok(Error::RoundClosed))
    );
}

#[test]
fn contribute_rejects_after_round_end() {
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    register_project0(&env, &client);
    let donor = verified_donor(&env, &client, &token_admin, 10_000);

    // Move round_end into the past relative to the ledger clock.
    env.as_contract(&client.address, || {
        let mut cfg: Config = env.storage().instance().get(&DataKey::Config).unwrap();
        cfg.round_end = 100;
        env.storage().instance().set(&DataKey::Config, &cfg);
    });
    env.ledger().set_timestamp(200);

    assert_eq!(
        client.try_contribute(&donor, &0u32, &10_000),
        Err(Ok(Error::RoundClosed))
    );
}

#[test]
fn register_verified_requires_admin_auth() {
    // The admin gate is `admin.require_auth()`; an unauthorized caller is stopped by the auth
    // framework (surfacing as an invoke error, not `Error::NotAdmin`). Assert the rejection.
    let env = Env::default();
    let (_admin, _token_id, client, _token_admin) = setup(&env);

    env.set_auths(&[]); // clear the blanket mock: nothing is authorized now
    let who = Address::generate(&env);
    assert!(client.try_register_verified(&who).is_err());
}

// ---------- finalize / disburse / views (task 1.6) ----------

/// Build a two-project round, funded and contributed but NOT yet finalised, with distinct QF
/// weights so the split is unambiguous. Pool = 100. p0: two donors (4 + 4) → weight
/// `(isqrt(4)+isqrt(4))² = 16`; p1: one donor (9) → weight `isqrt(9)² = 9`. total_weight = 25,
/// so `matched = [100·16/25, 100·9/25] = [64, 36]` (Σ == pool, no remainder). Returns the two
/// payout addresses so disburse tests can assert where the money lands.
fn finalize_scenario(
    env: &Env,
    client: &PatunganClient<'_>,
    admin: &Address,
    token_admin: &token::StellarAssetClient<'_>,
) -> (Address, Address) {
    token_admin.mint(admin, &100);
    client.fund_pool(admin, &100);

    let payout0 = Address::generate(env);
    client.register_project(
        &0u32,
        &payout0,
        &String::from_str(env, "Atap Sekolah"),
        &String::from_str(env, "\u{1F3EB}"),
    );
    let payout1 = Address::generate(env);
    client.register_project(
        &1u32,
        &payout1,
        &String::from_str(env, "Sumur"),
        &String::from_str(env, "\u{1F4A7}"),
    );

    let a = verified_donor(env, client, token_admin, 4);
    let b = verified_donor(env, client, token_admin, 4);
    let c = verified_donor(env, client, token_admin, 9);
    client.contribute(&a, &0u32, &4);
    client.contribute(&b, &0u32, &4);
    client.contribute(&c, &1u32, &9);
    (payout0, payout1)
}

#[test]
fn finalize_writes_matches_and_preview_agrees() {
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    finalize_scenario(&env, &client, &admin, &token_admin);

    // Live projection BEFORE finalize: p0 (two donors) beats p1 (one donor).
    let before = client.preview_matches();
    assert_eq!(before.len(), 2);
    assert_eq!(before.get(0).unwrap(), (0u32, 64i128));
    assert_eq!(before.get(1).unwrap(), (1u32, 36i128));

    client.finalize();

    let cfg = client.get_config();
    assert!(cfg.status == RoundStatus::Finalized);

    let projects = client.list_projects();
    assert_eq!(projects.get(0).unwrap().matched, 64);
    assert_eq!(projects.get(1).unwrap().matched, 36);
    // Exact pool conservation (§5.3 remainder rule).
    assert_eq!(
        projects.get(0).unwrap().matched + projects.get(1).unwrap().matched,
        cfg.pool
    );

    // §10 determinism: preview_matches AFTER finalize == the stored matched[] == the pre-finalize
    // projection. finalize and preview_matches walk the same computation over the same state.
    let after = client.preview_matches();
    assert_eq!(after, before);
}

#[test]
fn finalize_twice_is_already_finalized() {
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    finalize_scenario(&env, &client, &admin, &token_admin);
    client.finalize();
    assert_eq!(client.try_finalize(), Err(Ok(Error::AlreadyFinalized)));
}

#[test]
fn finalize_with_no_contributions_is_nothing_to_match() {
    // §5.6: total_weight == 0 → NothingToMatch; the pool stays and the round stays Open.
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    token_admin.mint(&admin, &100);
    client.fund_pool(&admin, &100);
    register_project0(&env, &client); // registered but zero donors

    assert_eq!(client.try_finalize(), Err(Ok(Error::NothingToMatch)));

    let cfg = client.get_config();
    assert_eq!(cfg.pool, 100, "pool must be untouched");
    assert!(cfg.status == RoundStatus::Open, "round must stay Open");
}

#[test]
fn disburse_pays_direct_plus_matched() {
    let env = Env::default();
    let (admin, token_id, client, token_admin) = setup(&env);
    let (payout0, payout1) = finalize_scenario(&env, &client, &admin, &token_admin);
    client.finalize();

    let token = token::Client::new(&env, &token_id);
    // p0: direct 8 + matched 64 = 72; p1: direct 9 + matched 36 = 45.
    client.disburse(&0u32);
    assert_eq!(token.balance(&payout0), 72);
    assert!(client.get_project(&0u32).disbursed);

    client.disburse(&1u32);
    assert_eq!(token.balance(&payout1), 45);
    // Contract fully drained: the pool (100) + all direct (17) has left the escrow.
    assert_eq!(token.balance(&client.address), 0);
}

#[test]
fn disburse_before_finalize_rejected() {
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    finalize_scenario(&env, &client, &admin, &token_admin);
    assert_eq!(client.try_disburse(&0u32), Err(Ok(Error::NotFinalized)));
}

#[test]
fn disburse_twice_rejected() {
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    finalize_scenario(&env, &client, &admin, &token_admin);
    client.finalize();
    client.disburse(&0u32);
    assert_eq!(client.try_disburse(&0u32), Err(Ok(Error::AlreadyDisbursed)));
}

#[test]
fn disburse_unknown_project_rejected() {
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    finalize_scenario(&env, &client, &admin, &token_admin);
    client.finalize();
    assert_eq!(client.try_disburse(&99u32), Err(Ok(Error::UnknownProject)));
}

#[test]
fn views_report_config_projects_and_verification() {
    let env = Env::default();
    let (admin, token_id, client, token_admin) = setup(&env);
    token_admin.mint(&admin, &100);
    client.fund_pool(&admin, &100);
    register_project0(&env, &client);
    let donor = verified_donor(&env, &client, &token_admin, 10_000);
    client.contribute(&donor, &0u32, &10_000);

    let cfg = client.get_config();
    assert_eq!(cfg.admin, admin);
    assert_eq!(cfg.token, token_id);
    assert_eq!(cfg.pool, 100);
    assert!(cfg.status == RoundStatus::Open);

    assert_eq!(client.list_projects().len(), 1);
    let p = client.get_project(&0u32);
    assert_eq!(p.direct, 10_000);
    assert_eq!(p.donor_count, 1);

    assert!(client.is_verified(&donor));
    assert!(!client.is_verified(&Address::generate(&env)));
}

// ---------- §5.7 golden + remaining §5.6 edge cases (task 1.7) ----------

/// Add `n` fresh verified donors, each contributing exactly `amount` to `project_id`.
/// This is the demo's breadth engine — many small gifts vs one whale (§5.7).
fn crowd(
    env: &Env,
    client: &PatunganClient<'_>,
    token_admin: &token::StellarAssetClient<'_>,
    project_id: u32,
    n: u32,
    amount: i128,
) {
    for _ in 0..n {
        let donor = verified_donor(env, client, token_admin, amount);
        client.contribute(&donor, &project_id, &amount);
    }
}

#[test]
fn golden_whale_vs_crowd_crowd_wins_the_pool() {
    // §5.7 — THE PRODUCT'S PROOF, end-to-end through the contract (not just qf.rs). Three
    // projects each raise the SAME Rp1jt direct, but with different breadth:
    //   🏫 School: 100 donors × 10_000  → weight (100·isqrt(10_000))² = (100·100)²  = 100_000_000
    //   🌱 Garden:  10 donors × 100_000 → weight  (10·isqrt(100_000))² = (10·316)²  =   9_985_600
    //   💧 Well:     1 donor  × 1_000_000 → weight    (isqrt(1_000_000))² = 1000²    =   1_000_000
    // total_weight = 110_985_600, pool = 100_000_000. The crowd (School) must take ~90% of the
    // pool while the whale (Well) gets ~0.9M — the whole reveal in one assert block. Exact
    // per-project figures depend on isqrt truncation, so assert ordering/magnitude + exact
    // pool conservation, not the decimals (§5.7).
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    let pool = 100_000_000i128;
    token_admin.mint(&admin, &pool);
    client.fund_pool(&admin, &pool);

    let school_payout = Address::generate(&env);
    client.register_project(
        &0u32,
        &school_payout,
        &String::from_str(&env, "Atap Sekolah"),
        &String::from_str(&env, "\u{1F3EB}"),
    );
    let garden_payout = Address::generate(&env);
    client.register_project(
        &1u32,
        &garden_payout,
        &String::from_str(&env, "Kebun Desa"),
        &String::from_str(&env, "\u{1F331}"),
    );
    let well_payout = Address::generate(&env);
    client.register_project(
        &2u32,
        &well_payout,
        &String::from_str(&env, "Sumur"),
        &String::from_str(&env, "\u{1F4A7}"),
    );

    crowd(&env, &client, &token_admin, 0, 100, 10_000); // School
    crowd(&env, &client, &token_admin, 1, 10, 100_000); // Garden
    crowd(&env, &client, &token_admin, 2, 1, 1_000_000); // Well

    // Each project raised the identical Rp1jt direct — only breadth differs.
    assert_eq!(client.get_project(&0u32).direct, 1_000_000);
    assert_eq!(client.get_project(&1u32).direct, 1_000_000);
    assert_eq!(client.get_project(&2u32).direct, 1_000_000);
    assert_eq!(client.get_project(&0u32).donor_count, 100);
    assert_eq!(client.get_project(&1u32).donor_count, 10);
    assert_eq!(client.get_project(&2u32).donor_count, 1);

    client.finalize();

    let projects = client.list_projects();
    let school = projects.get(0).unwrap().matched;
    let garden = projects.get(1).unwrap().matched;
    let well = projects.get(2).unwrap().matched;

    // Ordering: School ≫ Garden ≫ Well — breadth beats depth.
    assert!(school > garden, "School {school} must beat Garden {garden}");
    assert!(garden > well, "Garden {garden} must beat Well {well}");
    // Magnitude: the crowd dominates (≳90%), the whale is a rounding footnote (≲1M+dust).
    assert!(school > pool * 4 / 5, "School {school} must dominate the pool {pool}");
    assert!(well < 2_000_000, "Well {well} must stay a footnote");
    // Exact pool conservation — every unit of the pool is allocated (§5.3 remainder rule).
    assert_eq!(school + garden + well, pool);

    // §10 determinism: the live projection equals the persisted split.
    let after = client.preview_matches();
    assert_eq!(after.get(0).unwrap(), (0u32, school));
    assert_eq!(after.get(1).unwrap(), (1u32, garden));
    assert_eq!(after.get(2).unwrap(), (2u32, well));
}

#[test]
fn zero_donor_project_gets_zero_match() {
    // §5.6 row 1: one project among active ones has NO donors → weight 0 → matched 0, with no
    // divide-by-zero, and the funded project takes the whole pool.
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    token_admin.mint(&admin, &100);
    client.fund_pool(&admin, &100);

    register_project0(&env, &client); // active
    let sepi_payout = Address::generate(&env);
    client.register_project(
        &1u32,
        &sepi_payout,
        &String::from_str(&env, "Proyek Sepi"),
        &String::from_str(&env, "\u{1F4A7}"),
    );

    let donor = verified_donor(&env, &client, &token_admin, 10_000);
    client.contribute(&donor, &0u32, &10_000);

    client.finalize();
    let projects = client.list_projects();
    assert_eq!(projects.get(1).unwrap().matched, 0, "0-donor project matched 0");
    assert_eq!(projects.get(0).unwrap().matched, 100, "sole funded project takes the pool");
}

#[test]
fn finalize_assigns_remainder_to_largest_weight() {
    // §5.6 remainder row: pool 7 does not divide evenly. p0 has two donors×1 → weight
    // (isqrt(1)+isqrt(1))² = 4; p1 has one donor×1 → weight 1; total_weight = 5.
    //   p0 share = ⌊7·4/5⌋ = 5, p1 share = ⌊7·1/5⌋ = 1, allocated 6, dust 1 → largest weight p0.
    // So p0 = 6, p1 = 1, Σ = 7 (§5.3).
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    token_admin.mint(&admin, &7);
    client.fund_pool(&admin, &7);

    register_project0(&env, &client);
    let payout1 = Address::generate(&env);
    client.register_project(
        &1u32,
        &payout1,
        &String::from_str(&env, "Sumur"),
        &String::from_str(&env, "\u{1F4A7}"),
    );

    let a = verified_donor(&env, &client, &token_admin, 1);
    let b = verified_donor(&env, &client, &token_admin, 1);
    let c = verified_donor(&env, &client, &token_admin, 1);
    client.contribute(&a, &0u32, &1);
    client.contribute(&b, &0u32, &1);
    client.contribute(&c, &1u32, &1);

    client.finalize();
    let projects = client.list_projects();
    assert_eq!(projects.get(0).unwrap().matched, 6, "largest weight gets the dust");
    assert_eq!(projects.get(1).unwrap().matched, 1);
    assert_eq!(
        projects.get(0).unwrap().matched + projects.get(1).unwrap().matched,
        7,
        "pool fully allocated"
    );
}
