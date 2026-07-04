//! Integration tests against the deployed `PatunganClient`.
//!
//! Task 1.4 covers the §4.3 **setup path** — `init → register_verified → register_project →
//! fund_pool` — and its §4.5 rejections (AlreadyInitialized, DuplicateProject, InvalidAmount,
//! RoundNotOpen, plus the admin-auth gate). `contribute` (1.5), finalize/disburse + the read
//! views (1.6), and the §5.6 edge cases + §5.7 golden whale-vs-crowd scenario (1.7) append here.

#![cfg(test)]

use super::{Config, DataKey, Error, Patungan, PatunganClient, ProjectState, RoundStatus};
use soroban_sdk::{testutils::Address as _, token, Address, Env, String, Vec};

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
