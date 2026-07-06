# Idea Deep-Dive — Quadratic Funding on Stellar

> **⏱️ Status: superseded / historical.** The open questions below were resolved and the
> project is now **locked as "Patungan"** — see [`prd.md`](prd.md) for the committed spec.
> This doc is kept as the mechanism deep-dive and decision trail; read it for the *why*
> behind the QF math, not for current status.

> Full capture of the Quadratic Funding (QF) concept explored on 2026-06-28.
> Covers the problem, the mechanism, the money flow, on-chain necessity, the
> honest weaknesses (urgency, Sybil, sponsor pool), track fit, and open decisions.
> This is a *candidate*, not a committed decision. Sibling docs: `decision-handoff.md`.

## TL;DR
- **What:** A donation platform where a sponsor's **matching pool** is split across
  community causes by a **Quadratic Funding formula** — so *breadth of support*
  (how many people give) beats *size of wallet* (how much one rich donor gives).
- **The hook:** `$1 from 100 people` beats `$100 from 1 person`. The crowd's
  collective choice decides where the big money goes.
- **On-chain necessity: HIGH.** The contract is the *trusted calculator* — it holds
  the pool, witnesses every donation on-chain, runs the formula, and disburses, all
  publicly verifiable and tamper-proof. Off-chain = back to trusting a spreadsheet.
- **Why Stellar specifically:** near-zero fees make on-chain micro-donations viable
  (impossible on Ethereum). QF *needs* exactly what Stellar is good at.
- **Track:** Payment & Consumer (it's disbursement). Innovation score carried by the
  mechanism, not by AI.
- **Honest weakness:** it's **important, not urgent** (see §7). Differentiation and
  cleverness are strong; acute personal pain is weak.

---

## 1. The problem it solves
There's a **pot of money to give away** (a company CSR budget, a government community
fund, a philanthropist's donation) that must be split across **many community causes**
(school repair, clean-water well, flood relief, community library).

How do you decide the split? The two normal ways are both broken:

1. **"Whoever raises the most wins"** → causes backed by rich donors dominate.
   Money = power. A cause 500 ordinary villagers care about loses to one big check.
2. **"A committee decides"** → subjective, opaque, *captureable* (lobbying,
   favoritism, kickbacks). Especially resonant in APAC, where opaque allocation of
   public/grant money is a felt problem.

> **The gap:** How do you split a shared pot across community causes so it reflects
> **what the most people actually want** — not the richest donor, not a corruptible
> committee?

QF is a mathematical answer to exactly that question.

## 2. The core insight
**The *number* of people who support a cause matters more than the *amount* of money.**

Two causes both raised **$100 directly**:
- Cause A: **1 person** gave $100.
- Cause B: **100 people** gave $1 each.

Same money raised — but B is the better *community* cause (100 people caring is a far
stronger signal than 1). So QF gives **B a much bigger share of the matching pool.**
*Breadth of support beats size of wallet.* The square-root math just enforces this.

## 3. How the money actually flows
There are **two participants in different seats** who experience QF completely
differently:

- **Donor's seat = pure charity.** You browse causes, pick one you care about, give
  to it. No ownership, no return. Exactly like Kitabisa. The *only* twist: your
  donation does **double duty** — it funds the cause **and** acts as a vote that pulls
  extra matching money toward it.
- **Sponsor's seat = crowd-directed allocation.** The sponsor drops **one big lump
  sum** into the pool and does **not** pick which causes get it. The crowd's donation
  pattern decides the split. (Loosely "index-fund-like" — but no ownership/returns,
  so really: *the crowd votes with donations on how the sponsor's pool is divided.*)

### The contract is the central hub — everything passes through it
```
  Sponsor's matching pool ──┐
                            ├──►  [ SOROBAN CONTRACT ]  ──►  payouts to causes
  Every small donation ─────┘     (holds money + records
                                   who → how much → which cause)
```

### Step-by-step (one funding "round")
1. **Before the round** — sponsor commits the **matching pool** (e.g. $10,000) into
   the contract. Projects register (📚 Library, 💧 Well, 🌱 Garden).
2. **During the round (~2 weeks)** — people donate to causes they pick. Money flows
   *through the contract*, earmarked to the cause. The contract records **who gave
   how much to which cause** on-chain.
3. **End of round** — the contract runs the QF formula on the donation *pattern* and
   splits the matching pool by breadth of support.
4. **Final payout = direct donations + matching share.**

## 4. The worked example (this is also the demo)
Matching pool: **$10,000.** Three projects each raise **the same $100**, differently:

| Cause | How it raised $100 | Direct | Matching (from pool) | **Total** |
|---|---|---|---:|---:|
| 📚 Library | 100 people × $1 | $100 | ~$9,009 | **~$9,109** |
| 🌱 Garden | 10 people × $10 | $100 | ~$901 | **~$1,001** |
| 💧 Well | 1 donor × $100 | $100 | ~$90 | **~$190** |

All three raised *exactly $100 directly* — yet the library, backed by the most people,
walks away with ~$9,100. **The crowd's breadth decided the allocation, not the dollars.**
This counterintuitive table *is* the 30-second pitch.

### The math
QF weight per cause = `(sum of √contributions)²`, then the matching pool is split in
proportion to weights.
- Library: `(100 × √1)²` = `100²` = **10,000**
- Garden: `(10 × √10)²` = `(10 × 3.16)²` ≈ **1,000**
- Well: `(1 × √100)²` = `10²` = **100**
- Total weight = 11,100 → each cause's matching = `(weight / 11,100) × $10,000`.

The square root **dampens large individual donations and rewards many small ones.**

## 5. Why it MUST be on-chain (the judges' #1 test)
The formula runs on the **donation pattern** — how many distinct people gave to each
cause, and how much. That pattern is the *entire input* to the fairness math.

If donations happened **off-chain**, a human controls the record of who donated → they
could invent fake donors, hide some, or tilt the match → the "tamper-proof fairness"
promise collapses. The **only** way matching can be provably fair is if the **contract
itself witnesses every single donation in public.**

→ So the everyday donations are **not** peripheral; they are the core data the contract
exists to protect. "The contract is the hero" *precisely because* it counts every vote
trustlessly. Remove the blockchain and the product gets worse — it passes the test.

## 6. Why Stellar is the right chain
Every $1 donation is an on-chain transaction with a fee. On Ethereum, gas would eat a
$1 donation. **Stellar's identity is near-zero fees** (fractions of a cent) + fast
settlement → **on-chain micro-donations are viable here.** QF *needs* exactly what
Stellar is good at — strong material for the "deep use of Stellar's real strengths"
innovation criterion (20%).

## 7. Honest weakness — important, not urgent
QF is **high-importance, low-urgency.** "Allocate shared money more fairly" is
*important* but nobody is in acute pain about it *right now*. Structural reason: **QF
is infrastructure for the people *giving* money, not relief for a person *in pain*.**
Its user is a funder optimizing fairness, not a victim escaping a problem.

### Reframes that inject urgency (with honest ratings)
1. **Change protagonist to "the one who keeps losing"** — the grassroots organizer
   whose 500 supporters never beat one rich man's check. *Human and real, but
   chronic, not acute.*
2. **Disaster relief (a clock!)** — money floods in after a quake/flood and gets
   allocated by media bias / official connections while people suffer. *Most urgent
   framing, BUT hits the reachable-user wall — disaster victims can't use wallets in
   the moment.*
3. **Funder's own urgency: post-scandal trust** — after a corruption scandal (e.g.
   post-ACT), an institution urgently needs allocation it can *prove* it doesn't
   control. *Real acute institutional urgency, but B2B — less demo-legible.*

**Meta-point:** every reframe *imports* urgency from outside; none lives inside QF
itself. QF's superpower is fairness + elegance, not urgency. It competes on
"important + clever + tamper-proof," not "someone's in pain."

## 8. Track fit
- **Primary: Payment & Consumer** — it is disbursement of money to people.
- The **mechanism** (not AI) is the differentiator → earns Innovation (20%).
- Strong APAC framing options: participatory community budgeting, CSR allocation,
  disaster relief, funding local creators / public goods.
- Sharpest framing: **"corruption-resistant, community-driven allocation of public or
  CSR money."** Villain = opaque, capturable, top-down allocation. QF = the hero.

## 9. Comparison to neighbours (why we landed here)
- vs. **plain charity / Kitabisa-on-chain** — that's a *theme* and cliché; "donations
  on blockchain" fails the on-chain test by default. QF differentiates on a
  *mechanism* a database can't fake. Much lower cliché risk.
- vs. **AI-driven donation allocator** — rejected: over-indexed on AI (AI was the
  hero, contract was a payout pipe) and the AI became a new black-box middleman that
  *re-created* the trust problem. Also killed donor choice. QF keeps donor choice and
  makes the *contract* the hero.
- vs. **royalty splitter / escrow** — same underlying deposit→weighted-split engine
  (the engine recurs across every idea explored). QF's weights come from the crowd's
  donation pattern; royalties' from pre-agreed shares.

## 10. Risks / open questions to resolve before committing
1. **Who provides the matching pool in an APAC setting?** No sponsor → no magic. This
   is the make-or-break, fundability AND urgency question. *(Unresolved.)*
2. **Sybil attacks** — fake donors gaming the "number of donors" signal. Mitigate with
   light identity-gating, or scope as a stated limitation (naming it shows depth).
   This is the key technical grilling point.
3. **Urgency** — is "acute, felt pain" actually the top filter? If yes, QF is a hard
   fit and the escrow family scores higher on urgency. If urgency is one factor among
   several, QF survives on importance. *(Open — see `decision-handoff.md` decision lens.)*
4. **Integer square root in Rust/Soroban** — the one fiddly bit of on-chain math
   (fixed-point / integer sqrt). Arithmetic, doable, but needs care.

## 11. Buildability (solo, new to Rust, ~17 days)
- Core contract: register projects → accept + record donations tagged to a project →
  hold the matching pool → at round end compute QF weights and disburse.
- Reuses the existing **deposit → weighted-split** engine pattern (≈ shared with the
  arisan/escrow prototype).
- Only genuinely new piece: on-chain integer sqrt for the formula.
- Demo: show a whale dump on Cause A and 50 small donors on Cause B → matching flows
  *more* to B. That single counterintuitive moment is the whole pitch.

## 12. Next decisions
1. **Settle the matching-pool question (§10.1)** — who funds it in APAC? This gates
   whether QF is real or just an elegant demo.
2. **Decide if urgency is a make-or-break filter (§10.3).** If yes, reconsider vs.
   escrow; if no, proceed with QF on importance.
3. Pick the **specific APAC framing** (community budgeting vs. CSR vs. disaster) — it
   reshapes the demo and pitch.
4. Then: spec the contract and install the Rust/Stellar toolchain (day-0 work, still
   absent per `decision-handoff.md`).
