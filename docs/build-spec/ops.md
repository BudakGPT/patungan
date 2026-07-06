# Patungan — Build Spec: Ops (§8 seed script, §9 demo script)

> **Part of the split build spec** (see [`README.md`](README.md)). Read this **with**
> [`overview.md`](overview.md) (frozen §4 contract API + §11 env). Deploy/seed tasks and the
> end-to-end demo dry-run live here.

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
