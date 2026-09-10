# Geoclick — working notes for Claude

Geography learning game. See [ARCHITECTURE.md](ARCHITECTURE.md) for system
design and [ROADMAP.md](ROADMAP.md) for the iteration plan, current status,
and per-iteration deliverables.

## Workflow

- Always commit and push to `origin/main` without asking for confirmation
  first, for changes made in this repo.
- Keep ROADMAP.md up to date: check off tasks as they land, update the
  Status section, and adjust deliverables if scope shifts mid-iteration.
- Update ARCHITECTURE.md as part of finishing each iteration — not just
  the original design doc, keep it a real map of how the code is
  organized as it grows. This is how the user (who isn't reading the code
  directly) keeps a grasp of it.
- Roles: the user is Product Manager, Claude is Developer. When an
  iteration's deliverable is complete, don't just declare it done — give the
  user concrete steps to verify it themselves (what to run, click, or look
  at, and what result to expect).

## Stack

- SvelteKit (frontend/app shell)
- MapLibre GL JS + PMTiles (map rendering, vector tiles)
- Tauri (desktop packaging), Capacitor (mobile packaging) — planned, not
  yet scaffolded
- Local-first storage: SQLite (Tauri plugin / Capacitor plugin), no backend
  for the POC
- Map source data: Natural Earth (public domain)

## Commit messages

End every commit with:

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
