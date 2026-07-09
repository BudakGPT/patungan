import type { Config } from "tailwindcss";

/**
 * Patungan design tokens — the system the whole product inherits (discovery, campaign
 * detail, create, operator, dashboard, seasons). `ink`/`paper`/`cream` are the brand's
 * near-black/near-white/warm-neutral triad (used as both text and background depending on
 * surface); `accent`/`match`/`cat-*` are the existing functional roles (interaction, the
 * quadratic-match figure, category tints); `lime`/`green`/`deep`/`sea`/`gold`/`clay` are the
 * revamped demo UI's accent palette. OKLCH where precise blending matters, hex where a literal
 * hardcoded value elsewhere in globals.css needs to match exactly.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07120f",
        paper: "#fffaf0",
        cream: "#f4efe4",
        lime: "#d7ff5f",
        green: "#0d8d63",
        deep: "#083d30",
        sea: "#17a69a",
        gold: "#f6be3e",
        clay: "#cf6746",

        surface: "oklch(0.997 0.003 85 / <alpha-value>)",
        muted: "oklch(0.52 0.015 265 / <alpha-value>)",
        faint: "oklch(0.63 0.012 265 / <alpha-value>)",
        line: "oklch(0.91 0.006 265 / <alpha-value>)",
        "line-strong": "oklch(0.85 0.008 265 / <alpha-value>)",

        accent: "oklch(0.52 0.16 275 / <alpha-value>)",
        "accent-ink": "oklch(0.42 0.17 275 / <alpha-value>)",
        "accent-soft": "oklch(0.955 0.025 275 / <alpha-value>)",
        "on-accent": "oklch(0.98 0.01 275 / <alpha-value>)",

        match: "oklch(0.56 0.13 160 / <alpha-value>)",
        "match-ink": "oklch(0.46 0.12 160 / <alpha-value>)",
        "match-soft": "oklch(0.955 0.04 160 / <alpha-value>)",

        // Category tints (muted; text vs. soft-bg pairs)
        "cat-developing": "oklch(0.48 0.08 75 / <alpha-value>)",
        "cat-developing-soft": "oklch(0.955 0.035 80 / <alpha-value>)",
        "cat-disaster": "oklch(0.52 0.15 30 / <alpha-value>)",
        "cat-disaster-soft": "oklch(0.955 0.03 30 / <alpha-value>)",
        "cat-education": "oklch(0.48 0.1 220 / <alpha-value>)",
        "cat-education-soft": "oklch(0.955 0.03 220 / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Instrument Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      maxWidth: {
        page: "72rem",
      },
      boxShadow: {
        card: "0 1px 2px oklch(0.24 0.02 265 / 0.05), 0 1px 3px oklch(0.24 0.02 265 / 0.04)",
        "card-hover":
          "0 6px 16px oklch(0.24 0.02 265 / 0.08), 0 2px 6px oklch(0.24 0.02 265 / 0.05)",
        award: "0 32px 100px rgba(7, 18, 15, .22)",
        soft: "0 18px 48px rgba(7, 18, 15, .12)",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "dot-in": {
          "0%": { opacity: "0", transform: "scale(0.4)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Results reveal: a comparison bar grows from its left edge (transform-origin set inline).
        "bar-in": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        // One-time staggered entrance for the crowd-vs-whale dots (motion-safe only).
        "dot-in": "dot-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        // One-time left-anchored grow for each results row's direct/matched bar (motion-safe only).
        "bar-in": "bar-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
