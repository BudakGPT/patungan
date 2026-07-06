# Patungan — Backlog (the ordered task list)

> **This is the frozen task list the loop picks from.** Each iteration, [`ISSUE.md`](ISSUE.md)
> tells you to take the **topmost unchecked task whose dependencies are all checked**. Task
> **definitions** live here; **completion state** (checkboxes, commit hashes, notes) lives in
> [`PROGRESS.md`](PROGRESS.md). Keep the two in sync — check the box in `PROGRESS.md`, not here.
>
> Every task cites the sections it implements (in the **split spec** under
> [`docs/build-spec/`](docs/build-spec/) — read `overview.md` + your phase's file; the
> section→file map is in [`docs/build-spec/README.md`](docs/build-spec/README.md)) and a
> **Verify** command that must pass before the box is checked. Do not skip the verify gate.
>
> **Phase 1 (the contract) is THE GATE — do not start Phase ≥4 while any Phase 1 box is open.**

Legend: **M** must / **S** should / **C** could. `Dep:` = prerequisite task ids. **🧠** = the
loop runs this task on the stronger model (Opus) — reserved for the QF-math correctness tasks;
everything else runs on the cheaper model.

---

## Phase 0 — Scaffolding

### 0.1 · Repo scaffold — **M** — `[done, pre-loop]`
- **Do:** monorepo skeleton (`contracts/`, `frontend/`, `scripts/`, `docs/`), `PROGRESS.md`,
  `.gitignore`, `README.md`, `justfile`, `.gitattributes`. Spec: `build-spec.md` §3.
- **Verify:** `git log --oneline` shows the scaffold commit; tree matches §3.
- **Done when:** repo builds from a clean checkout; already complete during scaffold.

### 0.2 · Toolchain confirmed — **M** — Dep: 0.1
- **Do:** confirm `stellar` (stellar-cli), `cargo`/Rust, and `node` are installed at usable
  versions. Follow the runbook in `prototype-arisan/README.md`. Record the versions in
  `PROGRESS.md`. Spec: `build-spec.md` §2.
- **Verify:** `stellar --version && cargo --version && node --version` all print. If any is
  missing → raise a blocker (this gates everything).
- **Done when:** all three print versions and the numbers are logged in `PROGRESS.md`.

---

## Phase 1 — Contract (THE GATE)

### 1.1 · Fork arisan → `contracts/patungan`; builds — **M** — Dep: 0.2
- **Do:** copy `prototype-arisan/contracts/arisan/` → `contracts/patungan/`, rename the crate
  to `patungan`, keep `#![no_std]`, match arisan's `Cargo.toml` deps. Fork, don't restart
  (`build-spec.md` §4.6). Spec: §2, §3, §4.6.
- **Verify:** `cargo build --manifest-path contracts/patungan/Cargo.toml` succeeds.
- **Done when:** the renamed crate compiles.

### 1.2 · Types + `DataKey` + `Error` enum — **M** — Dep: 1.1
- **Do:** define `Config`, `RoundStatus`, `ProjectState` (§4.1); `DataKey` (§4.2); the
  `#[contracterror] enum Error` with the full variant set (§4.5). Prefer `Result<_, Error>`
  over `panic!`. Spec: §4.1, §4.2, §4.5.
- **Verify:** `cargo build --manifest-path contracts/patungan/Cargo.toml` succeeds with the
  new types referenced.
- **Done when:** types + storage keys + error enum compile and match §4 exactly.

### 1.3 · `qf.rs`: isqrt + `compute_matches` (+ remainder rule) — tested — **M** 🧠 — Dep: 1.2
- **Do:** pure, chain-free `qf.rs`: `isqrt(u128)` (§5.4) and the weight/match computation
  (§5.1) with the **largest-weight remainder rule** (§5.3) and checked arithmetic (§5.5).
  Unit-test isqrt against known values and `compute_matches` on toy inputs. Spec: §5.1–§5.5.
- **Verify:** `cargo test --manifest-path contracts/patungan/Cargo.toml qf` is green.
- **Done when:** isqrt + match-computation unit tests pass; no overflow path unhandled.

### 1.4 · `init` / `register_verified` / `register_project` / `fund_pool` — **M** — Dep: 1.3
- **Do:** implement the setup entrypoints per §4.3 (admin-only where noted; `fund_pool`
  callable by anyone with `require_auth`; idempotent `register_verified`; duplicate-id guard
  on `register_project`). Reuse arisan's `token::Client` escrow + `require_auth` idiom (§4.6).
  Spec: §4.3, §4.6.
- **Verify:** `cargo test --manifest-path contracts/patungan/Cargo.toml` green; a test drives
  init → register_verified → register_project → fund_pool and asserts state.
- **Done when:** setup path works and rejects the §4.5 error cases (AlreadyInitialized, NotAdmin,
  DuplicateProject, InvalidAmount, RoundNotOpen).

### 1.5 · `contribute` (cumulative per-donor tagging + rejections) — **M** — Dep: 1.4
- **Do:** `contribute(donor, project_id, amount)` per §4.3 with **cumulative** per-donor
  storage and **distinct**-donor tracking (§5.2 — the correctness crux). Enforce every
  rejection: not Open, past `round_end`, not Verified, unknown project, amount ≤ 0. Spec: §4.3,
  §5.2, §4.5.
- **Verify:** `cargo test --manifest-path contracts/patungan/Cargo.toml` green, **including a
  `same_donor_twice` test** proving sqrt is taken on the summed total once (§5.2).
- **Done when:** contribute updates `direct`/`donor_count`/`Contribution` correctly and rejects
  all §4.5 cases; `same_donor_twice` passes.

### 1.6 · `finalize` / `disburse` / views incl. `preview_matches` — **M** — Dep: 1.5
- **Do:** `finalize` (admin, QF state transition, `NothingToMatch` guard), `disburse`
  (admin, transfers direct+matched, `AlreadyDisbursed` guard), and read views `get_config`,
  `list_projects`, `get_project`, `is_verified`, `preview_matches` (live QF on current state).
  `finalize` and `preview_matches` must be **deterministic** and agree (§10). Spec: §4.3, §5,
  §10.
- **Verify:** `cargo test --manifest-path contracts/patungan/Cargo.toml` green; a test asserts
  `preview_matches` == stored `matched[]` after `finalize` for the same state.
- **Done when:** finalize/disburse/views implemented, idempotent per §10, deterministic.

### 1.7 · Full `cargo test` green (§5.7 golden + §5.6 edge cases) — **M** 🧠 — Dep: 1.6
- **Do:** implement `test.rs` covering **every §5.6 edge case** and the **§5.7 golden
  whale-vs-crowd scenario** (School ≫ Garden ≫ Well, `Σ matched == pool` exactly). This is the
  product's proof. Spec: §5.6, §5.7, §12.
- **Verify:** `cargo test --manifest-path contracts/patungan/Cargo.toml` — **all** green,
  golden + edge cases included.
- **Done when:** the full suite passes; the golden test asserts ordering, magnitude, and exact
  pool conservation.

---

## Phase 2 — Deploy & bindings

### 2.1 · `deploy.sh` → testnet, writes `CONTRACT_ID` + `TOKEN_ID` — **M** — Dep: 1.7
- **Do:** `scripts/deploy.sh` builds the wasm, deploys to testnet, provisions/points at the
  IDR-stand-in SAC, and writes `NEXT_PUBLIC_CONTRACT_ID` (+ `NEXT_PUBLIC_TOKEN_ID`) into
  `frontend/.env.local`. Never hardcode ids in source (§11). Spec: §11, §3.
- **Verify:** `bash scripts/deploy.sh` then
  `stellar contract invoke --id <CONTRACT_ID> ... -- get_config` returns valid state;
  `frontend/.env.local` is populated and git-ignored.
- **Done when:** contract is live on testnet and `get_config` returns state.

### 2.2 · TS bindings generated into `frontend/src/contract/` — **M** — Dep: 2.1
- **Do:** `stellar contract bindings typescript` against the deployed id → `frontend/src/
  contract/`. Hand-write a thin wrapper only if generation fails (§2). Spec: §2, §3.
- **Verify:** `cd frontend && npx tsc --noEmit` passes with the bindings present.
- **Done when:** bindings exist and typecheck against the deployed contract.

---

## Phase 3 — Seed script

### 3.1 · `seed.ts` (idempotent, rate-limit-tolerant, prints summary) — **M** — Dep: 2.2
- **Do:** `scripts/seed.ts` builds the §8 demo scenario: fund pool `100_000_000`; 3 projects;
  **N=50** crowd donors on School; 1 whale on Well; optional mids on Garden. **Leave the
  protagonist contribution for the live demo.** Idempotent/resumable via
  `scripts/.seed-state.json`; retry friendbot 429s with backoff; print per-project
  donor_count/direct + `preview_matches`. Never commit generated keys. Spec: §8.
- **Verify:** run `seed.ts`; re-run it and confirm no double-registration; summary shows
  School ~50 pendukung, Well 1 donatur, both ~Rp1jt direct, and a projected reveal where
  School dominates.
- **Done when:** the scenario is on testnet, the script is safely re-runnable, and the summary
  confirms the reveal will fire.

---

## Phase 4 — Frontend foundation

### 4.1 · Next.js (App Router)+TS+Tailwind scaffold; providers + config + `formatIDR` — **M** — Dep: 2.2
- **Do:** scaffold Next.js 14 App Router + React 18 + TS + Tailwind v3. Create the 4 file-based
  routes (§6.1: `app/page.tsx`, `app/project/[id]/page.tsx`, `app/results/page.tsx`,
  `app/operator/page.tsx`), `app/layout.tsx` (server) rendering a `'use client'`
  `app/providers.tsx`; `src/lib/config.ts` reading `process.env.NEXT_PUBLIC_*` (§11);
  `src/lib/format.ts` `formatIDR()` (§4.4); `src/strings.ts` (Bahasa-first). Wallet/RPC
  components carry `'use client'`. Spec: §2, §3, §6.1, §6.2, §4.4, §11.
- **Verify:** `cd frontend && npm run build` (`next build`) passes; `npm run dev` (`next dev`)
  serves the 4 empty routes.
- **Done when:** app builds, all 4 routes render, config + formatIDR unit-sane.

### 4.2 · RPC + react-query + freighter + WalletButton + network guard — **M** — Dep: 4.1
- **Do:** `lib/rpc.ts` (Soroban RPC), react-query provider, `lib/freighter.ts` + `useWallet`,
  `WalletButton` (connect/disconnect, truncated address, network pill), network guard E2. Spec:
  §6.2, §6.4, Epic B1/E2.
- **Verify:** `npm run build` passes; connect flow works against a running Freighter (or the
  not-installed CTA renders without crashing).
- **Done when:** wallet connects, network mismatch is guarded, writes disabled off-Testnet.

### 4.3 · Contract client + read hooks + 4 UI states — **M** — Dep: 4.2
- **Do:** `contract/client.ts` over the bindings; read hooks `useRound`, `useProjects`,
  `useProject`, `usePreviewMatch`, `useWallet` with `refetchInterval: 4000` (§6.2). Every
  data view implements **all four** UI states (§6.3). Spec: §6.2, §6.3.
- **Verify:** `npm run build` passes; a view shows loading→success against seeded testnet
  state, and error/empty states render when forced.
- **Done when:** hooks read live contract state and all four UI states exist.

---

## Phase 5 — Contributor flow

### 5.1 · Landing A1 + A2 (projected match) — **M** — Dep: 4.3
- **Do:** `/` round-summary banner A1 (pool, sponsor, status, round-end) and project grid A2
  (`ProjectCard`: emoji, title, direct, donor_count, projected-match bar) from `list_projects`
  + `preview_matches`. Spec: Epic A1, A2; §6.3.
- **Verify:** `npm run build` passes; against seeded testnet, `/` shows School ~50 pendukung,
  Well 1 donatur, both ~Rp1jt; projected matches sum ≈ pool.
- **Done when:** landing reflects live chain state with all four UI states.

### 5.2 · ProjectDetail A3 + ContributeModal B2/B3 — **M** — Dep: 5.1
- **Do:** `app/project/[id]/page.tsx` (A3, `id` via `useParams()`, story from `strings.ts`,
  not-found state) and `ContributeModal` (presets 10k/50k/100k, full tx UX §6.4,
  `Error`-variant messages, ExplorerLink on success). On success apply the **required
  optimistic cache patch** (§6.2): `queryClient.setQueryData` bumps that project's `direct` +=
  amount immediately (and `donor_count` +1 only if this wallet is a first-time donor); leave
  `matched`/projected-match to the poll or `preview_matches` — **never** locally recomputed;
  then `invalidateQueries` to reconcile. Spec: Epic A3, B2, B3; §6.2, §6.4, §4.5.
- **Verify:** `npm run build` passes; a real Freighter contribution to School goes through,
  toast+ExplorerLink appears, School's `direct` jumps **instantly** (before any poll), and
  `donor_count` reconciles within ≤4s. Confirm the projected-match number is never a locally
  guessed value.
- **Done when:** the one live demo contribution works end-to-end on testnet with instant
  optimistic feedback on `direct`.

---

## Phase 6 — Operator

### 6.1 · `/operator` C1 gate + C2 fund + C3 finalize (+C4/C5) — **M** — Dep: 5.2
- **Do:** `/operator` gated to `get_config().admin` (C1); `fund_pool` control (C2); **Finalise**
  with confirm → route to `/results` (C3). Add C4 disburse + C5 seed-status readout if time.
  Full tx UX §6.4. Spec: Epic C1–C5; §6.4.
- **Verify:** `npm run build` passes; non-admin sees the gate; admin can finalise on testnet and
  status flips to Finalized with matched values populated.
- **Done when:** the operator can finalise the round live; gate hides controls from non-admins.

---

## Phase 7 — Reveal (the money shot)

### 7.1 · `/results` D1 + D2 match-curve + D3 caption — **M** — Dep: 6.1
- **Do:** `/results` direct-vs-matched table D1 (sorted by total, `Σ matched == pool`);
  `MatchCurve` framer-motion reveal D2 (matched bars animate 0→final, crowd dwarfs whale,
  reduced-motion fallback); plain-Bahasa verdict caption D3 from `strings.ts`. Spec: Epic D1,
  D2, D3; §10 reduced-motion.
- **Verify:** `npm run build` passes; post-finalize on testnet the crowd project's matched bar
  is visually dominant and the animation replays cleanly; reduced-motion shows the final state.
- **Done when:** the §9 step-6 reveal lands in ~10s and respects `prefers-reduced-motion`.

---

## Phase 8 — Trust polish

### 8.1 · VerifiedBadge + ExplorerLinks + `strings.ts` sweep — **S** — Dep: 7.1
- **Do:** `VerifiedBadge` (E1, reads `is_verified`), `ExplorerLink` on every action + a footer
  contract link (F1), and sweep all hardcoded UI strings into `strings.ts` (§10). Spec: Epic
  E1, F1; §10.
- **Verify:** `npm run build` passes; badge reflects verification, explorer links open real
  testnet txs, `grep` finds no stray hardcoded Bahasa strings in components.
- **Done when:** Sybil badge + on-chain transparency are visible and copy is centralized.

---

## Phase 9 — End-to-end

### 9.1 · §9 demo script passes end-to-end on testnet — **M** — Dep: 8.1
- **Do:** dry-run the full §9 flow (Landing → open School → connect Freighter → chip in Rp50rb
  → operator Finalise → `/results` reveal → optional disburse) against testnet with a real
  signature. Fix whatever breaks. Spec: §9, §12.
- **Verify:** the seven §9 steps complete without a white-screen or manual DB poke; the reveal
  fires.
- **Done when:** a cold run of §9 on testnet succeeds start to finish.

### 9.2 · README run/deploy/seed/demo; clean-checkout build — **M** — Dep: 9.1
- **Do:** README documents run/deploy/seed/demo; confirm `frontend/.env.local` git-ignored and
  the repo builds from a fresh clone (contract test + `next build`). Spec: §11, §12.
- **Verify:** from a clean checkout: `cargo test` (contract) green, `npm run build` green,
  README steps reproduce a working app.
- **Done when:** a stranger can clone, follow the README, and run the demo. **Project DONE.**
