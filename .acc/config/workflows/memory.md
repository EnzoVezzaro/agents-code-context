# memory.md — Capture Durable Knowledge

A reproducible procedure for capturing knowledge discovered during development
that should remain available to future agents and sessions.

## What belongs in memory?

Memory is for useful knowledge that does not belong in an `AGENTS.md` contract.

Good candidates include:

- **Gotchas** — unexpected behavior or non-obvious requirements.
- **Tried and rejected** — approaches that were tested and intentionally
  abandoned, including why.
- **Open questions** — unresolved issues worth revisiting.
- **Operational knowledge** — useful commands, procedures, or environment
  details.
- **Implementation discoveries** — facts learned while working with the
  codebase that are useful to future work.

Do not use memory for:

- Architecture or functionality boundaries.
- Ownership or dependencies.
- Coding rules or project requirements.
- Stable constraints that should be enforced.
- Temporary task state.
- Information that belongs in `AGENTS.md`.

If the information should constrain how future code is written, it probably
belongs in `AGENTS.md`, not memory.

## Steps

1. **Identify the scope.**

   Determine which functionality the knowledge applies to.

   Memory should live at the narrowest useful scope:

   ```text
   src/
   └── auth/
       ├── AGENTS.md
       └── .acc-memory.md