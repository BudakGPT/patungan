# Patungan — Build Spec (moved: now split under `build-spec/`)

> **This file is a pointer.** The frozen technical spec was split by concern into
> [`build-spec/`](build-spec/) so each loop iteration loads only the sections it needs
> (instead of re-reading one ~10k-token document every pass). **Do not read a whole spec
> file end-to-end** — read `overview.md` + your phase's file.

**Start here → [`build-spec/README.md`](build-spec/README.md)** (the section→file and
phase→file map). Quick jump:

| File | Sections | Read when |
|---|---|---|
| [`build-spec/overview.md`](build-spec/overview.md) | §1–§4, §11–§12, §14–§15 | **always** (context + frozen contract API §4 + env + DoD) |
| [`build-spec/contract.md`](build-spec/contract.md) | §5, contract §10 | contract / QF-math tasks (Phase 1) |
| [`build-spec/frontend.md`](build-spec/frontend.md) | §6–§7, frontend §10 | frontend tasks (Phases 4–8) |
| [`build-spec/ops.md`](build-spec/ops.md) | §8–§9 | deploy · seed · demo dry-run (Phases 2–3, 9) |

All `§N` references elsewhere (BACKLOG, PROGRESS) still resolve — the section numbers are
unchanged, just partitioned. See the map in [`build-spec/README.md`](build-spec/README.md).
