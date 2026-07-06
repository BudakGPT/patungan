# Patungan — Demo Runbook (Task 9.1 dry-run)

> Audience: the presenter / operator doing the live demo. This is the human-only last
> mile — signing wallet transactions the build loop cannot sign itself. Follow top to
> bottom. Nothing here touches mainnet or real money: everything is **Stellar Testnet**.

**On this machine:** `stellar` (v27) and `cargo` are already installed; `just` is **not**,
so every command below uses the raw `bash …` / `npx …` form. Run all commands in a
**Git Bash** terminal (not PowerShell) — the scripts are bash. Working directory is the
repo root: `x:/11 - Coding/Competition/patungan`.

**Two seedings, two goals — don't confuse them:**
- **Stage contract** (the one you present on): already deployed & seeded. It just needs
  your Freighter address *verified* so your on-stage contribution works. Non-destructive.
  **Do NOT finalise this one before the show.**
- **Throwaway contract** (a disposable copy): where you rehearse the *irreversible* steps
  — Finalise, Results, Disburse — so you never burn the stage round.

---

## Part 0 — What you need (~15 min, one-time)

| Item | Detail |
|---|---|
| Chrome or Brave browser | Freighter is a Chrome-family extension |
| The presenter's laptop | The same machine that will drive the projector on stage |
| This repo, already cloned | You're reading a file inside it |
| Internet | Testnet RPC + friendbot funding |

Already confirmed installed here: `stellar` CLI, Rust `cargo`, Node 22, npm. If you move
to a different laptop, install: [stellar-cli ≥ 27](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli),
[rustup + `rustup target add wasm32v1-none`](https://rustup.rs), and [Node 18+](https://nodejs.org).

---

## Part 1 — Install Freighter & create the presenter wallet (~10 min)

Freighter is the browser wallet that holds your signing key. It is the piece no script
can replace.

1. **Install the extension.** Go to <https://www.freighter.app/> → *Add to Chrome* (or
   install "Freighter" from the Chrome Web Store). Pin it to the toolbar.
2. **Create a wallet.** Open Freighter → *Create new wallet* → set a password.
3. **Save the recovery phrase.** Write the 12/24-word phrase on paper. This is testnet, so
   it's low-stakes, but build the habit. Confirm the phrase when prompted.
4. **Switch the network to TESTNET.** This is critical — the app rejects mainnet.
   - Click the network dropdown at the top of Freighter (it defaults to *Mainnet*).
   - Choose **Test Net**. Everything you do from now on is testnet play-money.
5. **Copy your public address.** Click the account name → copy the address. It starts with
   `G…` and is ~56 characters. **Paste it somewhere handy — you'll use it several times
   below.** We'll call it `<FREIGHTER_G>`.
6. **Fund it with test XLM.** You need testnet XLM to pay transaction fees and to make the
   Rp50rb contribution. Two ways:
   - In Freighter, if it offers *"Fund with Friendbot"*, click it; **or**
   - In a Git Bash terminal:
     ```bash
     curl "https://friendbot.stellar.org?addr=<FREIGHTER_G>"
     ```
   Friendbot drops ~10,000 test XLM — plenty. Refresh Freighter; you should see a balance.

> Optional but recommended: create a **second** Freighter account (Freighter → account
> menu → *Create account*) to act as the **admin/operator** wallet, OR reuse the CLI admin
> identity (Part 3 explains). For the simplest path, one wallet can play both roles because
> the stage contract's admin is the CLI identity, and the operator page will use whatever
> the deploy wrote as admin. See Part 4 note on admin.

---

## Part 2 — Verify your Freighter address on the STAGE contract (~3 min)

Right now the live stage contract does **not** know your Freighter address, so an on-stage
"Chip in" would fail with `NotVerified`. This step fixes that. It is **safe and
non-destructive** — it only adds your address to the verified registry; it does not close
the round.

The stage contract is already in `frontend/.env.local`
(`NEXT_PUBLIC_CONTRACT_ID=CATB7Q7T…CTL3`). The seed script re-verifies without re-doing the
crowd (those donors are already on-chain and get skipped).

In Git Bash, from the repo root:

```bash
DEMO_WALLET=<FREIGHTER_G> npx tsx scripts/seed.ts
```

What to expect in the output:
- `==> Verifying demo wallet <FREIGHTER_G>` — the line that matters.
- `pool already at 100000000`, projects "already registered", cohorts mostly skipped.
- A closing **Summary** with `projected matches: #0=…, #1=…, #2=…` and **no** `INCOMPLETE`
  line. If you see `INCOMPLETE`, just re-run the same command (it's resumable).

You are now verified on the stage contract. Do **not** finalise it. ✅

---

## Part 3 — Run the app & rehearse the SAFE steps against stage (~10 min)

This exercises demo steps 1–4 (browse → connect → contribute) with zero irreversible
actions. Great for muscle memory and for checking the projector/screen.

1. **Install frontend deps** (first time only):
   ```bash
   cd frontend && npm install && cd ..
   ```
2. **Start the dev server:**
   ```bash
   cd frontend && npm run dev
   ```
   Next.js serves on **<http://localhost:3000>**. Leave this terminal running.
3. **Open the app** at <http://localhost:3000> in the browser that has Freighter.
4. Walk the front half of the demo script (`docs/build-spec/ops.md` §9):
   1. **Landing `/`** — pool "Rp100.000.000", status Open, 3 projects with live tallies
      (School ~50 supporters, Garden ~5, Well 1).
   2. **Open School** `/project/0`, read the story.
   3. **Connect Freighter** — click Connect, approve in the Freighter popup. The
      **"✓ Terverifikasi"** badge should appear (this is Part 2 paying off).
   4. **Chip in Rp50rb** to School → a Freighter popup appears → **Sign**. You should get a
      success toast + a Stellar Expert link, and School's supporter count ticks +1 live.
5. **STOP here for the stage rehearsal.** Do **not** click Finalise on `/operator` against
   this contract — that would end the round you present. Rehearse Finalise/Results/Disburse
   on the throwaway (Part 4).

Stop the dev server with `Ctrl+C` when done (or leave it up and reuse it in Part 4).

---

## Part 4 — Throwaway copy: rehearse the IRREVERSIBLE steps (~20 min)

Here you deploy a **fresh, disposable contract**, seed it, and run the *whole* flow
including the destructive **Finalise** and **Disburse**. Because it's a different contract,
the stage round stays Open and untouched.

Two files must be protected, because the scripts overwrite them:
- `frontend/.env.local` — `deploy.sh` **overwrites** this with the throwaway's IDs.
- `scripts/.seed-state.json` — holds the stage's donor keypairs + their *verified/contributed*
  flags. If reused against a new contract, donors are wrongly marked "already verified" and
  their contributions fail `NotVerified`. The throwaway needs a **fresh** state file.

### 4a. Back up the stage config

```bash
cp frontend/.env.local        frontend/.env.local.stage-backup
cp scripts/.seed-state.json   scripts/.seed-state.stage-backup.json
```

### 4b. Move the seed state aside so the throwaway gets fresh donors

```bash
mv scripts/.seed-state.json   scripts/.seed-state.parked.json
```

### 4c. Deploy a fresh throwaway contract

```bash
bash scripts/deploy.sh
```

This mints a **new** contract + token, runs `init`, and rewrites `frontend/.env.local` with
the new `NEXT_PUBLIC_CONTRACT_ID`. It reuses the same funded admin identity
(`patungan-admin`), so the operator page's admin is the same as before. Note the new
contract id it prints (`CONTRACT_ID=…`).

### 4d. Seed the throwaway (fresh donors + your demo wallet)

```bash
DEMO_WALLET=<FREIGHTER_G> npx tsx scripts/seed.ts
```

This funds ~56 fresh throwaway donor accounts via friendbot, registers the 3 projects,
seeds the crowd/mid/whale contributions, and verifies your Freighter address. It takes a
few minutes and is resumable — if friendbot rate-limits and you see `INCOMPLETE`, just run
the same line again until the closing Summary shows the projected matches with no
`INCOMPLETE`.

> **Admin note:** the contract admin for Finalise/Disburse is the CLI identity
> `patungan-admin`, whose public key is written to `NEXT_PUBLIC_ADMIN_ADDRESS`. The
> `/operator` page gates on that address. To click Finalise **in the browser**, connect
> Freighter with **that same admin key**. Import it into Freighter via *Import account* →
> paste the secret from: `stellar keys secret patungan-admin`. (Testnet throwaway key —
> fine to import. Do this on the throwaway; for the real stage you'll do the same with the
> stage admin.)

### 4e. Run the full demo flow against the throwaway

1. Restart the dev server so it picks up the new `.env.local`:
   ```bash
   # Ctrl+C the running dev server first if it's up, then:
   cd frontend && npm run dev
   ```
2. In the browser, hard-refresh <http://localhost:3000> (Ctrl+Shift+R).
3. Walk **all seven** steps of §9 this time:
   1–4. Browse → connect (your `<FREIGHTER_G>`) → contribute → sign. (as Part 3)
   5. Go to **`/operator`**, connect the **admin** wallet, click **Finalise** → confirm →
      sign in Freighter. *(This is the irreversible step — safe here, it's the throwaway.)*
   6. Go to **`/results`** — watch the match-curve animate: School's matched bar dwarfs
      Well's, caption "Dana padanan mengikuti jumlah orang, bukan jumlah uang."
   7. (optional) **Disburse** → projects show paid out; the Stellar Expert links prove the
      transfers landed.

If all seven steps pass here, the app is proven end-to-end. This is the actual acceptance
of task 9.1.

### 4f. Restore the stage config (IMPORTANT — don't skip)

Put the stage deployment back so your presentation points at the seeded stage contract, not
the throwaway:

```bash
cp frontend/.env.local.stage-backup   frontend/.env.local
mv scripts/.seed-state.parked.json    scripts/.seed-state.json
```

Then restart the dev server once more and confirm the landing page shows the stage data
(School ~50, pool Rp100jt, status **Open**). The throwaway contract can be forgotten — it
just sits abandoned on testnet at no cost.

---

## Part 5 — Stage-day pre-flight checklist

Run through this the morning of, on the presentation laptop:

- [ ] Freighter installed, on **Test Net**, presenter account funded (balance visible).
- [ ] `frontend/.env.local` points at the **stage** contract `CATB7Q7T…CTL3`
      (`cat frontend/.env.local` to confirm — restore from backup if not).
- [ ] Your Freighter address is verified on stage (Part 2 done — the "✓ Terverifikasi"
      badge shows after connecting).
- [ ] `cd frontend && npm run dev` starts clean; <http://localhost:3000> loads with the
      round Open, 3 projects, correct tallies.
- [ ] You've rehearsed Finalise → Results → Disburse **on the throwaway** (Part 4) so the
      live reveal holds no surprises.
- [ ] Decide the stage plan for the destructive step:
      **(recommended)** do the real **Finalise live on stage** on the stage contract — it's
      a one-time, one-way action and it's the dramatic reveal. Because you rehearsed the
      identical flow on the throwaway, you know it works. Once you finalise on stage, the
      round is closed for good, so only do it during the actual reveal.
- [ ] Admin wallet available for the on-stage Finalise (stage admin key imported into
      Freighter, same technique as Part 4d admin note but with the stage `patungan-admin`
      secret).

---

## Quick reference — commands

```bash
# Verify a Freighter address on the CURRENT contract in .env.local (non-destructive)
DEMO_WALLET=<FREIGHTER_G> npx tsx scripts/seed.ts

# Run the app (http://localhost:3000)
cd frontend && npm run dev

# Fresh throwaway deploy (OVERWRITES frontend/.env.local — back it up first!)
bash scripts/deploy.sh

# See the admin secret to import into Freighter for operator actions
stellar keys secret patungan-admin

# Fund any G-address with test XLM
curl "https://friendbot.stellar.org?addr=<G_ADDRESS>"
```

## If something goes wrong

- **`NotVerified` when contributing** → your Freighter address isn't verified on the
  contract you're pointed at. Re-run Part 2's seed line with the right `.env.local` active.
- **`seed.ts` prints `INCOMPLETE`** → friendbot rate-limited. Just re-run the same line; it
  resumes.
- **Landing page shows wrong/empty data** → `.env.local` may be pointing at a throwaway or a
  half-seeded contract. Restore the stage backup (Part 4f) and restart the dev server.
- **`bash: just: command not found`** → expected; `just` isn't installed here. Use the raw
  commands in this runbook.
- **Freighter popup never appears** → confirm the extension is on **Test Net** and the site
  <http://localhost:3000> is allowed; reconnect the wallet.
- **Two or more `npm run dev` / node processes fighting** → close extra terminals; run a
  single dev server (past sessions saw build timeouts from resource contention).
