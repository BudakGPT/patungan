#!/usr/bin/env node
/**
 * Rejects Tailwind color-opacity modifiers that are not multiples of 5.
 *
 * This project's Tailwind config only generates alpha classes in steps of 5, so
 * `bg-white/8` or `border-lime/42` silently produce NO class at all — the element
 * renders unstyled and nothing warns. That bug has shipped twice; this makes it a
 * CI failure instead.
 *
 * Matches `<utility-color>/<n>` where the token before the slash ends in a letter
 * (color names always do), which keeps fraction utilities like `w-1/2` and
 * arbitrary values like `aspect-[16/9]` out of scope.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "src"];
const EXT = /\.(tsx?|css)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", "contract"]);
// A color token ends in a letter; a following /<int> is an opacity modifier.
const ALPHA = /[a-z][a-z0-9-]*[a-z]\/(\d{1,3})(?!\d|%|\])/g;

const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
    } else if (EXT.test(entry.name)) {
      check(join(dir, entry.name));
    }
  }
}

function check(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // URLs and import paths are not utility classes.
    if (/https?:\/\//.test(line)) return;
    for (const m of line.matchAll(ALPHA)) {
      const step = Number(m[1]);
      if (step % 5 !== 0) {
        failures.push(`${relative(process.cwd(), file)}:${i + 1}  ${m[0]} (alpha ${step} is not a multiple of 5 — no class is generated)`);
      }
    }
  });
}

for (const root of ROOTS) walk(root);

if (failures.length > 0) {
  console.error("Tailwind alpha-step check failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}
console.log("alpha-step check: OK");
