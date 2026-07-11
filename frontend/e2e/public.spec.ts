import { test, expect, type Page } from "@playwright/test";

/**
 * Wallet-free smoke over the public surfaces, in both shipped locales. Assertions target the app
 * shell (the always-present "Patungan home" brand link) and localized page copy — never live chain
 * figures, which the CI RPC may not have. Locale is pinned via localStorage before first paint, the
 * same key `lib/locale.tsx` reads.
 */

type Locale = "id" | "en";

// The stable, localized anchors each surface renders regardless of chain state.
const copy: Record<Locale, {
  directoryHeading: string;
  seasonsTitle: string;
  resultsTitle: string;
  notFoundTitle: string;
  sortLabel: string;
  newestLabel: string;
}> = {
  id: {
    directoryHeading: "Jelajahi kampanye",
    seasonsTitle: "Arsip musim",
    resultsTitle: "Hasil pencocokan",
    notFoundTitle: "Halaman tidak ditemukan",
    sortLabel: "Urutkan",
    newestLabel: "Terbaru",
  },
  en: {
    directoryHeading: "Explore campaigns",
    seasonsTitle: "Season archive",
    resultsTitle: "Matching results",
    notFoundTitle: "Page not found",
    sortLabel: "Sort",
    newestLabel: "Newest",
  },
};

const brandHome = (page: Page) => page.getByRole("link", { name: "Patungan home" });

for (const locale of ["id", "en"] as const) {
  test.describe(`public surfaces — ${locale}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript((l) => {
        window.localStorage.setItem("patungan:locale", l);
      }, locale);
    });

    test("landing renders the hero and localized directory", async ({ page }) => {
      await page.goto("/");
      await expect(brandHome(page)).toBeVisible();
      // "Crowd beats whale." is a brand-register slogan, constant across locales.
      await expect(page.getByRole("heading", { name: /beats/i })).toBeVisible();
      await expect(page.getByText(copy[locale].directoryHeading)).toBeVisible();
    });

    test("campaign sort menu opens and commits a selection", async ({ page }) => {
      await page.goto("/campaigns");
      const trigger = page.getByRole("button", { name: copy[locale].sortLabel });
      await trigger.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await trigger.click();
      await expect(page.getByRole("listbox", { name: copy[locale].sortLabel })).toBeVisible();
      await page.getByRole("option", { name: copy[locale].newestLabel }).click();
      await expect(trigger).toContainText(copy[locale].newestLabel);
    });

    test("seasons archive loads", async ({ page }) => {
      await page.goto("/seasons");
      await expect(brandHome(page)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: copy[locale].seasonsTitle }),
      ).toBeVisible();
    });

    test("results page loads", async ({ page }) => {
      await page.goto("/results");
      await expect(brandHome(page)).toBeVisible();
      const heading = page.getByRole("heading", { name: copy[locale].resultsTitle });
      await expect(heading).toBeVisible();
      expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    });

    test("campaign detail renders its shell", async ({ page }) => {
      // No live data required — the route mounts its shell (header/footer) either way.
      await page.goto("/campaign/1");
      await expect(brandHome(page)).toBeVisible();
    });

    test("unknown route serves the 404", async ({ page }) => {
      await page.goto("/no-such-route");
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(page.getByText(copy[locale].notFoundTitle)).toBeVisible();
    });
  });
}
