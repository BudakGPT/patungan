#![no_std]
//! Patungan — quadratic-funding matching pool on Soroban.
//!
//! This file is the **fork base** copied verbatim (bar renames) from
//! `../prototype-arisan/contracts/arisan/`. It ships the proven
//! deposit → escrow → release slice (`token::Client` transfers, `require_auth`,
//! the `Config`/`DataKey` storage idiom, the `register`/client test harness).
//!
//! Subsequent tasks (BACKLOG 1.2–1.7) evolve this into the QF contract:
//! per-donor-per-project tagging, the verified registry, `qf.rs`, `finalize`,
//! `preview_matches`, and `disburse`. Kept as arisan logic for now so the
//! crate compiles from the very first fork (§4.6).

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub admin: Address,
    pub token: Address,    // the asset everyone contributes (e.g. a USDC SAC)
    pub amount: i128,      // fixed contribution per member per round
    pub members: Vec<Address>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    Round,                      // u32: current round == index of next recipient
    Contributed(u32, Address),  // has (round, member) paid in for this round?
}

#[contract]
pub struct Patungan;

#[contractimpl]
impl Patungan {
    /// One-time setup. `members` defines the fixed payout order (index 0 first).
    pub fn init(env: Env, admin: Address, token: Address, amount: i128, members: Vec<Address>) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
        }
        if members.len() < 2 {
            panic!("need at least 2 members");
        }
        if amount <= 0 {
            panic!("amount must be positive");
        }
        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { admin, token, amount, members });
        env.storage().instance().set(&DataKey::Round, &0u32);
    }

    /// A member pays their fixed contribution into the contract for this round.
    pub fn contribute(env: Env, member: Address) {
        member.require_auth();
        let config = Self::config(&env);
        let round = Self::round(&env);

        if round >= config.members.len() {
            panic!("rotation complete");
        }
        if !Self::is_member(&config.members, &member) {
            panic!("not a member");
        }
        let key = DataKey::Contributed(round, member.clone());
        if env.storage().persistent().has(&key) {
            panic!("already contributed this round");
        }

        // Escrow: pull funds from the member into the contract.
        let token = token::Client::new(&env, &config.token);
        token.transfer(&member, &env.current_contract_address(), &config.amount);
        env.storage().persistent().set(&key, &true);
    }

    /// Once every member has funded the current round, release the full pot to
    /// the round's recipient and advance the rotation. Callable by anyone — the
    /// recipient and amount are fully determined by on-chain state.
    pub fn payout(env: Env) {
        let config = Self::config(&env);
        let round = Self::round(&env);

        if round >= config.members.len() {
            panic!("rotation complete");
        }

        // Every member must have contributed this round.
        let mut i = 0;
        while i < config.members.len() {
            let m = config.members.get(i).unwrap();
            if !env.storage().persistent().has(&DataKey::Contributed(round, m)) {
                panic!("round not fully funded");
            }
            i += 1;
        }

        let pot = config.amount * (config.members.len() as i128);
        let recipient = config.members.get(round).unwrap();
        let token = token::Client::new(&env, &config.token);
        token.transfer(&env.current_contract_address(), &recipient, &pot);

        env.storage().instance().set(&DataKey::Round, &(round + 1));
    }

    // ---------- read-only views (handy for the frontend) ----------

    pub fn current_round(env: Env) -> u32 {
        Self::round(&env)
    }

    pub fn pot_size(env: Env) -> i128 {
        let c = Self::config(&env);
        c.amount * (c.members.len() as i128)
    }

    pub fn next_recipient(env: Env) -> Address {
        let c = Self::config(&env);
        c.members.get(Self::round(&env)).unwrap()
    }

    pub fn has_contributed(env: Env, round: u32, member: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Contributed(round, member))
    }

    pub fn members(env: Env) -> Vec<Address> {
        Self::config(&env).members
    }

    // ---------- internal helpers ----------

    fn config(env: &Env) -> Config {
        env.storage().instance().get(&DataKey::Config).unwrap()
    }

    fn round(env: &Env) -> u32 {
        env.storage().instance().get(&DataKey::Round).unwrap()
    }

    fn is_member(members: &Vec<Address>, who: &Address) -> bool {
        let mut i = 0;
        while i < members.len() {
            if &members.get(i).unwrap() == who {
                return true;
            }
            i += 1;
        }
        false
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token, Env, Vec};

    #[test]
    fn full_rotation_pays_everyone_once() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);
        let m3 = Address::generate(&env);

        // A test Stellar Asset Contract to act as the contribution token.
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_id = sac.address();
        let token = token::Client::new(&env, &token_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&m1, &1000);
        token_admin.mint(&m2, &1000);
        token_admin.mint(&m3, &1000);

        let members = Vec::from_array(&env, [m1.clone(), m2.clone(), m3.clone()]);
        let id = env.register(Patungan, ());
        let client = PatunganClient::new(&env, &id);
        client.init(&admin, &token_id, &100, &members);

        // ---- Round 0: everyone pays 100, m1 collects the 300 pot ----
        assert_eq!(client.next_recipient(), m1);
        client.contribute(&m1);
        client.contribute(&m2);
        client.contribute(&m3);
        client.payout();
        assert_eq!(token.balance(&m1), 1200); // 1000 - 100 + 300
        assert_eq!(client.current_round(), 1);

        // ---- Round 1: m2 collects ----
        client.contribute(&m1);
        client.contribute(&m2);
        client.contribute(&m3);
        client.payout();
        assert_eq!(token.balance(&m2), 1100); // paid in round 0 AND 1 (-200), received 300
        assert_eq!(client.current_round(), 2);

        // ---- Round 2: m3 collects, rotation complete ----
        client.contribute(&m1);
        client.contribute(&m2);
        client.contribute(&m3);
        client.payout();
        assert_eq!(token.balance(&m3), 1000); // paid all 3 rounds (-300), received 300
        assert_eq!(client.current_round(), 3);

        // Everyone paid 300 total (3 × 100) and received 300 once — net zero, back to 1000.
        assert_eq!(token.balance(&m1), 1000);
        assert_eq!(token.balance(&m2), 1000);
        assert_eq!(token.balance(&m3), 1000);
    }

    #[test]
    #[should_panic(expected = "round not fully funded")]
    fn cannot_payout_before_everyone_funds() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_id = sac.address();
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&m1, &1000);
        token_admin.mint(&m2, &1000);

        let members = Vec::from_array(&env, [m1.clone(), m2.clone()]);
        let id = env.register(Patungan, ());
        let client = PatunganClient::new(&env, &id);
        client.init(&admin, &token_id, &100, &members);

        client.contribute(&m1); // only one of two funds the round
        client.payout(); // should panic
    }
}
