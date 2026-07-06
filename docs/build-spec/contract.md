# Patungan — Build Spec: Contract (§5 QF algorithm + contract §10 rules)

> **Part of the split build spec** (see [`README.md`](README.md)). Read this **with**
> [`overview.md`](overview.md) (which holds the frozen §4 data model + contract API you
> implement against). This file is the **hard part**: the Quadratic Funding math. You do
> **not** need the frontend spec ([`frontend.md`](frontend.md)) for contract tasks.

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

## 10. Non-functional requirements — contract half
_(The full §10 list is split by concern; the frontend half is in [`frontend.md`](frontend.md).)_

- **Determinism:** `finalize` and `preview_matches` must return identical `matched[]` for the
  same on-chain state (no timestamp/randomness in the math).
- **Idempotent writes:** `finalize` twice, `disburse` twice, `register_verified` twice, and
  `register_project` with a duplicate id are all safely rejected/no-op (§4.5).
- **Clock/round_end:** `contribute` rejection on `now > round_end` is enforced by the
  contract. For the demo, set `round_end` far in the future so only explicit Finalise closes
  the round.
