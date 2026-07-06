# Patungan — Build Spec: Overview & Contract Interface (§1–§4, §11–§12, §14–§15)

> **Part of the split build spec** (see [`README.md`](README.md) for the section→file map).
> This is the **shared foundation every task needs**: product context, tech stack, repo
> layout, the **frozen contract API (§4) both the contract and the frontend code against**,
> env config, the project Definition of Done, and what's out of scope. Section numbers are
> **global** across the split — `§5` lives in [`contract.md`](contract.md), `§6–§7` in
> [`frontend.md`](frontend.md), `§8–§9` in [`ops.md`](ops.md).
>
> **The four build documents — do not confuse their jobs:**
>
> | Document | Job | Mutable? |
> |---|---|---|
> | [`../../ISSUE.md`](../../ISSUE.md) | The **loop prompt** — how the agent behaves each iteration (Ralph-Wiggum). Start here. | frozen |
> | [`../../BACKLOG.md`](../../BACKLOG.md) | The **ordered task list** — pick the next task from here. | frozen |
> | **this spec** (`docs/build-spec/`) | The **frozen HOW** — the technical design each task implements. Read your phase's file. | frozen |
> | [`../../PROGRESS.md`](../../PROGRESS.md) | The **mutable state** — checkboxes, decisions, blockers. The only file the loop writes to. | mutable |
> | [`../prd.md`](../prd.md) | The product **WHY**. Decisions are locked there; do not re-argue them. | frozen |
>
> | Field | Value |
> |---|---|
> | Product | Patungan — collective remittance + quadratic matching on Stellar |
> | Deliverable | The **web app** + the **Soroban contract it depends on** + the **seed script** |
> | Network | **Stellar Testnet only** |
> | Team | **Solo human + AI agent.** Scope is minimal-by-mandate. |
> | Deadline | 2026-07-15 (3-day submission reserve before that) |
> | Reuse base | [`../../prototype-arisan/contracts/arisan/`](../../prototype-arisan/) (deposit→escrow→release, tested) |

---

## 1. Product context (compressed — full rationale in `../prd.md`)

Indonesian migrant workers (PMI/TKI) pool small contributions toward *village* projects.
An institutional sponsor (e.g. a provincial government running a Dana-Desa-style match)
deposits a **matching pool**. At round end a Soroban contract splits the pool by
**Quadratic Funding**: `match ∝ (Σ√contribution)²` per project — so the project backed by
*the most people* wins the biggest match, not the one backed by one whale.

**The one demo moment everything serves:** two projects raise the *same direct total*, one
from a crowd of many tiny donors and one from a single whale. On finalise, the matching
pool visibly flows to the **crowd's** project. That reveal is the product.

**Roles (final):**
| Role | Real UI? | Notes |
|---|---|---|
| Contributor (PMI diaspora) | ✅ live | Makes the one real on-chain contribution in the demo. |
| Public / anyone | ✅ read-only | Landing + Results. |
| Operator (= Sponsor **and** Admin, one gated console) | ✅ gated | We play both. `fund_pool`, `finalize`, `disburse`. |
| Project lead | ❌ seeded | No UI; projects are seeded. |

---

## 2. Tech stack (frozen — do not substitute without recording a decision)

| Layer | Choice | Version target | Notes |
|---|---|---|---|
| Contract | Rust + `soroban-sdk` | match arisan's `Cargo.toml` | Fork arisan; `#![no_std]`. |
| CLI | `stellar-cli` (`stellar`) | latest stable | Build, deploy, invoke, generate bindings. |
| Frontend build | **Next.js 14 (App Router) + React 18 + TypeScript** | Next 14+ | Client-rendered dApp — every wallet/RPC component is `'use client'`. No SSR benefit (data is live/on-chain), but Next is the chosen framework. |
| Styling | **Tailwind CSS v3** | 3.4+ | Utility-first; no component lib. |
| Routing | **Next.js App Router** (file-based, `app/`) | — | 4 routes (§6.1). No react-router. |
| Data fetching | **@tanstack/react-query** | 5+ | Contract reads with `refetchInterval` polling. |
| Stellar SDK | **@stellar/stellar-sdk** | 12+ | Tx build/submit, Soroban RPC. |
| Wallet | **@stellar/freighter-api** | latest | Connect + sign. |
| Contract client | **Generated TS bindings** (`stellar contract bindings typescript`) | — | Placed in `frontend/src/contract/` (imported by `app/` client components). Hand-write a thin wrapper only if bindings fail. |
| Animation | **framer-motion** | 11+ | The match-curve reveal. |
| Money display | Custom `formatIDR()` util | — | Values are integers; format as `Rp` (§4.4). |

**No backend, no database, no indexer.** The frontend reads contract state directly via
Soroban RPC. Seeding is a standalone Node script (§8).

---

## 3. Repository layout (target tree)

> **Path convention:** the loop's working directory is the **repo root** (`patungan/`).
> Every path in the backlog and in shell commands is **relative to the repo root**.
> (Markdown links inside these `docs/build-spec/` files use `../../` because they resolve
> from `docs/build-spec/`.)

```
patungan/                     # repo root = the loop's working directory
├─ README.md                  # deliverable README
├─ PROGRESS.md                # mutable loop log
├─ justfile                   # common tasks (contract-test, deploy, seed, dev, ...)
├─ .gitignore
├─ docs/                      # prd.md + build-spec/ (this split) + context
├─ prototype-arisan/          # reuse base — FORK SOURCE for the contract (not shipped as product)
│  └─ contracts/arisan/src/lib.rs
├─ contracts/
│  └─ patungan/               # forked & renamed from prototype-arisan/contracts/arisan
│     ├─ Cargo.toml
│     └─ src/
│        ├─ lib.rs            # contract entrypoints
│        ├─ qf.rs            # pure QF math + isqrt (unit-tested, no chain)
│        └─ test.rs          # integration tests incl. whale-vs-crowd
├─ scripts/
│  ├─ deploy.sh              # build + deploy to testnet, writes contract id to frontend/.env.local
│  └─ seed.ts                # seeds the demo scenario (§8)
└─ frontend/                 # Next.js 14 App Router app
   ├─ .env.local             # NEXT_PUBLIC_* config (git-ignored)
   ├─ next.config.mjs        # Next config (see §11)
   ├─ app/                   # App Router — file-based routes (§6.1)
   │  ├─ layout.tsx          # root layout: <html>, fonts, wraps children in <Providers/>
   │  ├─ providers.tsx       # 'use client' — QueryClientProvider + WalletProvider
   │  ├─ page.tsx            # "/"           Landing
   │  ├─ project/[id]/page.tsx  # "/project/:id"  ProjectDetail (id via useParams)
   │  ├─ results/page.tsx    # "/results"    Results
   │  └─ operator/page.tsx   # "/operator"   Operator (admin-gated)
   ├─ src/
   │  ├─ contract/           # generated bindings + client.ts
   │  ├─ lib/                # freighter.ts, rpc.ts, format.ts, config.ts
   │  ├─ hooks/              # useRound, useProjects, useProject, useWallet, usePreviewMatch
   │  ├─ components/         # ProjectCard, ContributeModal, MatchCurve, WalletButton, VerifiedBadge, ExplorerLink, ...
   │  └─ strings.ts          # all UI copy (Bahasa-first) in one place
   └─ package.json
```

> **`'use client'` everywhere it touches the wallet or RPC.** Freighter and Soroban RPC are
> browser-only, so page components, providers, hooks, and any component reading chain state
> carry `'use client'`. `app/layout.tsx` stays a server component and renders the client
> `<Providers/>` wrapper. There is no server code, no API route, no server component fetching
> chain data — Next is used purely as the SPA framework/bundler here.

---

## 4. Data model & contract interface (FROZEN — the app codes against this)

The app treats the contract as its backend. These signatures are the contract. Do not
change a name or a type without updating this section *and* the frontend in the same task,
and recording it in PROGRESS.md.

### 4.1 Types

```rust
#[contracttype]
pub struct Config {
    pub admin: Address,        // the operator; only address allowed to finalize/disburse/register
    pub token: Address,        // the IDR-stand-in Stellar Asset Contract (SAC)
    pub round_end: u64,        // ledger timestamp after which contribute() is rejected
    pub status: RoundStatus,
    pub pool: i128,            // total matching pool currently funded
}

#[contracttype]
pub enum RoundStatus { Open, Finalized }

#[contracttype]
pub struct ProjectState {
    pub id: u32,
    pub payout: Address,
    pub title: String,         // short; e.g. "Atap Sekolah SDN 2"
    pub emoji: String,         // 1 char for the UI, e.g. "🏫"
    pub direct: i128,          // sum of all contributions to this project
    pub donor_count: u32,      // number of DISTINCT verified donors
    pub matched: i128,         // 0 until finalize; then this project's share of the pool
    pub disbursed: bool,       // true after disburse() paid out
}
```

### 4.2 Storage keys

```rust
#[contracttype]
pub enum DataKey {
    Config,
    ProjectIds,                       // Vec<u32> — enumeration of registered projects
    Project(u32),                     // ProjectState
    Donors(u32),                      // Vec<Address> — distinct donors of project (for QF sum)
    Contribution(u32, Address),       // i128 — CUMULATIVE amount from this donor to this project
    Verified(Address),                // bool — in the one-ID-per-address registry
}
```

### 4.3 Functions (the frozen API)

```rust
// ---- Setup (admin only unless noted) ----
fn init(env, admin: Address, token: Address, round_end: u64);
    // one-time; panics if already initialized; sets status = Open, pool = 0.

fn register_verified(env, who: Address);
    // admin only. Adds `who` to the verified-address registry. Idempotent.

fn register_project(env, id: u32, payout: Address, title: String, emoji: String);
    // admin only. Panics if id already exists. Appends to ProjectIds.

fn fund_pool(env, from: Address, amount: i128);
    // callable by ANYONE (a real sponsor address can fund). Requires from.require_auth().
    // amount > 0. Transfers `amount` token from `from` into the contract; pool += amount.
    // Allowed only while status == Open.

// ---- Round ----
fn contribute(env, donor: Address, project_id: u32, amount: i128);
    // donor.require_auth(). Rejects if: status != Open; now > round_end; donor not Verified;
    // project_id unknown; amount <= 0. Transfers token donor -> contract.
    // Updates Contribution(project_id, donor) += amount; if donor was new to this project,
    // push to Donors(project_id) and donor_count += 1. direct += amount.

// ---- Finalisation (admin only) ----
fn finalize(env);
    // admin only. Rejects if already Finalized. Computes matched[] via QF (§5), stores each
    // ProjectState.matched, sets status = Finalized. Pure state transition; no transfers.

fn disburse(env, project_id: u32);
    // admin only. Rejects if status != Finalized, project unknown, or already disbursed.
    // Transfers (direct + matched) of that project from contract -> project.payout.
    // Sets disbursed = true.

// ---- Views (read-only; used by the frontend) ----
fn get_config(env) -> Config;
fn list_projects(env) -> Vec<ProjectState>;         // full state of every project
fn get_project(env, id: u32) -> ProjectState;
fn is_verified(env, who: Address) -> bool;
fn preview_matches(env) -> Vec<(u32, i128)>;         // runs QF read-only on CURRENT state,
    // so the UI can show a LIVE projected match before finalize. After finalize it equals
    // the stored matched[].
```

### 4.4 Money / token decimals (decision — record if you deviate)

- The IDR stand-in token is a Stellar Asset Contract. **Treat amounts as whole rupiah:
  1 token minor-unit = Rp1.** Contribution presets are `10_000`, `50_000`, `100_000`
  (Rp10rb/50rb/100rb). Pool is `100_000_000` (Rp100 juta). Whale is `1_000_000` (Rp1 jt).
- Rationale: keeps the QF integers legible in unit tests and on screen, and keeps `√` and
  `(Σ√c)²` comfortably inside `i128` (see §5.5 overflow note). If the SAC you deploy forces
  7 decimals, still mint/seed in these raw integer magnitudes — the QF math is
  decimal-agnostic (it operates on whatever integer the contract receives). The frontend
  `formatIDR(n)` renders the raw integer as `Rp` with thousands separators.

### 4.5 Errors

Use a `#[contracterror] enum Error` with explicit variants so the frontend can show precise
messages. Minimum set: `AlreadyInitialized`, `NotAdmin`, `NotVerified`, `RoundClosed`,
`RoundNotOpen`, `AlreadyFinalized`, `NotFinalized`, `UnknownProject`, `DuplicateProject`,
`AlreadyDisbursed`, `InvalidAmount`, `NothingToMatch`. Prefer returning `Result<_, Error>`
over `panic!` where the arisan base used panics, so errors are legible off-chain.

### 4.6 Reuse from `../../prototype-arisan/`

Fork, do not restart. Reuse directly: the `token::Client` escrow pattern
(`transfer(from, contract, amount)`), the `Config`/`DataKey` storage idiom,
`require_auth()` usage, the `register`/client test harness, and the toolchain runbook in
`../../prototype-arisan/README.md`. **New work only:** per-donor-per-project tagging, the
verified registry, `qf.rs` (isqrt + weights), `finalize`, `preview_matches`, `disburse`.

---

## 11. Environment & configuration

`frontend/.env.local` (git-ignored), all `NEXT_PUBLIC_`-prefixed so Next exposes them to the
browser bundle:
```
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CONTRACT_ID=<written by scripts/deploy.sh>
NEXT_PUBLIC_TOKEN_ID=<the IDR-stand-in SAC address>
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
NEXT_PUBLIC_ADMIN_ADDRESS=<the operator public key>
```
Read config through `process.env.NEXT_PUBLIC_*` (only `NEXT_PUBLIC_`-prefixed vars reach the
client). `scripts/deploy.sh` builds the contract, deploys to testnet, and writes
`NEXT_PUBLIC_CONTRACT_ID` into `frontend/.env.local`. Never hardcode a contract id in source;
read from config. `next.config.mjs` needs no special exposure config — the `NEXT_PUBLIC_`
prefix is sufficient.

---

## 12. Definition of Done (project-level) & verify commands

- **Contract:** `cargo test` in `contracts/patungan/` is green, **including the §5.7 golden
  whale-vs-crowd test and all §5.6 edge-case tests**.
- **Deploy:** contract deployed to testnet; `stellar contract invoke ... -- get_config`
  returns valid state.
- **Bindings:** `frontend/src/contract/` regenerated against the deployed id; `tsc` passes.
- **Frontend:** `npm run build` (`next build`) passes with no type errors; `npm run dev`
  (`next dev`) serves; the §9 demo script completes against testnet with a real Freighter
  signature.
- **Deliverable hygiene:** README documents run/deploy/seed; `.env.local` git-ignored; repo
  builds from clean checkout.

Per-task verify commands are in [`../../BACKLOG.md`](../../BACKLOG.md).

---

## 14. Explicitly OUT of scope (do not build)
Accounts/login/passwords · project-lead registration UI · multi-round history · real
200-donor input UI · Anchor/SEP-24 fiat on-ramp · full KYC (badge only) · project
create/edit/delete UI · native mobile app · any backend/database/indexer · mainnet · real
money. If tempted, stop and re-read §1.

## 15. Glossary
See [`../prd.md` §16](../prd.md). Terms: Patungan, PMI/TKI, Dana Desa, Quadratic Funding, Sybil,
Soroban, SAC, Freighter, Testnet.
