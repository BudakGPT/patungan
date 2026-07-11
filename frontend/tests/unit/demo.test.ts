import { describe, expect, it } from "vitest";
import { isDemoArtifact } from "@/lib/demo";

describe("isDemoArtifact", () => {
  it("matches E2E smoke campaigns regardless of case and padding", () => {
    expect(isDemoArtifact("E2E smoke 1751971200")).toBe(true);
    expect(isDemoArtifact("  e2e SMOKE test  ")).toBe(true);
  });

  it("only matches at the start of the title", () => {
    expect(isDemoArtifact("Sekolah darurat E2E smoke")).toBe(false);
  });

  it("leaves real campaigns alone", () => {
    expect(isDemoArtifact("Perpustakaan Keliling Cianjur")).toBe(false);
    expect(isDemoArtifact("")).toBe(false);
  });
});
