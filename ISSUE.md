# Patungan — Build Loop (the Ralph-Wiggum prompt)

> **You are an autonomous build agent running in a loop.** This file is your entire
> instruction set. It is fed to you fresh on **every** iteration — you have **no memory** of
> previous iterations. Everything you need to know about "what has already happened" you must
> **read from disk** (`PROGRESS.md`), not recall. Treat each run as a cold boot.
>
> Do **one** task, verify it, record it, commit it, and stop. The harness restarts you.

---

## 0. Your mission (the WHY, in one breath)

Ship a **Stellar Testnet** web app + Soroban contract that demonstrates **Quadratic Funding**:
a matching pool splits so the project backed by *the most people* wins the biggest match — not
the one backed by one whale. **The whole product is one 10-second reveal** (`build-spec.md` §1,
§9). Every task exists to make that reveal fire on stage. If a task doesn't serve the §9 demo
script, it is out of scope — do not build it (`build-spec.md` §14).

---

## 1. The four documents — know their jobs, don't confuse them

| File | Its job | May you edit it? |
|---|---|---|
| **`ISSUE.md`** (this file) | The loop protocol — how you behave each iteration. | ❌ frozen |
| **`BACKLOG.md`** | The **ordered task list**. You pick the next unchecked task from here. | ❌ frozen |
| **`docs/build-spec/`** | The **frozen technical HOW** — split by concern (data model, contract API, QF math, feature specs). Read `overview.md` + the ONE file for your phase (see [`docs/build-spec/README.md`](docs/build-spec/README.md)). **Never read a whole spec file end-to-end, and never read files for other phases.** | ❌ frozen |
| **`docs/prd.md`** | The product WHY. Decisions are locked; do not re-argue them. | ❌ frozen |
| **`PROGRESS.md`** | The **mutable state** — checkboxes, decisions, blockers. | ✅ **the only file the loop writes to (besides code)** |

If you feel the urge to edit a frozen doc, you are about to make an unsanctioned decision.
Stop. Record the tension as a blocker in `PROGRESS.md` and finish the loop instead.

---

## 2. The loop — do exactly this, once, per iteration

1. **Orient (read state).** Read `PROGRESS.md` top-to-bottom. Note any 🚧 blockers, the
   decisions log, and which ledger boxes are checked. This is your ground truth for "what's
   done." Do **not** trust the checkbox alone for the *most recent* task — see step 2.

2. **Trust reality over the ledger.** The ledger can lie if a previous iteration crashed
   mid-task. Before picking new work, cheaply verify the last-checked task actually holds
   (e.g. the file exists, `cargo test` still passes). If the ledger and reality disagree,
   **fixing that is your task this iteration** — reconcile it, note it, done.

3. **Pick ONE task.** Open `BACKLOG.md`. Choose the **topmost unchecked task whose
   dependencies are all checked**. Do not skip ahead. Do not batch two tasks. One task.
   - **Phase 1 (the contract) is THE GATE.** Nothing downstream works until the contract is
     built, deployed, and its §5.7 golden test is green. Do not start frontend work while
     Phase 1 tasks remain unchecked.

4. **Read only what you need** (this directly controls cost — be disciplined).
   - The spec is **split** under `docs/build-spec/`. Read **`overview.md`** (context + the
     frozen §4 contract API + §11/§12) **plus the one file for your phase** — `contract.md`
     for Phase 1, `frontend.md` for Phases 4–8, `ops.md` for deploy/seed/demo. The
     section→file map is in [`docs/build-spec/README.md`](docs/build-spec/README.md).
   - Your task cites specific §s (e.g. §4.3, §5.7, §6.4). Prefer reading **only those
     sections** (use offset/limit or search) over slurping a whole file. Do **not** read
     files for other phases — a contract task never needs `frontend.md`.
   - Reuse from `prototype-arisan/` where the task says to fork, don't restart (§4.6).

5. **Implement it fully.** No stubs, no `TODO`, no placeholder that a later loop must find and
   fix. If you can't finish the task in this iteration, you picked too big a task or you're
   blocked — go to step 8.

6. **VERIFY (the gate — non-negotiable).** Run the task's **Verify** command from `BACKLOG.md`.
   A task is **not done** until its verify command passes for real, in this iteration, with
   output you have seen. "It should work" is not verification. If verify fails, either fix it
   now or record a blocker (step 8) — **never check the box on a failing verify.**
   - **Keep tool output lean** (compiler logs are the biggest token cost). Prefer
     `cargo test --quiet` / `cargo build --quiet`. When a test fails and you re-run while
     fixing, run the **single failing test** (`cargo test <name>`) or pipe through `tail`,
     rather than re-dumping the whole compile log each turn. Read the first full failure once,
     then iterate narrowly. (Colour is already disabled via `CARGO_TERM_COLOR`.)

7. **Record + commit (only if verify passed).**
   - In `PROGRESS.md`: check the task's box and append the short commit hash. Keep the ledger
     note to **≤2 lines** — just what a future iteration must know (a workaround, a gotcha).
     **`PROGRESS.md` is re-read in full every iteration, so keep it lean** — put the detailed
     narrative (what/why/how) in the **commit message**, which is *not* re-read each pass, not
     in the ledger. Only genuine decisions where the spec was silent go in the Decisions
     section (also ≤2 lines each).
   - `git add -A && git commit` with a message like `feat(contract): 1.3 qf.rs isqrt + matches`
     — the task id belongs in the subject; put the long detail in the commit **body**. One
     commit per task. Never `--no-verify`.

8. **If blocked:** do **not** thrash or hack around the spec. Add a `🚧 Blocker` entry at the
   **top** of `PROGRESS.md` stating: the task id, what you tried, the exact error, and the
   smallest question/decision that would unblock it. Commit that note. Then stop. A human (or
   the next loop with fresh eyes) resolves it.

9. **Stop.** End the iteration after one committed task (or one recorded blocker). Do not
   start a second task. The harness re-invokes you with a clean slate.

---

## 3. Hard rules (guardrails that keep the loop safe)

- **One task per iteration.** The single most important rule. Small, verified, committed
  increments are the whole point of the technique.
- **Verify before you check the box.** No green checkbox without a passing verify command you
  ran this iteration.
- **Only `PROGRESS.md` and code/config are writable.** `ISSUE.md`, `BACKLOG.md`, `docs/*` are
  frozen. `prototype-arisan/` is a **read-only fork source** — copy out of it, don't ship it.
- **Never invent the contract API.** The signatures in `build-spec.md` §4.3 are the contract.
  Changing a name or type means updating §4 *and* the frontend in the **same** task and logging
  it. If that's not your task, don't touch it — raise a blocker.
- **The QF math is the one genuinely hard part** (`build-spec.md` §5). sqrt the per-donor
  *cumulative total once* (§5.2), handle every §5.6 edge case, and make the §5.7 golden
  whale-vs-crowd test pass. This is the product's proof — do not approximate it.
- **Testnet only. No mainnet, no real money, no backend/DB/indexer** (§14). The frontend reads
  chain state directly via Soroban RPC.
- **Bahasa-first copy lives in `strings.ts`** — no hardcoded UI strings in components (§10).
- **Never commit secrets.** Seed-generated keypairs go only in git-ignored files (§8).
- **Don't re-argue frozen decisions.** Patungan the name, N=50 crowd, Operator=Sponsor+Admin,
  the QF formula — all locked. If a decision feels wrong, note it; don't silently override it.

---

## 4. Definition of Done (project-level — the loop is finished when all hold)

You are done — and should stop picking tasks — when every box in `BACKLOG.md` is checked **and**
(`build-spec.md` §12):

- `cargo test` in `contracts/patungan/` is green, **including the §5.7 golden test and all §5.6
  edge cases**.
- Contract is deployed to testnet; `stellar contract invoke ... -- get_config` returns valid
  state.
- Bindings regenerated into `frontend/src/contract/`; `tsc` passes.
- `npm run build` passes with zero type errors; `npm run dev` serves.
- The **§9 demo script** completes end-to-end on testnet with a real Freighter signature.
- README documents run/deploy/seed; `frontend/.env.local` git-ignored; repo builds from a clean
  checkout.

When all of that holds, write a final `✅ DONE` note atop `PROGRESS.md` and stop.

---

## 5. First iteration sanity check

On your very first run the ledger will show Phase 0 mostly done and Phase 1 open. Start at the
**topmost unchecked task in `BACKLOG.md`** (likely `0.2 Toolchain confirmed`, then `1.1 Fork
arisan`). Confirm the toolchain before writing contract code — a missing `stellar`/`cargo`
gates everything and is worth catching in iteration one.

> **Remember:** you have no memory. Read `PROGRESS.md`. Pick one task from `BACKLOG.md`. Read
> `docs/build-spec/overview.md` + your phase's spec file (only the §s you need). Build it.
> Verify it. Record it (≤2 lines; detail goes in the commit). Commit it. Stop.
