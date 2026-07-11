import { describe, expect, it } from "vitest";
import {
  formatIDR,
  formatCompactIDR,
  formatCountdown,
  truncateAddress,
} from "@/lib/format";

describe("formatIDR", () => {
  it("renders integers with id-ID grouping", () => {
    expect(formatIDR(0)).toBe("Rp0");
    expect(formatIDR(50_000)).toBe("Rp50.000");
    expect(formatIDR(1_234_567)).toBe("Rp1.234.567");
  });

  it("accepts bigint (token amounts come off-chain as i128)", () => {
    expect(formatIDR(9_007_199_254_740_993n)).toBe("Rp9.007.199.254.740.993");
  });

  it("truncates fractional numbers toward zero", () => {
    expect(formatIDR(1234.9)).toBe("Rp1.234");
  });
});

describe("truncateAddress", () => {
  it("keeps first 4 and last 4 of a Stellar address", () => {
    expect(truncateAddress("GBO6MF56C7EWFCXX2FNL4OTECCHD2K6CLKXN7ROQVYDWKJWVXUUHJVP6")).toBe(
      "GBO6…JVP6",
    );
  });

  it("leaves short strings untouched", () => {
    expect(truncateAddress("GABC12345678")).toBe("GABC12345678");
    expect(truncateAddress("")).toBe("");
  });
});

describe("formatCountdown", () => {
  const units = { day: " hr", hour: " jam", min: " mnt" };
  const now = 1_800_000_000_000; // fixed ms epoch so tests never race the clock
  const nowSec = now / 1000;

  it("returns null once the deadline has passed", () => {
    expect(formatCountdown(nowSec, units, now)).toBeNull();
    expect(formatCountdown(nowSec - 1, units, now)).toBeNull();
  });

  it("shows days + hours when more than a day remains", () => {
    const end = nowSec + 2 * 86_400 + 5 * 3_600 + 30 * 60;
    expect(formatCountdown(end, units, now)).toBe("2 hr 5 jam");
  });

  it("shows hours + minutes under a day", () => {
    const end = nowSec + 3 * 3_600 + 12 * 60;
    expect(formatCountdown(end, units, now)).toBe("3 jam 12 mnt");
  });

  it("shows minutes only under an hour", () => {
    expect(formatCountdown(nowSec + 45 * 60, units, now)).toBe("45 mnt");
  });

  it("floors sub-minute remainders to '< 1'", () => {
    expect(formatCountdown(nowSec + 30, units, now)).toBe("< 1 mnt");
  });

  it("accepts bigint deadlines (round_end is u64)", () => {
    expect(formatCountdown(BigInt(nowSec + 45 * 60), units, now)).toBe("45 mnt");
  });
});

describe("formatCompactIDR", () => {
  it("renders billions with one decimal", () => {
    expect(formatCompactIDR(1_500_000_000)).toBe("Rp1,5M");
  });

  it("renders millions with two decimals under 10jt, one above", () => {
    expect(formatCompactIDR(1_250_000)).toBe("Rp1,25jt");
    expect(formatCompactIDR(12_300_000)).toBe("Rp12,3jt");
  });

  it("rounds thousands to whole rb", () => {
    expect(formatCompactIDR(850_000)).toBe("Rp850rb");
    expect(formatCompactIDR(1_000)).toBe("Rp1rb");
  });

  it("falls back to full IDR under Rp1.000", () => {
    expect(formatCompactIDR(999)).toBe("Rp999");
    expect(formatCompactIDR(0)).toBe("Rp0");
  });
});
