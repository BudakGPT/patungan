//! Integration tests against the deployed `PatunganClient`.
//!
//! Covers the full surface: `init` and its `AlreadyInitialized` guard, the admin-only role
//! rotations, attester-only `set_verification`, `submit_project` (tier + input-limit gates), the
//! curation state machine (`approve`/`reject`/`cancel`), the round machinery
//! (`open_round`/`fund_pool`/`finalize`/`cancel`), per-round QF tagging, claim/views, and the named
//! correctness proofs (anti-sybil cumulative-sqrt, whale-vs-crowd, money conservation across
//! rounds, tier gates, out-of-scope categories, and TTL keep-alive).

#![cfg(test)]

use super::{
    Category, Config, DataKey, Error, Patungan, PatunganClient, ProjectState, ProjectStatus,
    RoundState, RoundStatus, Tier,
};
use soroban_sdk::{
    testutils::Address as _, token, Address, Env, String, Vec,
};

/// Approve a fresh `Basic`-owned campaign and return a `Basic` donor funded with `bal` tokens,
/// plus the campaign id — the common setup for the round/contribute tests below.
fn approved_with_donor(
    env: &Env,
    client: &PatunganClient<'_>,
    token_admin: &token::StellarAssetClient<'_>,
    bal: i128,
) -> (u32, Address) {
    let (_owner, _payout, id) = submit_basic(env, client);
    client.approve_project(&id);
    let donor = Address::generate(env);
    client.set_verification(&donor, &Tier::Basic);
    token_admin.mint(&donor, &bal);
    (id, donor)
}

/// A registered, `init`-ed contract with a test SAC as its escrow token. The admin doubles as
/// attester and curator (the testnet posture: the operator holds every key), so tests can attest
/// tiers and curate under the blanket `mock_all_auths`. Returns admin, token id, client, mint.
fn setup(env: &Env) -> (Address, Address, PatunganClient<'_>, token::StellarAssetClient<'_>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = sac.address();
    let token_admin = token::StellarAssetClient::new(env, &token_id);

    let contract_id = env.register(Patungan, ());
    let client = PatunganClient::new(env, &contract_id);
    client.init(&admin, &token_id, &admin, &admin); // attester = curator = admin (testnet posture)
    (admin, token_id, client, token_admin)
}

fn title(env: &Env) -> String {
    String::from_str(env, "Atap Sekolah SDN 2")
}
fn story(env: &Env) -> String {
    String::from_str(env, "Memperbaiki atap kelas yang bocor agar anak-anak bisa belajar.")
}
fn cid(env: &Env) -> String {
    String::from_str(env, "bafybeigdyrztp5m3example000000000000000000000000000000")
}

/// Submit a campaign owned by a freshly-attested `Basic` owner; returns (owner, payout, id).
fn submit_basic(
    env: &Env,
    client: &PatunganClient<'_>,
) -> (Address, Address, u32) {
    let owner = Address::generate(env);
    client.set_verification(&owner, &Tier::Basic);
    let payout = Address::generate(env);
    let id = client.submit_project(
        &owner,
        &title(env),
        &Category::EducationHealth,
        &story(env),
        &cid(env),
        &payout,
    );
    (owner, payout, id)
}

// ---------- setup & roles ----------

#[test]
fn init_twice_is_already_initialized() {
    let env = Env::default();
    let (admin, token_id, client, _mint) = setup(&env);
    assert_eq!(
        client.try_init(&admin, &token_id, &admin, &admin),
        Err(Ok(Error::AlreadyInitialized))
    );
}

#[test]
fn init_stores_all_roles() {
    let env = Env::default();
    let (admin, token_id, client, _mint) = setup(&env);
    env.as_contract(&client.address, || {
        let s = env.storage().instance();
        assert_eq!(s.get::<_, Address>(&DataKey::Admin).unwrap(), admin);
        assert_eq!(s.get::<_, Address>(&DataKey::Curator).unwrap(), admin);
        assert_eq!(s.get::<_, Address>(&DataKey::Attester).unwrap(), admin);
        assert_eq!(s.get::<_, Address>(&DataKey::Token).unwrap(), token_id);
        assert_eq!(s.get::<_, u32>(&DataKey::NextProjectId).unwrap(), 0);
    });
}

#[test]
fn set_roles_rotate_and_require_admin() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let new_curator = Address::generate(&env);
    let new_attester = Address::generate(&env);

    client.set_curator(&new_curator);
    client.set_attester(&new_attester);
    env.as_contract(&client.address, || {
        let s = env.storage().instance();
        assert_eq!(s.get::<_, Address>(&DataKey::Curator).unwrap(), new_curator);
        assert_eq!(s.get::<_, Address>(&DataKey::Attester).unwrap(), new_attester);
    });

    // Without the admin's authorization the rotation is refused by the auth framework.
    env.set_auths(&[]);
    assert!(client.try_set_curator(&Address::generate(&env)).is_err());
}

#[test]
fn set_verification_writes_tier_and_view_reads_it() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let who = Address::generate(&env);

    assert!(client.verification_tier(&who) == Tier::None);
    client.set_verification(&who, &Tier::Institution);
    assert!(client.verification_tier(&who) == Tier::Institution);
}

// ---------- campaign lifecycle ----------

#[test]
fn submit_creates_pending_and_appends_id() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let (owner, payout, id) = submit_basic(&env, &client);
    assert_eq!(id, 0);

    env.as_contract(&client.address, || {
        let p: ProjectState = env.storage().persistent().get(&DataKey::Project(0)).unwrap();
        assert_eq!(p.owner, owner);
        assert_eq!(p.payout, payout);
        assert!(p.status == ProjectStatus::Pending);
        assert_eq!(p.lifetime_direct, 0);
        assert_eq!(p.unrounded_direct, 0);

        let ids: Vec<u32> = env.storage().persistent().get(&DataKey::ProjectIds).unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.get(0).unwrap(), 0);
        // NextProjectId advanced past the assigned id.
        assert_eq!(env.storage().instance().get::<_, u32>(&DataKey::NextProjectId).unwrap(), 1);
    });
}

#[test]
fn submit_requires_basic_tier() {
    // Tier proof for submit: an unverified owner (`None`) is rejected with TierTooLow.
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let owner = Address::generate(&env); // never attested → Tier::None
    let payout = Address::generate(&env);
    assert_eq!(
        client.try_submit_project(
            &owner,
            &title(&env),
            &Category::EducationHealth,
            &story(&env),
            &cid(&env),
            &payout,
        ),
        Err(Ok(Error::TierTooLow))
    );
}

#[test]
fn submit_rejects_empty_and_oversized_inputs() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let owner = Address::generate(&env);
    client.set_verification(&owner, &Tier::Basic);
    let payout = Address::generate(&env);

    let empty = String::from_str(&env, "");
    // Empty title → InvalidTitle.
    assert_eq!(
        client.try_submit_project(
            &owner, &empty, &Category::EducationHealth, &story(&env), &cid(&env), &payout,
        ),
        Err(Ok(Error::InvalidTitle))
    );
    // Empty cid → InvalidCid.
    assert_eq!(
        client.try_submit_project(
            &owner, &title(&env), &Category::EducationHealth, &story(&env), &empty, &payout,
        ),
        Err(Ok(Error::InvalidCid))
    );
    // Over-limit title (>96) → InvalidTitle.
    let long = String::from_str(&env, "x".repeat(97).as_str());
    assert_eq!(
        client.try_submit_project(
            &owner, &long, &Category::EducationHealth, &story(&env), &cid(&env), &payout,
        ),
        Err(Ok(Error::InvalidTitle))
    );
}

#[test]
fn approve_and_reject_enforce_pending() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let (_o, _p, id) = submit_basic(&env, &client);

    client.approve_project(&id);
    env.as_contract(&client.address, || {
        let p: ProjectState = env.storage().persistent().get(&DataKey::Project(id)).unwrap();
        assert!(p.status == ProjectStatus::Approved);
    });
    // Re-approving a non-Pending campaign is refused.
    assert_eq!(client.try_approve_project(&id), Err(Ok(Error::ProjectNotPending)));
    assert_eq!(client.try_reject_project(&id), Err(Ok(Error::ProjectNotPending)));

    // A second campaign can be rejected from Pending.
    let (_o2, _p2, id2) = submit_basic(&env, &client);
    client.reject_project(&id2);
    env.as_contract(&client.address, || {
        let p: ProjectState = env.storage().persistent().get(&DataKey::Project(id2)).unwrap();
        assert!(p.status == ProjectStatus::Rejected);
    });
}

#[test]
fn approve_unknown_project_rejected() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    assert_eq!(client.try_approve_project(&99u32), Err(Ok(Error::UnknownProject)));
}

#[test]
fn cancel_project_sets_cancelled() {
    let env = Env::default();
    let (_admin, _token_id, client, _mint) = setup(&env);
    let (_o, _p, id) = submit_basic(&env, &client);
    client.cancel_project(&id);
    env.as_contract(&client.address, || {
        let p: ProjectState = env.storage().persistent().get(&DataKey::Project(id)).unwrap();
        assert!(p.status == ProjectStatus::Cancelled);
    });
}

// ---------- curation + tier gates ----------

#[test]
fn curation_gates() {
    // A contribution to a `Pending` campaign is refused; once the curator approves, the
    // same contribution goes through and grows the campaign's direct tally.
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    let (_owner, _payout, id) = submit_basic(&env, &client);

    let donor = Address::generate(&env);
    client.set_verification(&donor, &Tier::Basic);
    token_admin.mint(&donor, &50_000);

    // Pending → not contributable.
    assert_eq!(
        client.try_contribute(&donor, &id, &10_000),
        Err(Ok(Error::ProjectNotApproved))
    );

    // Approve, then the contribution succeeds and escrows to the contract.
    client.approve_project(&id);
    client.contribute(&donor, &id, &10_000);

    env.as_contract(&client.address, || {
        let p: ProjectState = env.storage().persistent().get(&DataKey::Project(id)).unwrap();
        assert_eq!(p.lifetime_direct, 10_000);
        // No round is open yet, so the gift lands in unrounded_direct.
        assert_eq!(p.unrounded_direct, 10_000);
    });
}

#[test]
fn contribute_requires_basic_tier() {
    // The tier gate on the donation path: an unverified wallet (`None`) can't contribute.
    let env = Env::default();
    let (_admin, _token_id, client, token_admin) = setup(&env);
    let (_owner, _payout, id) = submit_basic(&env, &client);
    client.approve_project(&id);

    let donor = Address::generate(&env); // Tier::None
    token_admin.mint(&donor, &10_000);
    assert_eq!(
        client.try_contribute(&donor, &id, &10_000),
        Err(Ok(Error::TierTooLow))
    );
}

// ---------- round lifecycle + per-round QF tagging ----------

#[test]
fn open_round_enforces_single_open() {
    // Two `Open` rounds at once would fork the QF snapshot — the invariant forbids it.
    let env = Env::default();
    let (admin, _token_id, client, _mint) = setup(&env);
    let all: Vec<Category> = Vec::new(&env);
    let r0 = client.open_round(&admin, &1_000u64, &all);
    assert_eq!(r0, 0);
    assert_eq!(
        client.try_open_round(&admin, &2_000u64, &all),
        Err(Ok(Error::RoundAlreadyOpen))
    );

    env.as_contract(&client.address, || {
        let round: RoundState = env.storage().persistent().get(&DataKey::Round(0)).unwrap();
        assert!(round.status == RoundStatus::Open);
        assert_eq!(round.pool, 0);
        let ids: Vec<u32> = env.storage().instance().get(&DataKey::RoundIds).unwrap();
        assert_eq!(ids.len(), 1);
    });
}

#[test]
fn same_donor_twice_in_round() {
    // The anti-sybil crux: a donor's per-round cumulative is summed FIRST, then √ taken
    // once. Two gifts of 10k + 40k → cumulative 50k → RoundSumSqrt == isqrt(50_000) == 223, NOT
    // isqrt(10_000)+isqrt(40_000) == 100+200 == 300.
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    let (id, donor) = approved_with_donor(&env, &client, &token_admin, 100_000);
    client.open_round(&admin, &1_000u64, &Vec::new(&env)); // round 0, all categories

    client.contribute(&donor, &id, &10_000);
    client.contribute(&donor, &id, &40_000);

    env.as_contract(&client.address, || {
        let s = env.storage().persistent();
        assert_eq!(s.get::<_, u128>(&DataKey::RoundSumSqrt(0, id)).unwrap(), 223);
        assert_eq!(s.get::<_, i128>(&DataKey::RoundContribution(0, id, donor.clone())).unwrap(), 50_000);
        assert_eq!(s.get::<_, i128>(&DataKey::RoundDirect(0, id)).unwrap(), 50_000);
        assert_eq!(s.get::<_, u32>(&DataKey::RoundDonorCount(0, id)).unwrap(), 1);
        // The round captured it, so `unrounded_direct` stays 0 while `lifetime_direct` grows.
        let p: ProjectState = s.get(&DataKey::Project(id)).unwrap();
        assert_eq!(p.lifetime_direct, 50_000);
        assert_eq!(p.unrounded_direct, 0);
    });
}

#[test]
fn bump_ttl_extends_without_panic() {
    // The TTL keep-alive: `bump_ttl` refreshes a campaign's hot persistent entries and never
    // panics, whether or not a round is open; unknown ids fail cleanly instead of touching a missing
    // key. (Every write path already bumps TTL via `put`; this proves the explicit entrypoint.)
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    let (id, donor) = approved_with_donor(&env, &client, &token_admin, 100_000);

    // No round open: only the Project entry exists — bumping it alone is fine.
    client.bump_ttl(&id);
    // Unknown id fails cleanly rather than extending a missing key.
    assert_eq!(client.try_bump_ttl(&999u32), Err(Ok(Error::UnknownProject)));

    // With an open round + a contribution, the per-round aggregates exist too — all get bumped.
    client.open_round(&admin, &1_000u64, &Vec::new(&env));
    client.contribute(&donor, &id, &10_000);
    client.bump_ttl(&id);
}

#[test]
fn category_scope() {
    // A gift to an out-of-scope category earns no match: it grows `unrounded_direct`,
    // never the round aggregates. The campaign is `EducationHealth`; the round scopes `DisasterRelief`.
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    let (id, donor) = approved_with_donor(&env, &client, &token_admin, 50_000);
    let mut cats: Vec<Category> = Vec::new(&env);
    cats.push_back(Category::DisasterRelief);
    client.open_round(&admin, &1_000u64, &cats);

    client.contribute(&donor, &id, &10_000);

    env.as_contract(&client.address, || {
        let s = env.storage().persistent();
        // No round aggregates were written for the out-of-scope project.
        assert!(s.get::<_, u128>(&DataKey::RoundSumSqrt(0, id)).is_none());
        assert!(s.get::<_, i128>(&DataKey::RoundDirect(0, id)).is_none());
        let p: ProjectState = s.get(&DataKey::Project(id)).unwrap();
        assert_eq!(p.lifetime_direct, 10_000);
        assert_eq!(p.unrounded_direct, 10_000); // fell to the else-branch
    });
}

#[test]
fn tier_gates() {
    // `None` can't contribute; `Basic` can; only `Institution` can `fund_pool`.
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    let (id, basic_donor) = approved_with_donor(&env, &client, &token_admin, 50_000);
    client.open_round(&admin, &1_000u64, &Vec::new(&env));

    // None → rejected on contribute.
    let none_donor = Address::generate(&env);
    token_admin.mint(&none_donor, &10_000);
    assert_eq!(
        client.try_contribute(&none_donor, &id, &10_000),
        Err(Ok(Error::TierTooLow))
    );
    // Basic → contribute succeeds and feeds the round.
    client.contribute(&basic_donor, &id, &10_000);
    env.as_contract(&client.address, || {
        assert_eq!(
            env.storage().persistent().get::<_, i128>(&DataKey::RoundDirect(0, id)).unwrap(),
            10_000
        );
    });

    // fund_pool: Basic is refused (needs Institution); an Institution funder grows the pool.
    let basic_funder = Address::generate(&env);
    client.set_verification(&basic_funder, &Tier::Basic);
    token_admin.mint(&basic_funder, &100_000);
    assert_eq!(
        client.try_fund_pool(&basic_funder, &0u32, &100_000),
        Err(Ok(Error::TierTooLow))
    );

    let sponsor = Address::generate(&env);
    client.set_verification(&sponsor, &Tier::Institution);
    token_admin.mint(&sponsor, &100_000);
    client.fund_pool(&sponsor, &0u32, &100_000);
    env.as_contract(&client.address, || {
        let round: RoundState = env.storage().persistent().get(&DataKey::Round(0)).unwrap();
        assert_eq!(round.pool, 100_000);
    });
}

// ---------- finalize / claim / cancel / views ----------

/// Fund an `Institution` sponsor and open+fund a full round in one shot; returns the sponsor.
fn open_funded_round(
    env: &Env,
    client: &PatunganClient<'_>,
    token_admin: &token::StellarAssetClient<'_>,
    admin: &Address,
    round_end: u64,
    pool: i128,
) -> Address {
    let sponsor = Address::generate(env);
    client.set_verification(&sponsor, &Tier::Institution);
    token_admin.mint(&sponsor, &pool);
    let rid = client.open_round(admin, &round_end, &Vec::new(env));
    client.fund_pool(&sponsor, &rid, &pool);
    sponsor
}

/// Attest a fresh `Basic` donor, fund it, and contribute `amount` to `project_id`.
fn contribute_new(
    env: &Env,
    client: &PatunganClient<'_>,
    token_admin: &token::StellarAssetClient<'_>,
    project_id: u32,
    amount: i128,
) {
    let d = Address::generate(env);
    client.set_verification(&d, &Tier::Basic);
    token_admin.mint(&d, &amount);
    client.contribute(&d, &project_id, &amount);
}

#[test]
fn round_golden() {
    // Whale-vs-crowd WITHIN one round: the crowd-backed project wins the larger match,
    // and Σ RoundMatched == pool exactly. Crowd: 10 donors × 10k; whale: 1 donor × 100k (same
    // 100k direct, different breadth → the crowd's (Σ√)² dominates).
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);

    let (_o1, _p1, crowd) = submit_basic(&env, &client);
    client.approve_project(&crowd);
    let (_o2, _p2, whale) = submit_basic(&env, &client);
    client.approve_project(&whale);

    open_funded_round(&env, &client, &token_admin, &admin, 1_000, 1_000_000);

    for _ in 0..10 {
        contribute_new(&env, &client, &token_admin, crowd, 10_000);
    }
    contribute_new(&env, &client, &token_admin, whale, 100_000);

    client.finalize_round(&0u32);

    let (_dc, _nc, m_crowd, _cc) = client.round_project(&0u32, &crowd);
    let (_dw, _nw, m_whale, _cw) = client.round_project(&0u32, &whale);
    assert!(m_crowd > m_whale, "crowd {} should beat whale {}", m_crowd, m_whale);
    assert_eq!(m_crowd + m_whale, 1_000_000, "the whole pool must be allocated");

    env.as_contract(&client.address, || {
        let round: RoundState = env.storage().persistent().get(&DataKey::Round(0)).unwrap();
        assert!(round.status == RoundStatus::Finalized);
    });
    // Re-finalizing a settled round is refused.
    assert_eq!(client.try_finalize_round(&0u32), Err(Ok(Error::AlreadyFinalized)));
}

#[test]
fn finalize_empty_round_is_nothing_to_match() {
    // No in-scope contributions → NothingToMatch, and nothing is written (round stays Open).
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    open_funded_round(&env, &client, &token_admin, &admin, 1_000, 900_000);
    assert_eq!(client.try_finalize_round(&0u32), Err(Ok(Error::NothingToMatch)));
    env.as_contract(&client.address, || {
        let round: RoundState = env.storage().persistent().get(&DataKey::Round(0)).unwrap();
        assert!(round.status == RoundStatus::Open); // untouched
    });
}

#[test]
fn preview_matches_finalized_result() {
    // preview_round is deterministic and equals stored RoundMatched after finalize; empty before
    // any in-scope contribution.
    let env = Env::default();
    let (admin, _token_id, client, token_admin) = setup(&env);
    let (_o, _p, id) = submit_basic(&env, &client);
    client.approve_project(&id);
    open_funded_round(&env, &client, &token_admin, &admin, 1_000, 900_000);

    assert_eq!(client.preview_round(&0u32).len(), 0); // nothing to match yet

    contribute_new(&env, &client, &token_admin, id, 10_000);

    let preview = client.preview_round(&0u32);
    assert_eq!(preview.len(), 1);
    let (pid, m) = preview.get(0).unwrap();
    assert_eq!(pid, id);
    assert_eq!(m, 900_000); // sole participant takes the whole pool

    client.finalize_round(&0u32);
    let (_d, _n, matched, _c) = client.round_project(&0u32, &id);
    assert_eq!(matched, m, "preview must equal the finalized split");
}

#[test]
fn claim_pays_direct_plus_matched_once() {
    let env = Env::default();
    let (admin, token_id, client, token_admin) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);

    let (_o, payout, id) = submit_basic(&env, &client);
    client.approve_project(&id);
    open_funded_round(&env, &client, &token_admin, &admin, 1_000, 1_000_000);

    let d = Address::generate(&env);
    client.set_verification(&d, &Tier::Basic);
    token_admin.mint(&d, &50_000);
    client.contribute(&d, &id, &50_000);

    // Claiming before finalize is refused.
    assert_eq!(client.try_claim(&0u32, &id), Err(Ok(Error::NotFinalized)));

    client.finalize_round(&0u32);
    let (direct, _donors, matched, _claimed) = client.round_project(&0u32, &id);
    assert_eq!(matched, 1_000_000); // sole participant takes the whole pool
    assert_eq!(direct, 50_000);

    client.claim(&0u32, &id);
    assert_eq!(token_client.balance(&payout), direct + matched);
    // A second claim is refused.
    assert_eq!(client.try_claim(&0u32, &id), Err(Ok(Error::AlreadyClaimed)));
}

#[test]
fn two_rounds_conserve() {
    // Two sequential rounds: money conservation holds across both, and
    // round 0's matched is untouched by round 1.
    let env = Env::default();
    let (admin, token_id, client, token_admin) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);

    let (_o, _p, id) = submit_basic(&env, &client);
    client.approve_project(&id);

    // ---- round 0 ----
    open_funded_round(&env, &client, &token_admin, &admin, 1_000, 1_000_000);
    contribute_new(&env, &client, &token_admin, id, 50_000);
    client.finalize_round(&0u32);
    let (_d0, _n0, matched0, _c0) = client.round_project(&0u32, &id);
    assert_eq!(matched0, 1_000_000);

    // ---- round 1 ----
    open_funded_round(&env, &client, &token_admin, &admin, 2_000, 1_000_000);
    contribute_new(&env, &client, &token_admin, id, 50_000);
    client.finalize_round(&1u32);
    let (_d1, _n1, matched1, _c1) = client.round_project(&1u32, &id);
    assert_eq!(matched1, 1_000_000);

    // Round 0's matched is untouched by round 1.
    let (_d, _n, matched0_after, _c) = client.round_project(&0u32, &id);
    assert_eq!(matched0_after, 1_000_000);

    // Money conservation: escrow == Σ lifetime_direct + Σ (finalized, unclaimed) pools.
    let escrow = token_client.balance(&client.address);
    let p = client.get_project(&id);
    assert_eq!(p.lifetime_direct, 100_000);
    assert_eq!(escrow, p.lifetime_direct + 2_000_000);

    // Claiming both rounds draws escrow down by exactly what was paid.
    client.claim(&0u32, &id);
    client.claim(&1u32, &id);
    let paid = (50_000 + 1_000_000) * 2;
    assert_eq!(token_client.balance(&client.address), escrow - paid);
}

#[test]
fn cancel_round_refunds() {
    // Cancelling an Open round refunds the pool to the sponsor and rolls each project's
    // RoundDirect into unrounded_direct (campaigns keep direct gifts; only the match refunds).
    let env = Env::default();
    let (_admin, token_id, client, token_admin) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);

    let (_o, payout, id) = submit_basic(&env, &client);
    client.approve_project(&id);

    // The round is credited to the institution that funds it (the refund target on cancel).
    let sponsor = Address::generate(&env);
    client.set_verification(&sponsor, &Tier::Institution);
    token_admin.mint(&sponsor, &1_000_000);
    client.open_round(&sponsor, &1_000u64, &Vec::new(&env));
    client.fund_pool(&sponsor, &0u32, &1_000_000);

    let d = Address::generate(&env);
    client.set_verification(&d, &Tier::Basic);
    token_admin.mint(&d, &50_000);
    client.contribute(&d, &id, &50_000);

    client.cancel_round(&0u32);

    assert_eq!(token_client.balance(&sponsor), 1_000_000); // pool refunded to the round's sponsor
    env.as_contract(&client.address, || {
        let s = env.storage().persistent();
        let round: RoundState = s.get(&DataKey::Round(0)).unwrap();
        assert!(round.status == RoundStatus::Cancelled);
        assert_eq!(round.pool, 0);
        let p: ProjectState = s.get(&DataKey::Project(id)).unwrap();
        assert_eq!(p.unrounded_direct, 50_000); // rolled in from RoundDirect
        assert_eq!(p.lifetime_direct, 50_000); // unchanged
    });

    // The campaign sweeps that direct via claim_unmatched.
    client.claim_unmatched(&id);
    assert_eq!(token_client.balance(&payout), 50_000);
    // A second sweep has nothing left.
    assert_eq!(client.try_claim_unmatched(&id), Err(Ok(Error::NothingToClaim)));
    // Re-cancelling a non-open round is refused.
    assert_eq!(client.try_cancel_round(&0u32), Err(Ok(Error::RoundNotOpen)));
}

// ---------- views ----------

#[test]
fn views_expose_config_and_listings() {
    let env = Env::default();
    let (admin, token_id, client, _mint) = setup(&env);

    let cfg: Config = client.get_config();
    assert_eq!(cfg.admin, admin);
    assert_eq!(cfg.curator, admin);
    assert_eq!(cfg.attester, admin);
    assert_eq!(cfg.token, token_id);

    let (_o, _p, id) = submit_basic(&env, &client); // EducationHealth, Pending
    // Approved-only listing excludes the Pending campaign.
    assert_eq!(client.list_projects_by_category(&Category::EducationHealth).len(), 0);
    client.approve_project(&id);
    assert_eq!(client.list_projects_by_category(&Category::EducationHealth).len(), 1);
    assert_eq!(client.list_projects_by_category(&Category::DisasterRelief).len(), 0);
    // list_projects returns ALL (regardless of status); one campaign total.
    assert_eq!(client.list_projects().len(), 1);
    assert_eq!(client.get_project(&id).id, id);

    // Rounds: none until opened; open_round_id tracks the single Open round.
    assert_eq!(client.list_rounds().len(), 0);
    assert!(client.open_round_id().is_none());
    let rid = client.open_round(&admin, &1_000u64, &Vec::new(&env));
    assert_eq!(client.list_rounds().len(), 1);
    assert_eq!(client.open_round_id(), Some(rid));
    assert_eq!(client.get_round(&rid).id, rid);
}
