# PRD — Patungan: Collective Remittance Matching on Stellar

> **Name (locked):** *Patungan* — the everyday Indonesian word for "everyone chips in toward
> the big thing." Zero-translation recognition for Indonesian round-one judges; the word IS
> the mechanism (many small hands beat one big donor). Briefly renamed to "WeFund" and
> reverted — see §15 (#1) for the full decision trail. **Tagline:** *"gotong royong,
> on-chain."* Lead every surface with the plain-language hook below.

| Field | Value |
|---|---|
| **Status** | 🟢 Decisions locked — ready to build (see §15) |
| **Author** | (you) |
| **Audience** | Team members building / pitching this |
| **Team** | 3 builders (some Rust, learning) — split in §14 |
| **Last updated** | 2026-06-29 |
| **Hackathon** | APAC Stellar Hackathon — **judged in country groups first → round-one judges are Indonesian** |
| **Country focus** | **Indonesia** (PMI/TKI diaspora; village projects) |
| **Submission deadline** | 2026-07-15 (~16 days) |
| **Demo Day / Finale** | 2026-07-18 / 2026-07-24 |
| **Track (locked)** | **Payment & Consumer Applications** ($20K) — file as remittance; make the quadratic match the demo's hero (§9) |
| **Sibling docs** | `quadratic-funding.md` (the mechanism), `decision-handoff.md` (decision history), `../prototype-arisan/` (reusable contract) |

---

## 1. The one-paragraph summary

Indonesian migrant workers (**PMI/TKI**) send home **billions of dollars a year**, but
every transfer is a private A→B payment for one family's groceries. There is **no rail
for the diaspora to act together** on shared hometown (*kampung halaman*) projects — a
clinic, a school roof, a well, flood recovery. **Patungan** is that rail: the diaspora
pools small contributions toward local projects, and an institutional sponsor (a
provincial/village government, the migrant-worker agency **BP2MI**, a state-enterprise
**CSR** fund, or a bank like **BRI**) **matches the pool quadratically** — so the project
backed by *the most people* wins the biggest match, not the project backed by one rich
donor. A Soroban smart contract holds the money, records every contribution publicly,
runs the matching math, and disburses — making the match **provably fair and impossible
to capture**.

**The 10-second hook:** *"Rp50 ribu from 200 perantau beats Rp10 juta from one big
donor — same total raised, but the crowd wins the matching pool."*

> **Who funds the matching pool? (Answer this first — it's the question a judge asks
> first.)** **Lead funder = a provincial government** of a top PMI-origin province (**East
> Java** or **West Nusa Tenggara / NTB**) running a **Dana Desa-style 3:1 match** — exactly
> mirroring Mexico's 3×1, where the *government* matches the *diaspora*. **BP2MI** (the
> national migrant-worker agency) is the policy champion; **BRI** (state bank with deep
> village reach via BRILink, already in remittances) is the disbursement rail + CSR
> co-funder. Concrete one-liner for the deck: *"The Province of East Java commits Rp1
> miliar of its Dana Desa allocation to match what overseas workers raise for their own
> villages — 3 rupiah for every 1 — and the contract proves the split was fair."* The pool
> is **not** invented for the demo; Indonesia already moves **Rp71 trillion/yr** through
> Dana Desa (§2.4).

---

## 2. The problem

### 2.1 Who has it
- **The Indonesian diaspora (PMI/TKI).** Millions of overseas workers (BP2MI logged
  ~297,000 *new* placements in 2024 alone); top destinations Hong Kong, Taiwan, Malaysia,
  Japan, Singapore. Digitally native (they already use GoPay/DANA/OVO and remittance apps),
  already moving money home. Top origin provinces: East Java, Central Java, West Java, NTB,
  Lampung — *this is where the village projects live.*
- **Their home communities (*desa*).** Villages that need shared infrastructure, not just
  per-family consumption.
- **Institutional funders.** Provincial/village governments, **BP2MI**, state-owned
  enterprises (**BUMN CSR**), banks (**BRI**), and — as one optional rail — Islamic-giving
  bodies (**BAZNAS**), all of which *want* to channel money to communities but need a way
  to allocate it that they can **prove they don't control**.

### 2.2 The gap
Remittances today are **atomized and consumption-bound**. The money keeps families
afloat, but there is no trustworthy mechanism for the diaspora to **collectively fund
shared goals**. When communities try, it's a WhatsApp group, a relative holding cash, and
zero accountability about who paid or where it went.

When institutions *do* try to allocate community money, the historic failure mode in
Indonesia is **opacity and capture** — the well-known distrust around how village/program
funds get steered. On-chain transparency is the direct answer to that distrust.

### 2.3 Proof the demand is real (not a daydream)
This model **already ran at national scale for ~two decades**: Mexico's **"Tres por Uno"
(3×1)** program matched migrant hometown-association remittances **3:1** (federal + state
+ municipal) for community projects, funding thousands of them. Its well-documented
weakness was bureaucracy and capture — *exactly the problem a public, tamper-proof
contract removes.*

**Indonesia analog:** the country already disburses **Rp71 trillion/yr** to **75,265
villages** through the **Dana Desa** (Village Funds) program (2024) — averaging ~Rp944
juta per village. Patungan is the rail that lets diaspora money *plug into* that kind of
matching — transparently. We are digitising a proven model and fixing its known flaw.

### 2.4 Scale (why an Indonesian judge cares)
| Metric | Figure | Source / note |
|---|---|---|
| Indonesia remittances received | **~$14.5B (2023)** | World Bank / Statista; among APAC's largest after India & Philippines |
| New PMI placements (2024) | **~297,000** | BP2MI 2024 report; total diaspora *stock* is far larger (millions, incl. undocumented) |
| Top placement destinations (2024) | Hong Kong, Taiwan, Malaysia, Japan, Singapore | BP2MI 2024 |
| Top origin provinces | East Java, Central Java, West Java, NTB, Lampung | BP2MI 2024 — where the *desa* projects sit |
| Dana Desa (2024) | **Rp71 trillion** across **75,265 villages** (~Rp944 jt each) | Kemenkeu / APBN 2024 — the rail Patungan plugs into |

> Figures above are sourced (2023–2024); re-confirm the headline numbers the week of the
> deck in case fresher 2025 data is out. **Don't lead with raw remittance *volume*** (it
> trails the Philippines) — lead with **village-level concentration + the Dana Desa rail**.

---

## 3. What we're building

A web app + Soroban contract that runs **funding rounds**. In one round:

1. A **sponsor** deposits a matching pool (e.g. Rp100 juta) into the contract.
2. **Projects** (village causes) register.
3. **Diaspora contributors** chip in small amounts to projects they care about, during a
   ~2-week window. Every contribution is recorded on-chain, tagged to contributor +
   project.
4. At round end, the contract runs the **Quadratic Funding formula** on the contribution
   *pattern* and splits the matching pool by **breadth of support**.
5. Each project receives **its direct contributions + its matched share**.

The differentiator is **the matching mechanism**, not the transfer. We are not competing
with money-transfer apps (see §9).

---

## 4. The core mechanism (Quadratic Funding)

**The rule:** the *number of people* who back a project matters more than the *total
amount*. Match is allocated by `(Σ √contribution)²` per project, split in proportion.

> **Plain-Bahasa one-liner for non-crypto judges:** *"Dana padanan mengikuti jumlah
> orang, bukan jumlah uang."* — the match follows the **number of people**, not the
> amount of money. Put this sentence on a slide; it's the whole idea.

### Worked example (this is also the demo)
Matching pool **Rp100 juta**. Three projects each raise **the same Rp1 juta**, differently:

| Project | How it raised Rp1 juta | Direct | Matched share | **Total** |
|---|---|---:|---:|---:|
| 🏫 School roof | 100 people × Rp10rb | Rp1 jt | ~Rp90,1 jt | **~Rp91,1 jt** |
| 🌱 Community garden | 10 people × Rp100rb | Rp1 jt | ~Rp9,0 jt | **~Rp10,0 jt** |
| 💧 Single well | 1 donor × Rp1 jt | Rp1 jt | ~Rp0,9 jt | **~Rp1,9 jt** |

All raised *exactly Rp1 juta directly* — yet the school, backed by the most people, takes
~Rp91 juta. **The crowd's breadth decided the allocation, not the rupiah.**

### The math
- School: `(100 × √1)²` = **10,000**
- Garden: `(10 × √10)²` ≈ **1,000**
- Well: `(1 × √100)²` = **100**
- Total weight = 11,100 → each project's match = `(weight / 11,100) × Rp100 juta`.

The square root **dampens whales and rewards many small contributors.** Full derivation
lives in `quadratic-funding.md`.

---

## 5. Why it must be on-chain (the judges' #1 test)

The match is computed from the **contribution pattern** — how many distinct people gave,
and how much. That pattern is the entire input to the fairness math.

If contributions were recorded **off-chain**, whoever holds the database could invent
fake donors, hide real ones, or tilt the match — and the "fair, uncapturable allocation"
promise collapses (this is precisely how 3×1 was criticised, and precisely the Dana Desa
distrust). The **only** way the match can be *provably* fair is if the **contract itself
witnesses every contribution in public.** Remove the blockchain and the product gets
strictly worse. ✅ Passes the test.

## 6. Why Stellar specifically

- **Near-zero fees** (fractions of a cent) make **on-chain micro-contributions viable** —
  a Rp10rb–Rp50rb contribution survives the fee. This is impossible on Ethereum-class gas,
  and it's *required* by QF, which depends on lots of tiny contributions.
- **Fast settlement** → the demo's live reveal works in seconds.
- **Anchors** are the natural fiat (IDR) on/off ramp for the remittance leg (narrate for
  the demo; stretch goal to integrate — see §11).

---

## 7. Users & roles

| Role | Who | What they do | What they get |
|---|---|---|---|
| **Sponsor / Funder** | Provincial/village gov, BP2MI, BUMN CSR, BRI | Deposits the matching pool; sets round window. **Does not pick winners.** | A provably fair, capture-proof allocation they can publicly stand behind |
| **Diaspora contributor** | PMI/TKI overseas worker | Browses village projects, chips in small amounts to ones they care about | Their Rp50rb *pulls extra matched money* toward their kampung — collective impact |
| **Project / Village lead** | Village committee, local org | Registers a project, receives the payout | Direct funds + matched share, transparently |
| **Admin (us, for the demo)** | The app | Opens/closes the round, triggers finalisation | — |

**Key insight for the team:** the contributor's chip-in does **double duty** — it funds
the project *and* acts as a vote that pulls matching money toward it. That dual nature is
the emotional core of the pitch.

---

## 8. User flow — one funding round

```
PHASE 0  SETUP        Sponsor funds pool (Rp100jt) ─► [CONTRACT]   Projects register
                                                          │
PHASE 1  ROUND OPEN   Contributors chip in ───────────────► records (who → how much → which project)
         (~2 weeks)   Rp50rb, Rp10rb, Rp100rb ... each tagged on-chain
                                                          │
PHASE 2  ROUND CLOSE  Admin finalises ────────────────────► contract runs (Σ√c)² per project
                                                          │
PHASE 3  PAYOUT       Each project receives ◄─────────────┘ direct contributions + matched share
```

For the hackathon we run **one short round end-to-end on testnet**, not a live 2-week
window.

---

## 9. Differentiation — why this isn't "another remittance app"

This is the question every judge (and teammate) will ask. The answer:

| | Remittance **transfer** apps (GoPay, DANA, OVO, Wise, Western Union) | **Patungan** (collective + matched) |
|---|---|---|
| Primitive | A → B private payment | many → community → **matched** pool |
| Market | Saturated to death | **Essentially empty** on-chain |
| Innovation | Cheaper transfer (commodity) | Quadratic matching a database can't fake |
| Funder | n/a | Real precedent (3×1 / Dana Desa: gov / BP2MI / BUMN CSR) |

**Three moats:**
1. **Different primitive.** No transfer app does collective pooling with a quadratic
   match. We don't compete with them — we occupy a lane they don't touch.
2. **The mechanism is the moat.** A bank can move money; only an on-chain contract can
   *prove the contribution pattern is real* so the match can't be gamed or steered.
3. **Sybil-resistance is native here** (see §12), not a bolted-on second project — because
   the funder already KYCs participants for cross-border AML.

> **Framing discipline (the council's "match-as-hero" rule):** the *track filing* and the
> *story* are separate levers. **File under Payment & Consumer** and **open** the demo with
> a one-tap PMI contribution so a skimming judge instantly recognises it as
> remittance/payments (this is the safe floor — "remittances" is a named example of the
> track). **Then** make the **quadratic match the headline** — the whale-vs-50 reveal is
> the innovation moment, *not* a footnote. Two failure modes to avoid:
> - ❌ Pitching it as "cheaper remittance transfers" → commodity, invites "already exists."
> - ❌ Demoting the match to "a bonus" / "how it works" → buries the one feature that scores
>   Innovation (20%) and differentiation. **Safe shelf, loud differentiator.**

> **Indonesia framing order (round-one judges are Indonesian) — pitch in this sequence:**
> 1. **Lead with the PMI/TKI protagonist** — a named overseas worker funding her village
>    is the emotional spine.
> 2. **Then transparency** — on-chain quadratic matching as provable proof *against* the
>    Dana Desa / allocation distrust. **This is the pitch.**
> 3. **Then the funder** — BP2MI / BRI / BUMN CSR as the concrete matching sponsor.
> 4. **Downplay zakat / Islamic giving** — keep it as *one optional rail*, never the
>    thesis (religious-giving rules can collide with quadratic matching and narrow the
>    panel). Consider delivering the pitch in **Bahasa Indonesia** for round one.

---

## 10. Scope (MoSCoW) — what we build in ~16 days

### Must have (the winning core)
- Soroban contract: fund pool · register project · record tagged contribution · integer
  sqrt · compute QF match · disburse.
- **Minimal Sybil defense (now core, not optional):** an on-chain **verified-address
  registry** — one ID per address, pre-seeded for the demo, admin-gated. *Not* a full KYC
  system (see §12). Quadratic matching is mathematically broken without this — it's the
  one question a sharp judge asks to collapse the demo.
- Deployed and working on **Stellar testnet**.
- Thin web frontend: connect wallet (Freighter), list projects, contribute, "finalise"
  button, results view.
- **The reveal demo:** whale vs. crowd → match flows to the crowd. Staged/seeded so it
  fires on cue.
- Deliverables: public GitHub repo, README, demo video, pitch deck.

### Should have
- Clean results screen showing direct vs. matched per project — the **live match-curve
  visualization** is the demo's money shot (Dev B owns it, §14).

### Could have (stretch — only if ahead of schedule)
- Real anchor / SEP-24 fiat (IDR) on/off-ramp leg (technical-score signal, but scope-heavy
  and sandbox-flaky — **stretch only**, never a demo dependency; narrate it otherwise).
- Multiple rounds / round history.
- Contribution caps or matching caps per project.

### Won't have (explicitly out of scope for the hackathon)
- Real cross-border fiat settlement (narrate it; use a test token as an IDR-stablecoin
  stand-in on testnet).
- Production-grade identity / proof-of-personhood.
- Mainnet deployment, real money, real sponsors.

---

## 11. Technical architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Frontend   │────►│  Soroban contract     │────►│  Stellar testnet │
│ (React/JS + │     │  (Rust)               │     │  (Horizon/RPC)   │
│  Freighter) │◄────│  matching engine      │◄────│                  │
└─────────────┘     └──────────────────────┘     └──────────────────┘
        │                      ▲
        │                      │ (stretch)
        │              ┌───────┴────────┐
        └─────────────►│  Anchor (SEP)  │  fiat (IDR) ⇄ token  ← narrate for demo
                       └────────────────┘
```

- **Contract (Rust/Soroban):** the hero. Holds pool + contributions, runs the math.
- **Frontend:** minimal — built to the demo script, not to a real product surface.
- **Wallet:** Freighter for signing.
- **Asset:** a test token (IDR-stablecoin stand-in) on testnet.

### Reuse from `../prototype-arisan/`
Per `decision-handoff.md`, the arisan slice already implements **deposit → escrow → conditional
release** with passing tests. That's ~60% of this engine. **Fork it, don't restart:**
- Reuse: contribution intake, escrow holding, payout/disbursement, test harness, the
  toolchain runbook.
- New work: tagging contributions to project IDs, the **integer sqrt**, and the
  **`finalise` / match-computation** step.

### Contract interface (draft — for shared understanding, not final)
```rust
// Admin / setup
fn init(admin: Address, asset: Address, round_end: u64);
fn fund_pool(from: Address, amount: i128);          // sponsor deposits matching pool
fn register_project(id: u32, payout: Address, meta: String);

// Round
fn contribute(donor: Address, project_id: u32, amount: i128);  // recorded + escrowed

// Finalisation
fn finalize();                  // computes (Σ√c)² weights, locks allocation
fn disburse(project_id: u32);   // pays out direct + matched share

// Views
fn get_project(id: u32) -> ProjectState;     // direct, donor_count, matched, total
fn get_round() -> RoundState;
```

### The one genuinely hard piece: integer sqrt
QF needs `√contribution`. Soroban has no floats. **Good news (per council Executor):** QF
needs **relative weights, not decimals**, so a ~15-line **integer binary-search / Newton
sqrt on `u128`** is sufficient. Write it as a pure function and unit-test with `cargo
test` — no chain needed. This is an afternoon, not the boss fight. The *real* day-1 risk
is toolchain + testnet deploy (see §14).

---

## 12. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Sybil attack** — one person fakes many donors to inflate "breadth" | High | **Build the minimal version (Must-have, §10):** an on-chain verified-address registry — one ID per address, pre-seeded for the demo, admin-gated. Natural to the remittance frame (the funder already KYCs for AML), so it's not a bolt-on. **Scope it small** — not a full identity system. Add a **"Production: SEP-12 KYC via anchor"** roadmap slide for the rest. Showing it working turns the biggest attack surface into a flex. |
| **Toolchain eats week 1** (team learning Rust) | High | Day-1–2 deploy gate (§14): if no testnet round-trip by end of Day 2, escalate. Critical-path contract owned by the strongest Rust dev (Dev A), protected from other work. |
| **Scope creep** (anchors, multi-round, real UI) | High | MoSCoW (§10) is the contract. Anchors are *stretch only* — never a demo dependency. Build to the demo script. |
| **"Who funds the pool?"** | Medium | Answered by the 3×1 precedent + the Dana Desa rail — governments/BP2MI/BUMN CSR already do this. **State it in one concrete sentence up front** (see §1 callout); don't hand-wave. The single most-flagged gap in review. |
| **Reads as charity, not financial** | Medium | File under Payment & Consumer; open as remittance, match-as-hero (§9). Track choice gives the safe floor. |
| **Looks like "remittance wallet #41"** (lost among transfer apps) | Medium | Differentiate on the *mechanism*, not transfer cost (§9). The quadratic match is the headline — never demoted to a bonus. |
| **Zakat framing narrows the panel** | Medium | Keep Islamic-giving as one optional rail, not the thesis (§9). Lead secular (village dev + transparency). |
| **sqrt precision / overflow** | Low | Integer sqrt on `u128`, relative weights only. Unit-tested. |

---

## 13. How this maps to the judging rubric

| Criterion | Weight | How we win it |
|---|---:|---|
| Technical implementation & Stellar usage | 25% | Real deployed Soroban contract; on-chain micro-contributions exploit Stellar's near-zero fees; (stretch) anchor integration |
| Real-world fit & APAC use case | 25% | Indonesian PMI remittances + village development; Dana Desa rail; clear users; transparency vs. allocation distrust |
| Innovation & differentiation | 20% | Quadratic matching — a mechanism a database can't fake; empty competitive lane |
| Viability & go-to-market | 10% | Real funder model (gov / BP2MI / BUMN CSR / BRI); SCF follow-on grant path |
| UX & accessibility | 5% | Simple "pick a project, chip in" flow; Freighter wallet; Bahasa UI |
| Team & ability to continue | 5% | Shipped contract + clear roadmap |

**Half the score (50%) is Technical + Real-world fit** — the two criteria this framing is
built to win, and the two plain Quadratic Funding was failing.

---

## 14. Plan & team split (~16 days, 3 builders)

### Who owns what
- **Dev A — Contract (strongest Rust).** The critical path. Fork `../prototype-arisan`; add
  project-tagged contributions, `u128` integer sqrt, the verified-address registry, the QF
  match, `finalize`, `disburse`. **Protected from all other work.**
- **Dev B — Frontend + the live match-curve visualization** (the demo's money shot).
  Freighter wallet, project list, contribute, finalise, results screen.
- **Dev C — Deck + demo video + README + repo hygiene**, from Day 1 (not Day 14). Owns the
  pitch narrative (Bahasa for round one) and the funder one-liner; becomes **QA /
  integration tester** days 9–14; owns the SEP-24 stretch *only if* the contract is on
  track.

### Timeline
| Days | Goal | Definition of done |
|---|---|---|
| **1–2** | **Toolchain + deploy gate** | `stellar-cli` installed; hello-world contract deployed to testnet and invoked round-trip. *If not done by end of Day 2 → escalate.* Dev C starts the deck + locks the funder one-liner. |
| **3–6** | **Contract** | Dev A: fork arisan; project-tagged contributions, integer sqrt, verified-address registry, `finalize`, `disburse`. **Gate: the whale-vs-50 scenario passes as a Rust unit test (green) by end of Day 6.** *If not green → cut UI to a CLI demo; the contract is the product.* Dev B builds deploy/demo tooling against the interface. |
| **7–10** | **Frontend + viz** | Dev B: Freighter connect; project list; contribute; finalise; results screen with the **live match-curve**. Integrate against the real contract by **Day 10–11** (never the night before). |
| **11–13** | **Stage the reveal** | Seeded scenario (whale on A, 50 donors on B); match visibly flows to B; rehearse the 30-second moment ~5×. Dev C QAs the full flow. |
| **14–16** | **Submit** | Demo video, README, pitch deck, public repo. *Reserve all 3 days — these overrun.* |

Stretch (anchor / SEP-24) only slots in if days 7–13 finish early, and **never as a live
demo dependency** — narrate it otherwise.

---

## 15. Decisions (locked)

All open decisions were pressure-tested through the advisory council; here's where they
landed and why.

| # | Decision | **Locked answer** | Why |
|---|---|---|---|
| 1 | **Name** | **Patungan** — tagline *"gotong royong, on-chain"*; lead with the plain-language hook | Zero-translation recognition for Indonesian round-one judges (they gate round one); the word IS the mechanism (many small hands beat one big donor). Briefly renamed to "WeFund" — reverted after review found it generic, collides with the existing "Wefunder" crowdfunding platform, and threw away the exact cultural resonance the pitch depends on. Beat *Urunan* (quieter) and *Royong* (coined, reads as a typo to natives). Confirmed no existing Stellar/Soroban project or Indonesian fintech brand uses "Patungan" as a proper name (the word is used generically as a feature, e.g. GoPay's split-bill) |
| 2 | **Sybil defense** | **Build the minimal version** — on-chain verified-address registry (1 ID/address, pre-seeded, admin-gated) + SEP-12 roadmap slide | QF is broken without it; full KYC is a rabbit hole, the minimal version is ~½–1 day |
| 3 | **Country framing** | **Indonesia** (PMI/TKI diaspora; *desa* projects); pitch order = PMI protagonist → transparency → funder → (downplay) zakat | Competition is judged in **country groups first** — round-one judges are Indonesian, so Indonesian resonance + an Indonesian funder story decide it |
| 4 | **Track** | **Payment & Consumer Applications** | "Remittances" is a *named example* (safe floor); fully demoable from owned code; survives the anchor being cut |
| 5 | **Anchor (SEP-24)** | **Stretch / Could-have** — narrate by default, build only if ahead; never a live dependency | Optional + sandbox-flaky; building it doesn't change the (Payment) track fit |
| 6 | **Team split** | **Dev A** contract / **Dev B** frontend + match-curve viz / **Dev C** deck+video+QA (+anchor if time) — see §14 | Protect the critical-path contract; deck starts Day 1 |

### Resolved since last review
- ✅ **Funder for the pitch (locked):** lead with a **provincial government** (East Java or
  NTB) running a **Dana Desa-style 3:1 match**; **BP2MI** as policy champion; **BRI** as
  disbursement rail + CSR co-funder. Concrete one-liner is in the §1 callout.
- ✅ **Figures verified (2023–2024):** remittances ~$14.5B (2023, World Bank); ~297k new
  PMI placements (2024, BP2MI); Dana Desa Rp71T across 75,265 villages (2024, Kemenkeu).
  See §2.4 for sources.

### Still to nail (not blocking the build)
- **Re-confirm headline numbers** the week of the deck in case 2025 data drops.
- **Bahasa pitch + UI** — decide whether the demo voiceover and slides are in Bahasa
  Indonesia for the round-one panel (recommended).
- **Test the name** on an actual PMI / Indonesian user if you can — a 2-minute gut check.

---

## 16. Glossary (for non-crypto / non-Indonesian teammates)

| Term | Plain meaning |
|---|---|
| **Patungan** | Everyday Indonesian for "everyone chips in together toward one thing." Our product name. |
| **Gotong royong** | The Indonesian national value of communal mutual cooperation. Our tagline ("gotong royong, on-chain"). |
| **PMI / TKI** | Indonesian migrant workers (*Pekerja Migran Indonesia* / *Tenaga Kerja Indonesia*). Our diaspora users. |
| **Perantau** | Someone who has left their hometown to work elsewhere/abroad. |
| **Desa / kampung halaman** | Village / one's hometown. The projects' location. |
| **Dana Desa** | Indonesia's central-government Village Funds program — the existing rail Patungan plugs into. |
| **BP2MI** | The Indonesian government agency for migrant-worker protection (a candidate funder). |
| **BUMN CSR / BRI** | State-owned-enterprise CSR funds / a major Indonesian bank (candidate funders). |
| **BAZNAS** | National zakat (Islamic giving) agency — one *optional* funding rail, not the thesis. |
| **Stellar** | A fast, very-low-fee blockchain built for payments. |
| **Soroban** | Stellar's smart-contract platform; contracts are written in **Rust**. |
| **Smart contract** | A program that runs on the blockchain, holds money, and executes rules automatically with no middleman. |
| **Quadratic Funding (QF)** | A formula that rewards *how many people* give over *how much* they give. `(Σ√contribution)²`. |
| **Matching pool** | A lump sum a sponsor puts up to be split across projects by the formula. |
| **Sybil attack** | One person pretending to be many (fake accounts) to game a "number of people" signal. |
| **Anchor** | A regulated bridge between regular money (IDR) and Stellar — how fiat gets in/out. |
| **Freighter** | A browser wallet for Stellar, used to sign transactions. |
| **Testnet** | A free practice copy of the blockchain — no real money. |
| **SEP-24** | A Stellar standard for anchor deposit/withdraw flows. |
| **3×1 (Tres por Uno)** | Mexico's real program matching migrant community remittances 3:1. Our global precedent. |

---

## 17. References

- `quadratic-funding.md` — full QF mechanism deep-dive.
- `decision-handoff.md` — decision history (note: plain migrant-remittance was parked for personal
  fit; **this collective-matching variant is a distinct product** and the team has chosen
  to pursue it).
- `../prototype-arisan/` — reusable deposit→release contract + toolchain runbook.
- `../README.md` — hackathon rules, rubric, deliverables, resources.
- Mexico "Tres por Uno" program — real-world precedent for matched collective remittances.
- Indonesia **Dana Desa** (Village Funds) — the domestic rail Patungan plugs into.
