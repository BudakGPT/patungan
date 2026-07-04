# Arisan-on-chain — reusable Soroban escrow slice

> **⏱️ Status: arisan idea shelved; this code is reused, not the product.** The team locked
> **"Patungan"** (collective-remittance + quadratic matching, Payment & Consumer track) — see
> [`../docs/prd.md`](../docs/prd.md). This slice's **deposit → escrow → conditional-release**
> pattern + passing tests + toolchain runbook are ~60% of the Patungan contract engine
> (`prd.md` §11 "Reuse from `../prototype-arisan/`"). Fork it, don't restart. The toolchain
> steps in §2 below are still the fastest way to pass the PRD's Day 1–2 testnet deploy gate.

A **rotating savings group** (arisan / paluwagan / chit fund) where the trusted
human organizer — who can run off with the pot — is replaced by a Soroban
contract. This folder is a *decision aid*, not the final submission: it exists to
answer one question before you commit a track —

> **Can a solo generalist actually ship a real Soroban contract for this in 17 days?**

## What's here

```
prototype-arisan/
├─ demo/index.html              ← open this NOW (no install) to SEE the flow
└─ contracts/arisan/
   ├─ Cargo.toml
   └─ src/lib.rs                ← the REAL, deployable contract + tests
```

---

## 1. See the picture right now (0 install)

Open `demo/index.html` in any browser. Click through:
**member contributes → round fills → payout rotates to the next member.**
It mirrors the real contract logic so you get the end-result UX immediately.

---

## 2. Make the slice actually real (the on-chain part)

You have **no Rust / Stellar toolchain installed yet** — that's expected. Here's
the whole path. Budget ~1–2 hours the first time.

### a. Install the toolchain
```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh     # (Windows: rustup-init.exe)
rustup target add wasm32-unknown-unknown

# Stellar CLI (provides `stellar` / soroban tooling)
cargo install --locked stellar-cli
stellar --version
```

### b. Prove the logic locally — no network needed
```bash
cd contracts/arisan
cargo test
```
This runs `full_rotation_pays_everyone_once` and the under-funded-payout guard.
Green here = your core mechanic is correct. **This is the cheapest proof you'll
ever get that the idea is buildable.**

### c. Deploy to testnet
```bash
# one funded testnet identity
stellar keys generate --global alice --network testnet --fund

# build + deploy
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/arisan.wasm \
  --source alice --network testnet
# → prints your CONTRACT_ID
```

### d. Invoke it (escrow + rotation, live)
```bash
# you'll need a token (SAC) address + member addresses; see Stellar docs on
# `stellar contract asset deploy` for a test USDC, then:
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- \
  init --admin <ADMIN> --token <TOKEN_SAC> --amount 100 --members '["<M1>","<M2>","<M3>"]'

stellar contract invoke --id <CONTRACT_ID> --source m1 --network testnet -- contribute --member <M1>
# ...all members...
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- payout
```

---

## 3. Why this slice settles the track question

| Signal | What this proves |
|---|---|
| **On-chain necessity** | Escrow + enforced payout queue can't be faked with a DB — judges' #1 test. |
| **Buildable solo** | If `cargo test` passes for you, the whole track is within reach in 17 days. |
| **Demo legibility** | The rotation is a 30-second story any judge instantly gets. |
| **Social impact** | Eliminates real arisan-organizer fraud — Stellar's exact mission. |

## 4. Deliberately NOT built yet (your "babak final" upside)

Kept out to stay a *minimal* slice — these are where you'd extend if Track 1 wins:
- **Collateral / penalty** for a member who takes the pot then stops paying (the real ROSCA fraud).
- **Reputation** carried across pools.
- **Late/missed-round handling** and grace periods.
- **Wallet frontend** (Freighter) instead of CLI invokes.

---

### How to read your own reaction
- `cargo test` goes green and you feel "oh, that's it?" → **commit Track 1, this is your project.**
- The Rust/toolchain step feels like a wall → that's a real signal worth weighing *now*,
  and it applies to **every** track (all need a Soroban contract), not just this one.
