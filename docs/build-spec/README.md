# Patungan — Build Spec (split by concern)

The frozen technical spec, split into per-concern files so each task loads **only what it
needs** instead of the whole 10k-token document every iteration. **Section numbers (§) are
global** — they didn't change; they were just partitioned across these files. Any `§N`
citation in `BACKLOG.md` / `PROGRESS.md` resolves via the map below.

## How to read it (per iteration)

1. **Always read [`overview.md`](overview.md)** — product context, tech stack, repo layout,
   the frozen contract API (§4), env (§11), Definition of Done (§12), scope (§14).
2. **Then read the ONE file for your task's phase** (below). Don't read the others.

| Your task is in… | Phase | Read (besides `overview.md`) |
|---|---|---|
| Contract / QF math | Phase 1 | [`contract.md`](contract.md) — §5, contract §10 |
| Deploy · bindings · seed | Phases 2–3 | [`ops.md`](ops.md) — §8, §9 (bindings need only §4 in overview) |
| Frontend (any) | Phases 4–8 | [`frontend.md`](frontend.md) — §6, §7, frontend §10 |
| End-to-end demo dry-run | Phase 9 | [`ops.md`](ops.md) — §9, plus the relevant epic file |

## Section → file map

| § | Topic | File |
|---|---|---|
| §1 | Product context | [`overview.md`](overview.md) |
| §2 | Tech stack | [`overview.md`](overview.md) |
| §3 | Repo layout | [`overview.md`](overview.md) |
| **§4** | **Data model & contract interface (FROZEN API)** | [`overview.md`](overview.md) |
| §5 | Quadratic Funding algorithm | [`contract.md`](contract.md) |
| §6 | Frontend architecture | [`frontend.md`](frontend.md) |
| §7 | Feature specs (Epics A–F) | [`frontend.md`](frontend.md) |
| §8 | Seed script | [`ops.md`](ops.md) |
| §9 | Demo script (e2e acceptance) | [`ops.md`](ops.md) |
| §10 | Non-functional — contract half | [`contract.md`](contract.md) |
| §10 | Non-functional — frontend half | [`frontend.md`](frontend.md) |
| §11 | Environment & config | [`overview.md`](overview.md) |
| §12 | Definition of Done | [`overview.md`](overview.md) |
| §14 | Out of scope | [`overview.md`](overview.md) |
| §15 | Glossary | [`overview.md`](overview.md) |

> §13 (the task ledger) moved to [`../../BACKLOG.md`](../../BACKLOG.md) long ago.
