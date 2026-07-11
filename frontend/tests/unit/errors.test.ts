import { afterEach, describe, expect, it, vi } from "vitest";
import { mapContractError } from "@/lib/errors";

const base = {
  generic: "Terjadi kesalahan.",
  rejected: "Tanda tangan dibatalkan.",
  NotVerified: "Wallet belum terverifikasi.",
  TierTooLow: "Tier belum cukup.",
  InvalidAmount: "Jumlah tidak valid.",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapContractError", () => {
  it("maps user rejection phrasing to the rejected copy", () => {
    expect(mapContractError(new Error("User declined access"), base)).toBe(base.rejected);
    expect(mapContractError(new Error("Request was rejected"), base)).toBe(base.rejected);
    expect(mapContractError(new Error("cancelled by user"), base)).toBe(base.rejected);
  });

  it("maps a bare on-chain variant name (result.isErr path)", () => {
    expect(mapContractError(new Error("NotVerified"), base)).toBe(base.NotVerified);
  });

  it("extracts Error(Contract, #N) from simulation failures and translates via bindings", () => {
    const sim = new Error(
      'Transaction simulation failed: "HostError: Error(Contract, #22)" — event log follows',
    );
    expect(mapContractError(sim, base)).toBe(base.TierTooLow);
    expect(mapContractError(new Error("Error(Contract, #11)"), base)).toBe(base.InvalidAmount);
  });

  it("prefers caller overrides over the base catalog", () => {
    const sim = new Error("Error(Contract, #22)");
    expect(mapContractError(sim, base, { TierTooLow: "Khusus panel ini." })).toBe(
      "Khusus panel ini.",
    );
  });

  it("falls back to generic for unknown failures (and logs the raw error)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapContractError(new Error("something exploded"), base)).toBe(base.generic);
    expect(mapContractError("plain string failure", base)).toBe(base.generic);
    expect(mapContractError(undefined, base)).toBe(base.generic);
    expect(spy).toHaveBeenCalled();
  });

  it("falls back to generic when the contract code is not in the bindings", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapContractError(new Error("Error(Contract, #99)"), base)).toBe(base.generic);
    expect(spy).toHaveBeenCalled();
  });
});
