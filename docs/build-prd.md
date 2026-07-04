# Patungan — Build PRD (single source of truth for the build agent)

> **This document is the immutable build spec.** It tells an autonomous coding agent
> *exactly* what to build, in what order, and how to know each piece is done. It is
> optimised to be re-read from scratch every loop iteration (Ralph-Wiggum technique):
> nothing here assumes memory of a previous turn.
>
> - **WHY** we build this → [`prd.md`](prd.md) (product PRD). Do not re-argue product
>   decisions; they are locked there.
> - **WHAT/HOW** to build → *this file*. Frozen. Do not edit it during the loop.
> - **PROGRESS** → [`../PROGRESS.md`](../PROGRESS.md) (mutable; the loop updates it).
>
> | Field | Value |
> |---|---|
> | Product | Patungan — collective remittance + quadratic matching on Stellar |
> | Deliverable this doc covers | The **web app** + the **Soroban contract it depends on** + the **seed script** |
> | Network | **Stellar Testnet only** |
> | Team | **Solo human + AI agent.** Scope is minimal-by-mandate. |
> | Working time left | ~8 build days before the 3-day submission reserve (deadline 2026-07-15) |
> | Reuse base | [`../prototype-arisan/contracts/arisan/`](../prototype-arisan/) (deposit→escrow→release, tested) |

---

## 0. AI BUILD LOOP PROTOCOL (read this first, every iteration)

You are an autonomous build agent running in a loop. Each iteration:

1. **Read** this file and `../PROGRESS.md`.
2. **Pick the first unchecked task** in §13 Task Ledger (strict top-to-bottom order —
   earlier phases gate later ones; do not jump ahead).
3. **Implement only that task.** Keep the diff minimal and local. Do not refactor
   unrelated code. Do not add features not in this spec.
4. **Verify** using the task's stated `Verify:` command. A task is **not done** until its
   verify command passes with your own eyes on the output. Never mark a task done on
   assumption.
5. **Record** the result in `../PROGRESS.md`: check the box, note the commit hash, and
   write one line on anything surprising (a decision, a workaround, a blocker).
6. **Commit** with a message `feat(scope): <task id> <summary>` (or `fix`/`chore`).
7. **Stop** and let the loop restart. Do one task per iteration unless a task is trivially
   small and explicitly grouped.

**Hard rules for the loop:**
- **The contract is the gate.** Do not start frontend feature work (Phase 5+) until Phase 1
  (contract) and Phase 2 (deploy + bindings) are green. If blocked on the contract, fix the
  contract — do not build UI against an imagined API.
- **If a `Verify:` fails 3 iterations in a row on the same task**, write a `BLOCKED:` note in
  `../PROGRESS.md` with the exact error and stop touching that task; move the blocker to the
  top of PROGRESS.md for a human. Do not thrash.
- **Never** commit secrets (secret keys) except the throwaway testnet keys explicitly
  designated for seeding, and only in `.env` which is git-ignored.
- **Never** invent contract behaviour. If this spec is silent on something, choose the
  simplest behaviour that satisfies the demo (§9), and record the choice in PROGRESS.md.
- Prefer **reuse from `../prototype-arisan/`** over writing from scratch (see §4.6).

---

## 1. Product context (compressed — full rationale in `prd.md`)

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
| Frontend build | **Vite + React 18 + TypeScript** | Vite 5+ | SPA. |
| Styling | **Tailwind CSS v3** | 3.4+ | Utility-first; no component lib. |
| Routing | **react-router-dom** | 6+ | 4 routes (§6.1). |
| Data fetching | **@tanstack/react-query** | 5+ | Contract reads with `refetchInterval` polling. |
| Stellar SDK | **@stellar/stellar-sdk** | 12+ | Tx build/submit, Soroban RPC. |
| Wallet | **@stellar/freighter-api** | latest | Connect + sign. |
| Contract client | **Generated TS bindings** (`stellar contract bindings typescript`) | — | Placed in `frontend/src/contract/`. Hand-write a thin wrapper only if bindings fail. |
| Animation | **framer-motion** | 11+ | The match-curve reveal. |
| Money display | Custom `formatIDR()` util | — | Values are integers; format as `Rp` (§4.4). |

**No backend, no database, no indexer.** The frontend reads contract state directly via
Soroban RPC. Seeding is a standalone Node script (§8).

---

## 3. Repository layout (target tree)

> **Path convention:** the loop's working directory is the **repo root** (`patungan/`).
> Every path in the Task Ledger (§13) and in shell commands is **relative to the repo root**.
> (Markdown links inside this `docs/` file use `../` because they resolve from `docs/`.)

```
patungan/                     # repo root = the loop's working directory
├─ README.md                  # deliverable README
├─ PROGRESS.md                # mutable loop log
├─ justfile                   # common tasks (contract-test, deploy, seed, dev, ...)
├─ .gitignore
├─ docs/                      # this file lives here (prd.md, build-prd.md, + context)
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
│  ├─ deploy.sh              # build + deploy to testnet, writes contract id to frontend/.env
│  └─ seed.ts                # seeds the demo scenario (§8)
└─ frontend/
   ├─ .env                   # VITE_* config (git-ignored)
   ├─ index.html
   ├─ src/
   │  ├─ main.tsx, App.tsx
   │  ├─ contract/           # generated bindings + client.ts
   │  ├─ lib/                # freighter.ts, rpc.ts, format.ts, config.ts
   │  ├─ hooks/              # useRound, useProjects, useProject, useWallet, usePreviewMatch
   │  ├─ pages/              # Landing.tsx, ProjectDetail.tsx, Results.tsx, Operator.tsx
   │  ├─ components/         # ProjectCard, ContributeModal, MatchCurve, WalletButton, VerifiedBadge, ExplorerLink, ...
   │  └─ strings.ts          # all UI copy (Bahasa-first) in one place
   └─ package.json
```

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

### 4.6 Reuse from `../prototype-arisan/`

Fork, do not restart. Reuse directly: the `token::Client` escrow pattern
(`transfer(from, contract, amount)`), the `Config`/`DataKey` storage idiom,
`require_auth()` usage, the `register`/client test harness, and the toolchain runbook in
`../prototype-arisan/README.md`. **New work only:** per-donor-per-project tagging, the
verified registry, `qf.rs` (isqrt + weights), `finalize`, `preview_matches`, `disburse`.

---

## 5. Quadratic Funding algorithm (the one genuinely hard part)

### 5.1 The formula
For each project *p* with distinct donors *D_p*, where `c[p][d]` is donor *d*'s **cumulative**
contribution to *p*:

```
weight[p]      = ( Σ_{d ∈ D_p} isqrt(c[p][d]) ) ²
total_weight   = Σ_p weight[p]
matched[p]     = pool * weight[p] / total_weight          (integer division, floor)
```

Then distribute the rounding remainder (§5.3).

### 5.2 CRITICAL correctness rule — sqrt the per-donor *total*, not each contribution
If a donor contributes to the same project twice (Rp10rb then Rp40rb), the contract stores
`c[p][donor] = 50_000` and takes `isqrt(50_000)` **once**. It must **not** do
`isqrt(10_000) + isqrt(40_000)`. Taking sqrt of each separate contribution would let a
single donor inflate breadth by splitting one gift into many — defeating QF. This is why
storage key `Contribution(project_id, donor)` is *cumulative* and `Donors(project_id)` holds
*distinct* addresses. **Unit-test this explicitly** (§5.6, test `same_donor_twice`).

### 5.3 Remainder / dust rule
Integer division floors, so `Σ matched[p] ≤ pool`. Compute `remainder = pool − Σ matched[p]`
and add it to the project with the **largest weight** (ties → lowest `id`). This fully
allocates the pool and keeps demo numbers clean (no dust stranded in the contract).

### 5.4 isqrt (integer square root on u128)
Pure function in `qf.rs`. Binary-search or Newton's method returning `⌊√n⌋`. Reference
(Newton):

```
fn isqrt(n: u128) -> u128 {
    if n < 2 { return n; }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x { x = y; y = (x + n / x) / 2; }
    x            // ⌊√n⌋
}
```
Must satisfy `isqrt(x)² ≤ x < (isqrt(x)+1)²` for all `x` in range. Unit-test against known
values (0,1,2,3,4,99,100,10_000,50_000, u128::MAX).

### 5.5 Overflow reasoning (must hold)
Amounts ≤ ~`100_000_000` (pool). `isqrt(100_000_000)=10_000`. With `N≈200` donors,
`Σ√c ≤ 200·10_000 = 2·10⁶`, so `weight ≤ 4·10¹²`. `pool·weight ≤ 10⁸·4·10¹² = 4·10²⁰`,
far below `i128::MAX ≈ 1.7·10³⁸`. Do the `pool*weight` multiply in `i128` (or `u128`) and
divide before it can grow further. Use checked arithmetic; on overflow return `Error`.

### 5.6 QF edge cases (all must be handled + tested)
| Case | Required behaviour |
|---|---|
| Project with **0 donors** | `weight = 0`; receives `matched = 0`. Never divides by zero. |
| **All** projects have 0 donors (`total_weight == 0`) | `finalize` returns `Error::NothingToMatch`; pool stays; status stays `Open`. |
| Same donor contributes **twice** to one project | sqrt the summed total once (§5.2). |
| Donor contributes to **multiple** projects | Each project independent; donor counted in each project's `donor_count`. |
| One whale vs many small (the demo) | Crowd project wins the pool (verify exact numbers in §5.7). |
| `matched` rounding leaves remainder | Assign to largest-weight project (§5.3). |
| Contribution `amount ≤ 0` | `Error::InvalidAmount`. |
| Overflow in weight/product | checked math → `Error`. |

### 5.7 Golden test (this exact scenario must pass as a unit test — the demo's proof)
Pool = `100_000_000`. Three projects, each raising `1_000_000` direct, differently:
- 🏫 School: `100 donors × 10_000` → weight `(100·isqrt(10_000))² = (100·100)² = 100_000_000`
- 🌱 Garden: `10 donors × 100_000` → weight `(10·isqrt(100_000))² = (10·316)² = 9_985_600`
- 💧 Well: `1 donor × 1_000_000` → weight `(1·isqrt(1_000_000))² = 1000² = 1_000_000`

`total_weight = 110_985_600`. Assert School's `matched` is ~`90.1M` (dominant), Well's is
~`0.9M`, and `Σ matched == pool` exactly (remainder rule applied). The test asserts the
*ordering and magnitude* (School ≫ Garden ≫ Well) and the exact pool-conservation equality;
exact per-project figures depend on isqrt truncation, so assert with the computed integers,
not the decimals above.

---

## 6. Frontend architecture

### 6.1 Routes
| Path | Page | Access | Purpose |
|---|---|---|---|
| `/` | `Landing` | public | Round overview + project list with live tallies. |
| `/project/:id` | `ProjectDetail` | public | Story + tally + Contribute action. |
| `/results` | `Results` | public | Direct vs matched + match-curve reveal. |
| `/operator` | `Operator` | gated to admin wallet | fund_pool, finalize, disburse, seed status. |

### 6.2 State & data
- All reads go through react-query hooks that call contract **views** over Soroban RPC and
  `refetchInterval: 4000` (so tallies update live during the demo).
- Wallet state (address, network, connected) in a `useWallet` hook backed by
  `@stellar/freighter-api`.
- Writes (`contribute`, `fund_pool`, `finalize`, `disburse`) build a tx with stellar-sdk,
  request signature via Freighter, submit via RPC, then invalidate the relevant queries.
- **No global store framework** beyond react-query + a small wallet context.

### 6.3 Global UI states (every data-driven view MUST implement all four)
1. **Loading** — skeleton/spinner; never a blank white screen.
2. **Empty** — e.g. no projects yet → friendly "Belum ada proyek" state.
3. **Error** — RPC/contract error → readable message (map `Error` variants, §4.5) + retry.
4. **Success** — the data.

### 6.4 Transaction UX states (every write button MUST implement all)
`idle → awaiting-signature (Freighter open) → submitting → success (toast + ExplorerLink) →
error (reason + retry)`. Buttons disable while a tx is in flight. Never fire a second tx
while one is pending.

---

## 7. Feature specs (per epic: story · description · acceptance criteria · edge cases · UI states)

Priority: **M**=Must (demo impossible without), **S**=Should, **C**=Could.

### Epic A — Round & Project Discovery (Landing)

**A1 · Round summary banner** · M
- *Story:* As a visitor I see the pool, the sponsor, and round status, so I grasp "a
  province is matching diaspora money."
- *Description:* Top of `/`. Reads `get_config`. Shows: pool via `formatIDR`, sponsor name
  (from `strings.ts`, e.g. "Pemprov Jawa Timur"), status badge (Open/Finalized), and a
  human round-end (from `round_end`).
- *Acceptance:* values come from the contract (change on chain → change on screen after
  poll); status badge reflects `RoundStatus`.
- *Edge cases:* not initialised yet → show "Round belum dibuka" empty state; `pool == 0` →
  show "Menunggu sponsor" rather than "Rp0".
- *UI states:* all four (§6.3).

**A2 · Project list with live tallies + projected match** · M
- *Story:* As a visitor I see each project's direct raised, backer count, and *projected*
  matched share, so the whale-vs-crowd gap is visible before finalisation.
- *Description:* Grid of `ProjectCard` from `list_projects` + `preview_matches`. Each card:
  emoji, title, `direct` (formatIDR), `donor_count` ("X pendukung"), projected match bar,
  link to detail.
- *Acceptance:* projected match sums across cards ≈ pool while Open; after finalize the same
  cards show final `matched`; a new contribution (via B2) changes a card within one poll.
- *Edge cases:* project with 0 donors → "0 pendukung", projected match Rp0, no divide-by-zero;
  `preview_matches` returns `NothingToMatch`-equivalent (empty) → cards show "—" for match.
- *UI states:* all four.

**A3 · Project detail** · M
- *Story:* As a visitor I open a project to read its story and current tally, so I can
  decide to chip in.
- *Description:* `/project/:id` from `get_project`. Shows emoji, title, story (from
  `strings.ts` keyed by id — projects are seeded, so copy can live in strings), `direct`,
  `donor_count`, projected match, and the **Contribute** button (opens B2).
- *Acceptance:* unknown `:id` → not-found state with link home. Contribute button disabled &
  labelled "Round ditutup" when status ≠ Open.
- *UI states:* all four; plus not-found.

### Epic B — Contribute (the one live moment)

**B1 · Connect Freighter** · M
- *Story:* As a contributor I connect my Stellar wallet so I can contribute as myself on
  testnet.
- *Description:* `WalletButton` in the header. Uses freighter-api to detect install,
  connect, read public key + network. Shows truncated address + network pill; supports
  disconnect.
- *Acceptance:* Freighter not installed → CTA linking to install, not a crash. Wrong network
  (not Testnet) → red pill + block writes (E2). Reconnect persists across route changes.
- *Edge cases:* user rejects connect → return to idle, no error toast spam; account not
  funded on testnet → surfaced on first write, not on connect.
- *UI states:* not-installed / disconnected / connecting / connected / wrong-network.

**B2 · Chip in to a project** · M
- *Story:* As a contributor I give a small preset amount in one tap and sign it, so my
  contribution is recorded on-chain tagged to that project.
- *Description:* `ContributeModal` with presets `Rp10rb / 50rb / 100rb` (raw `10_000 /
  50_000 / 100_000`) + confirm. Builds & submits `contribute(donor, project_id, amount)`.
  Full tx UX (§6.4). On success: toast with `ExplorerLink`, close, invalidate project + list
  + preview queries.
- *Acceptance:* the single live demo contribution goes through and moves the target
  project's `donor_count`/`direct` within one poll; verify link opens the real tx on Stellar
  Expert (testnet).
- *Edge cases (each maps to an `Error` variant → specific message):*
  - donor not in verified registry → `NotVerified` → "Alamat belum terverifikasi" (should not
    happen for the seeded protagonist; show clearly if it does).
  - status = Finalized or `now > round_end` → `RoundClosed` → disable + explain.
  - insufficient token balance / trustline missing → surface the RPC/token error plainly.
  - user rejects signature → back to idle.
  - double-submit → blocked while pending.
- *UI states:* §6.4 full set.

**B3 · Contribution reflected live** · M
- *Story:* As a contributor I immediately see my chip-in move the project's numbers, so I
  feel my Rp50rb pulling matching money.
- *Description:* After B2 success, the detail card + landing card update on next poll (≤4s);
  optionally optimistic-update the touched project for instant feedback.
- *Acceptance:* backer count +1 (if new donor) and projected-match bar grows visibly.

### Epic C — Operator Console (Sponsor + Admin, gated)

**C1 · Gated access** · M
- *Story:* As the operator I see the console only when the admin wallet is connected, so
  judges see it's privileged.
- *Description:* `/operator` compares connected public key to `get_config().admin`. Non-admin
  → "Halaman khusus operator" gate, no controls rendered.
- *Acceptance:* controls invisible/inert unless connected wallet == admin.

**C2 · Fund the matching pool** · S
- *Story:* As the sponsor I deposit the matching pool so the round has money to match.
- *Description:* Amount input (default `100_000_000`) → `fund_pool(admin, amount)`; updates
  A1 pool. Usually pre-seeded, but keep the live button for authenticity.
- *Edge cases:* status = Finalized → blocked (`RoundNotOpen`); amount ≤ 0 → blocked client-side.

**C3 · Finalise the round** · M
- *Story:* As the admin I click one "Finalise" button that closes the round and triggers the
  match computation, so the reveal fires on cue.
- *Description:* Confirm dialog ("Tidak bisa dibatalkan") → `finalize()`. On success route to
  `/results` and toast with ExplorerLink.
- *Acceptance:* status flips to Finalized; `matched` values populate; button disables
  afterward.
- *Edge cases:* already finalized → `AlreadyFinalized` disabled state; `NothingToMatch`
  (no contributions) → explain, stay Open.

**C4 · Disburse** · S
- *Story:* As the admin I disburse to projects so the demo shows money leaving the contract.
- *Description:* Per-project "Disburse" buttons (or "Disburse all") → `disburse(id)` each.
  Shows disbursed state.
- *Edge cases:* status ≠ Finalized → blocked; already disbursed → disabled; partial failure
  in "all" → report which succeeded.

**C5 · Seed status readout** · C
- *Story:* As the operator I confirm the seeded scenario is loaded before going live.
- *Description:* Read-only panel: per project donor_count + direct, and a green/red check vs
  the expected demo scenario (§8).

### Epic D — Results & the Reveal (the money shot)

**D1 · Direct vs matched per project** · M
- *Story:* As a visitor I see each project's direct and matched side by side after finalise,
  so I see the crowd's project win the pool.
- *Description:* `/results` from `list_projects`. Per project: direct (formatIDR), matched
  (formatIDR), total, donor_count. Sorted by total desc.
- *Acceptance:* numbers equal the contract's stored `matched`; `Σ matched == pool`.
- *Edge cases:* visited before finalize → show "Round belum difinalisasi" with live projected
  numbers instead of a broken/empty screen.

**D2 · Match-curve reveal animation** · M
- *Story:* As a visitor I watch the matching pool visibly flow toward the many-backer
  project, so the counterintuitive result lands in ~10 seconds.
- *Description:* `MatchCurve` (framer-motion). Each project = a stacked horizontal bar
  (direct segment + animated matched segment). On mount/finalize, matched segments animate
  from 0 → final width; the crowd project's matched segment dwarfs the whale's. Include the
  whale-vs-crowd labels ("1 donatur" vs "X donatur").
- *Acceptance:* animation runs on entering `/results` post-finalize; the crowd project's
  matched bar is visually dominant; re-mount replays cleanly.
- *Edge cases:* zero-donor project → zero-width matched segment, still labelled; reduced-motion
  preference → show final state without animation (accessibility).

**D3 · Plain-Bahasa verdict caption** · S
- *Story:* As a non-crypto judge I read one line that captures the whole idea.
- *Description:* Prominent caption on `/results`: *"Dana padanan mengikuti jumlah orang,
  bukan jumlah uang."* + the 10-second hook line. From `strings.ts`.

### Epic E — Wallet & Identity (cross-cutting)

**E1 · Verified-PMI badge** · S
- *Story:* As a contributor I see a "✓ Terverifikasi" badge when my address is registered, so
  the Sybil-resistance story is visible and pre-empts the judge's #1 attack.
- *Description:* `VerifiedBadge` reads `is_verified(address)`; shown next to the connected
  address and in the contribute modal.
- *Edge cases:* unverified connected wallet → neutral "Belum terverifikasi" (not alarming);
  contribute still blocked server-side by `NotVerified`.

**E2 · Network guard** · S
- *Story:* As a user I'm warned if I'm on the wrong network so the live tx doesn't silently
  fail on stage.
- *Description:* If Freighter network ≠ Testnet, show a persistent banner and disable all
  write buttons.

### Epic F — Transparency surface (cheap, scores "why on-chain")

**F1 · Explorer links on every action** · S
- *Story:* As a skeptical judge I can verify every action is genuinely on-chain.
- *Description:* `ExplorerLink` component → `https://stellar.expert/explorer/testnet/tx/<hash>`
  for each successful contribute/fund/finalize/disburse, and a contract link on the footer:
  `.../contract/<CONTRACT_ID>`.

---

## 8. Seed script (`scripts/seed.ts`) — the demo scenario

Produces the exact on-chain state the demo reveal depends on. Run offline **before** the
demo; results are durable on testnet.

**Scenario (default, tune N via env):**
- Deploy/point at the token SAC; ensure the admin holds enough to fund.
- `init` (if not already), `fund_pool` = `100_000_000`.
- Register 3 projects: `0` 🏫 School (crowd), `1` 🌱 Garden (mid), `2` 💧 Well (whale).
- Generate **N = 50** crowd keypairs (env `SEED_CROWD_N`, default 50). For each: friendbot-fund,
  create token trustline, mint/transfer a small balance, `register_verified`, then
  `contribute(project 0, 10_000)`. (50 gives a dramatic, honest crowd while staying within
  friendbot/testnet rate limits; the math scales — do NOT hardcode 100.)
- Register + verify 1 whale keypair; `contribute(project 2, 1_000_000)`.
- Optionally a handful (e.g. 5) mid donors on project 1.
- **Leave the protagonist contribution for the live demo** (don't pre-seed the one Freighter
  contribution the judge watches).

**Robustness requirements (edge cases):**
- **Idempotent / resumable:** re-running must not double-register projects or re-verify;
  skip already-done steps. Write progress to `scripts/.seed-state.json`.
- **Friendbot rate limits:** on 429/failure, retry with backoff; if N accounts can't be
  funded, seed as many as succeeded and print the achieved counts (the demo tolerates
  N=30–50). Record actual N.
- **Print a summary** at the end: per-project donor_count + direct, and the projected
  `preview_matches`, so the operator can eyeball the reveal will fire.
- Never commit the generated secret keys except in git-ignored files.

---

## 9. Demo script (the build must satisfy this exact flow end-to-end)

This is the acceptance test for the whole app. A dry run on testnet must pass before submit.

1. **Landing `/`** — pool "Rp100.000.000 · Pemprov Jawa Timur", status Open, 3 projects with
   live tallies: School ~50 pendukung, Well 1 donatur, both ~Rp1jt direct. *(A1, A2)*
2. **Open School `/project/0`**, read the story. *(A3)*
3. **Connect Freighter** as the protagonist (a pre-verified PMI address). "✓ Terverifikasi"
   badge shows. *(B1, E1)*
4. **Chip in Rp50rb** to School → sign in Freighter → success toast + Stellar Expert link →
   School's pendukung +1 live. *(B2, B3, F1)*
5. **Go to `/operator`** as admin → click **Finalise** → confirm. *(C1, C3)*
6. **`/results`** — match-curve animates: School's matched bar dwarfs Well's; caption "Dana
   padanan mengikuti jumlah orang, bukan jumlah uang." *(D1, D2, D3)*
7. *(optional)* **Disburse** → projects show paid out; explorer links prove it. *(C4, F1)*

---

## 10. Global non-functional requirements & edge cases

- **RPC failure / timeout:** every read hook surfaces an error state with retry; the app
  never white-screens. A transient RPC error must not crash the reveal.
- **Stale reads during a tx:** after any write, invalidate affected queries; don't show
  pre-tx numbers as if final.
- **Clock/round_end:** `contribute` rejection on `now > round_end` is enforced by the
  contract; the UI also disables to avoid a doomed signature. For the demo, set `round_end`
  far in the future so only explicit Finalise closes the round.
- **Reduced motion:** respect `prefers-reduced-motion` in D2.
- **Mobile-ish / projector:** the demo is shown on a projector; layout must be legible at
  1280×720 and not require horizontal scroll. (Full mobile polish is out of scope.)
- **Bahasa-first copy** lives in `strings.ts`; no hardcoded UI strings in components.
- **Determinism:** `finalize` and `preview_matches` must return identical `matched[]` for the
  same on-chain state (no timestamp/randomness in the math).
- **Idempotent writes:** `finalize` twice, `disburse` twice, `register_verified` twice, and
  `register_project` with a duplicate id are all safely rejected/no-op (§4.5).

---

## 11. Environment & configuration

`frontend/.env` (git-ignored), all `VITE_`-prefixed for Vite exposure:
```
VITE_NETWORK=TESTNET
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_ID=<written by scripts/deploy.sh>
VITE_TOKEN_ID=<the IDR-stand-in SAC address>
VITE_EXPLORER_BASE=https://stellar.expert/explorer/testnet
VITE_ADMIN_ADDRESS=<the operator public key>
```
`scripts/deploy.sh` builds the contract, deploys to testnet, and writes `VITE_CONTRACT_ID`
into `frontend/.env`. Never hardcode a contract id in source; read from config.

---

## 12. Definition of Done (project-level) & verify commands

- **Contract:** `cargo test` in `contracts/patungan/` is green, **including the §5.7 golden
  whale-vs-crowd test and all §5.6 edge-case tests**.
- **Deploy:** contract deployed to testnet; `stellar contract invoke ... -- get_config`
  returns valid state.
- **Bindings:** `frontend/src/contract/` regenerated against the deployed id; `tsc` passes.
- **Frontend:** `npm run build` passes with no type errors; `npm run dev` serves; the §9 demo
  script completes against testnet with a real Freighter signature.
- **Deliverable hygiene:** README documents run/deploy/seed; `.env` git-ignored; repo builds
  from clean checkout.

Per-task verify commands are in the ledger (§13).

---

## 13. Task Ledger (ordered — the loop works top-to-bottom)

> Mirror completion into `../PROGRESS.md` (checkbox + commit hash). Do not reorder.

### Phase 0 — Scaffolding
- [ ] **0.1** Create `PROGRESS.md` (checklist mirror of this ledger) and `.gitignore`
      (`target/`, `node_modules/`, `frontend/.env`, `scripts/.seed-state.json`).
      *Verify:* files exist; `git status` clean of build artifacts.
- [ ] **0.2** Confirm toolchain: `stellar --version`, `cargo --version`, `node --version`.
      *Verify:* all three print versions. If `stellar` missing, follow
      `prototype-arisan/README.md` runbook.

### Phase 1 — Contract (THE GATE)
- [ ] **1.1** Fork `prototype-arisan/contracts/arisan` → `contracts/patungan`; rename crate;
      `cargo build`. *Verify:* `cargo build` succeeds.
- [ ] **1.2** Add types (§4.1), `DataKey` (§4.2), `Error` enum (§4.5). *Verify:* `cargo build`.
- [ ] **1.3** Implement `qf.rs`: `isqrt` (§5.4) + `compute_matches(pool, per-project donor sums)`
      returning `Vec<(u32,i128)>` with the remainder rule (§5.3). *Verify:* `cargo test qf`
      green, incl. isqrt bounds + zero-weight + remainder tests.
- [ ] **1.4** Implement `init`, `register_verified`, `register_project`, `fund_pool` (§4.3).
      *Verify:* `cargo test` for setup paths + admin-gating + duplicate-project rejection.
- [ ] **1.5** Implement `contribute` with cumulative per-donor tagging + distinct-donor
      tracking + all rejection paths (§4.3, §5.2). *Verify:* `cargo test` incl.
      `same_donor_twice` and `not_verified_rejected`.
- [ ] **1.6** Implement `finalize` (calls qf), `disburse`, and all views incl.
      `preview_matches`. *Verify:* `cargo test` incl. **§5.7 golden test** and `disburse` moves
      exactly `direct+matched` and rejects double-disburse.
- [ ] **1.7** Full `cargo test` green (all §5.6 edge cases covered). *Verify:* `cargo test`.

### Phase 2 — Deploy & bindings
- [ ] **2.1** Write `scripts/deploy.sh` (build wasm, deploy to testnet, write `VITE_CONTRACT_ID`).
      Deploy the IDR-stand-in SAC; write `VITE_TOKEN_ID`. *Verify:* `stellar contract invoke
      $CONTRACT_ID -- get_config` returns state.
- [ ] **2.2** Generate TS bindings into `frontend/src/contract/`. *Verify:* bindings compile
      (`tsc --noEmit` once frontend exists).

### Phase 3 — Seed script
- [ ] **3.1** `scripts/seed.ts` per §8 (idempotent, resumable, rate-limit-tolerant, prints
      summary + `preview_matches`). *Verify:* run against testnet → summary shows School≈N
      donors, Well 1 donor, projected match School≫Well.

### Phase 4 — Frontend foundation
- [ ] **4.1** Vite+React+TS+Tailwind+router scaffold; `config.ts` reads `.env`; `format.ts`
      `formatIDR`. *Verify:* `npm run dev` serves a shell with 4 empty routes.
- [ ] **4.2** `lib/rpc.ts` + react-query provider + `lib/freighter.ts` + `useWallet`.
      `WalletButton` (B1) with all states + network guard (E2). *Verify:* connect real
      Freighter on testnet shows address + Testnet pill.
- [ ] **4.3** Contract client wrapper + read hooks (`useConfig`, `useProjects`, `useProject`,
      `usePreviewMatch`) with polling + the four UI states (§6.3). *Verify:* hooks render live
      seeded data on `/`.

### Phase 5 — Contributor flow
- [ ] **5.1** Landing A1 + A2 (round banner, project cards, projected match). *Verify:* matches
      seeded chain state; updates within one poll after a manual contribution.
- [ ] **5.2** ProjectDetail A3 + `ContributeModal` B2/B3 with full tx UX (§6.4) + error mapping.
      *Verify:* a real Rp50rb contribution signs, submits, and moves the tally live;
      ExplorerLink opens the real tx.

### Phase 6 — Operator
- [ ] **6.1** `/operator` C1 gate + C2 fund + C3 finalize (+ optional C4 disburse, C5 readout).
      *Verify:* as admin, Finalise flips status to Finalized and populates `matched`; non-admin
      sees the gate.

### Phase 7 — Reveal
- [ ] **7.1** `/results` D1 + D2 match-curve (framer-motion, reduced-motion fallback) + D3
      caption. *Verify:* after finalize, School's matched bar dominates; `Σ matched == pool`.

### Phase 8 — Trust polish
- [ ] **8.1** E1 VerifiedBadge, F1 ExplorerLinks everywhere + contract footer link, strings.ts
      sweep (no hardcoded copy). *Verify:* badge reflects `is_verified`; every write shows an
      explorer link.

### Phase 9 — End-to-end
- [ ] **9.1** Run the §9 demo script end-to-end on testnet with a real Freighter signature.
      Fix anything that breaks the flow. *Verify:* all 7 steps pass in one sitting.
- [ ] **9.2** README: run/deploy/seed/demo instructions; clean-checkout build. *Verify:* fresh
      clone → follow README → app runs.

---

## 14. Explicitly OUT of scope (do not build)
Accounts/login/passwords · project-lead registration UI · multi-round history · real
200-donor input UI · Anchor/SEP-24 fiat on-ramp · full KYC (badge only) · project
create/edit/delete UI · native mobile app · any backend/database/indexer · mainnet · real
money. If tempted, stop and re-read §1.

## 15. Glossary
See [`prd.md` §16](prd.md). Terms: Patungan, PMI/TKI, Dana Desa, Quadratic Funding, Sybil,
Soroban, SAC, Freighter, Testnet.
```
