//! Quadratic-funding math — pure, chain-free (task 1.3).
//!
//! This module is the product's proof: `match ∝ (Σ√contribution)²`, so the project
//! backed by the *most people* wins the biggest match, not the one backed by one
//! whale (§1, §5). It touches no `Env`, no storage, no `require_auth` — just integers
//! — so every rule here is unit-testable in isolation. The chain glue (reading
//! `Contribution`/`Donors` from storage, writing `matched`) lands in `finalize` /
//! `preview_matches` (task 1.6), which call into these functions.
//!
//! Spec: §5.1 formula, §5.2 sqrt-the-cumulative-total-once, §5.3 remainder rule,
//! §5.4 isqrt, §5.5 overflow reasoning.
//!
//! **Overflow → `Error`:** §4.5's frozen error set has no dedicated `Overflow`
//! variant, and §5.5 proves the products stay ≤ ~4·10²⁰ ≪ `i128::MAX`, so overflow
//! is unreachable in practice. Where checked arithmetic could still fail we surface
//! `Error::InvalidAmount` (the closest "the numbers are out of range" variant) rather
//! than `panic!`, keeping the failure legible off-chain. (Decision logged in PROGRESS.)

use crate::Error;

/// Integer square root: `⌊√n⌋` for any `u128` (§5.4).
///
/// Newton's method seeded with a power-of-two **over-estimate** (`2^⌈bits/2⌉ ≥ √n`),
/// so the iteration decreases monotonically to the floor and — crucially — never
/// overflows: once `x ≥ √n` we have `n/x ≤ x`, hence `x + n/x ≤ 2x`. The naive seed
/// `x = n` would overflow `x + n/x` near `u128::MAX`; this one does not.
///
/// Satisfies `isqrt(x)² ≤ x < (isqrt(x)+1)²` across the whole range, including
/// `isqrt(u128::MAX) == 2^64 − 1`.
pub fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    // Highest set bit index + 1 = number of significant bits. `⌈bits/2⌉` gives an
    // exponent whose power of two is a strict over-estimate of √n.
    let bits = 128 - n.leading_zeros();
    let mut x = 1u128 << ((bits + 1) / 2);
    loop {
        let y = (x + n / x) / 2;
        if y >= x {
            break;
        }
        x = y;
    }
    x
}

/// Weight of one project from its running `Σ_{d} isqrt(cumulative_d)`: the square (§5.1).
///
/// The contract maintains that sum incrementally in `contribute` (replacing a donor's old
/// `isqrt` with the new one on every gift), so `finalize`/`preview_matches` read ONE
/// aggregate per project instead of every per-donor entry — O(projects), not O(donors).
pub fn weight_from_sum_sqrt(sum_sqrt: u128) -> Result<u128, Error> {
    sum_sqrt.checked_mul(sum_sqrt).ok_or(Error::InvalidAmount)
}

/// Reference weight of one project: `( Σ_{d} isqrt(cumulative_d) )²` (§5.1).
///
/// `donor_totals` holds each **distinct** donor's **cumulative** contribution to this
/// project — the sqrt is taken on the summed-per-donor total exactly once (§5.2), which
/// is what stops a single donor from inflating breadth by splitting one gift into many.
/// Non-positive entries (a 0-donor placeholder) contribute 0 and never divide by zero.
/// The chain path uses the incremental aggregate (`weight_from_sum_sqrt`); this stays as
/// the reference implementation the unit tests check that aggregate against.
#[cfg_attr(not(test), allow(dead_code))]
pub fn project_weight(donor_totals: &[i128]) -> Result<u128, Error> {
    let mut sum_sqrt: u128 = 0;
    for &c in donor_totals {
        if c <= 0 {
            continue;
        }
        sum_sqrt = sum_sqrt
            .checked_add(isqrt(c as u128))
            .ok_or(Error::InvalidAmount)?;
    }
    weight_from_sum_sqrt(sum_sqrt)
}

/// Split `pool` across projects proportional to `weights`, writing each project's
/// match into `out` (§5.1 + §5.3).
///
/// `matched[p] = pool · weight[p] / total_weight` (floor), then the floor-division
/// remainder (`pool − Σ matched`) is handed to the **largest-weight** project
/// (ties → lowest index) so the whole pool is allocated with no dust stranded.
///
/// - `total_weight == 0` (every project has 0 donors) → `Error::NothingToMatch` (§5.6).
/// - `weights` and `out` must be parallel; a length mismatch or negative `pool` is a
///   caller bug → `Error::InvalidAmount`.
pub fn compute_matches(pool: i128, weights: &[u128], out: &mut [i128]) -> Result<(), Error> {
    if weights.len() != out.len() || pool < 0 {
        return Err(Error::InvalidAmount);
    }
    let pool_u = pool as u128;

    let mut total_weight: u128 = 0;
    for &w in weights {
        total_weight = total_weight.checked_add(w).ok_or(Error::InvalidAmount)?;
    }
    if total_weight == 0 {
        return Err(Error::NothingToMatch);
    }

    let mut allocated: u128 = 0;
    let mut best_idx: usize = 0;
    let mut best_weight: u128 = 0;
    for (i, &w) in weights.iter().enumerate() {
        // pool_u·w ≤ 10⁸·4·10¹² = 4·10²⁰ ≪ u128::MAX (§5.5); checked regardless.
        let share = pool_u.checked_mul(w).ok_or(Error::InvalidAmount)? / total_weight;
        out[i] = share as i128;
        allocated += share; // Σ shares ≤ pool_u, cannot overflow.
        if w > best_weight {
            // Strict `>` keeps the lowest index on ties (§5.3).
            best_weight = w;
            best_idx = i;
        }
    }

    // remainder = pool − Σ matched ≥ 0; hand it to the largest-weight project.
    let remainder = pool_u - allocated;
    out[best_idx] += remainder as i128;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn isqrt_known_values() {
        assert_eq!(isqrt(0), 0);
        assert_eq!(isqrt(1), 1);
        assert_eq!(isqrt(2), 1);
        assert_eq!(isqrt(3), 1);
        assert_eq!(isqrt(4), 2);
        assert_eq!(isqrt(99), 9);
        assert_eq!(isqrt(100), 10);
        assert_eq!(isqrt(10_000), 100);
        assert_eq!(isqrt(100_000), 316); // 316² = 99_856 ≤ 100_000 < 317² = 100_489
        assert_eq!(isqrt(50_000), 223); // 223² = 49_729 ≤ 50_000 < 224² = 50_176
        assert_eq!(isqrt(1_000_000), 1000);
    }

    #[test]
    fn isqrt_u128_max_does_not_overflow() {
        // ⌊√(2¹²⁸−1)⌋ = 2⁶⁴−1, and the iteration must not overflow reaching it.
        assert_eq!(isqrt(u128::MAX), (1u128 << 64) - 1);
    }

    #[test]
    fn isqrt_floor_property() {
        // isqrt(x)² ≤ x < (isqrt(x)+1)² for a spread of inputs.
        for x in [0u128, 1, 2, 5, 26, 63, 64, 65, 99, 100, 10_000, 50_000, 1_000_000, 999_999_999] {
            let r = isqrt(x);
            assert!(r * r <= x, "isqrt({x})² = {} exceeds {x}", r * r);
            assert!((r + 1) * (r + 1) > x, "(isqrt({x})+1)² = {} not > {x}", (r + 1) * (r + 1));
        }
    }

    #[test]
    fn project_weight_sums_sqrt_of_each_donor() {
        // 100 donors × 10_000 → (100 · isqrt(10_000))² = (100·100)² = 100_000_000.
        let school = [10_000i128; 100];
        assert_eq!(project_weight(&school).unwrap(), 100_000_000);
        // 1 whale × 1_000_000 → (isqrt(1_000_000))² = 1000² = 1_000_000.
        assert_eq!(project_weight(&[1_000_000]).unwrap(), 1_000_000);
        // No donors / non-positive entries → weight 0 (never panics, §5.6).
        assert_eq!(project_weight(&[]).unwrap(), 0);
        assert_eq!(project_weight(&[0, -5]).unwrap(), 0);
    }

    #[test]
    fn compute_matches_whale_vs_crowd_conserves_pool() {
        // The §5.7 shape at the weight level: same direct total, different breadth.
        // School: 100×10k, Garden: 10×100k, Well: 1×1M — all raise Rp1jt direct.
        let pool = 100_000_000i128;
        let school = project_weight(&[10_000i128; 100]).unwrap();
        let garden = project_weight(&[100_000i128; 10]).unwrap();
        let well = project_weight(&[1_000_000i128; 1]).unwrap();
        let weights = [school, garden, well];
        let mut out = [0i128; 3];
        compute_matches(pool, &weights, &mut out).unwrap();

        // Ordering + magnitude: School ≫ Garden ≫ Well (the crowd wins the pool).
        assert!(out[0] > out[1], "School {} should beat Garden {}", out[0], out[1]);
        assert!(out[1] > out[2], "Garden {} should beat Well {}", out[1], out[2]);
        assert!(out[0] > pool / 2, "School {} should dominate the pool", out[0]);
        // Exact pool conservation via the remainder rule (§5.3).
        assert_eq!(out[0] + out[1] + out[2], pool);
    }

    #[test]
    fn compute_matches_remainder_goes_to_largest_weight() {
        // Two equal weights would floor to 33+33 of a pool that doesn't divide evenly;
        // the dust must land on the largest weight (here idx 1), fully allocating pool.
        let mut out = [0i128; 2];
        compute_matches(100, &[10, 90], &mut out).unwrap();
        assert_eq!(out[0] + out[1], 100);
        assert_eq!(out[0], 10); // 100·10/100
        assert_eq!(out[1], 90); // 100·90/100 (+ remainder 0 here)

        // Force a remainder: pool 100, weights 1 & 2 → floor 33 + 66 = 99, dust 1 → idx1.
        let mut out2 = [0i128; 2];
        compute_matches(100, &[1, 2], &mut out2).unwrap();
        assert_eq!(out2, [33, 67]);
        assert_eq!(out2[0] + out2[1], 100);
    }

    #[test]
    fn compute_matches_zero_donor_project_gets_zero() {
        // A 0-weight project receives 0 and never causes a divide-by-zero (§5.6).
        let mut out = [0i128; 3];
        compute_matches(90, &[0, 5, 5], &mut out).unwrap();
        assert_eq!(out[0], 0);
        assert_eq!(out[0] + out[1] + out[2], 90);
    }

    #[test]
    fn compute_matches_all_zero_weight_is_nothing_to_match() {
        let mut out = [0i128; 2];
        assert_eq!(
            compute_matches(100, &[0, 0], &mut out),
            Err(Error::NothingToMatch)
        );
    }
}
