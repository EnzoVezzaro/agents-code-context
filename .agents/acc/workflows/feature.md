# feature.md — Add a New Functionality

A reproducible procedure for adding a new functionality boundary to an
ACC-enhanced project.

## Steps

1. **Isolate the functionality.** Identify the directory that will own
   the new functionality boundary. A functionality is a directory
   containing an `AGENTS.md`.

2. **Read the parent context.** Read the nearest ancestor `AGENTS.md`
   to understand inheritable context (purpose, constraints, dependencies).

3. **Draft the local contract.**
   - Run `acc document <dir>` for a conservative template (stdout).
   - If useful, run `acc document <dir> --from-discovery` to pre-fill
     discovered dependencies and owners. Inferred fields are marked
     `<!-- inferred -->`; review them before promotion.
   - Review, edit, and commit `<dir>/AGENTS.md`. Inferred entries become
     declared only once they survive human review.

4. **Implement the functionality.** Write the code under `<dir>`.

5. **Validate.**
   - `acc check` — broken references, forbidden deps, duplicate
     ownership, stale docs.
   - `acc graph` — confirm relationships match intent.
   - `acc impact <dir>` — identify affected tests and dependents.
   - Fix any `error`-level diagnostics before merging.

6. **Update memory.** If you learned something durable that isn't
   architectural (gotchas, tried-and-rejected, open questions), append
   to `<dir>/.acc-memory.md`:
   - `acc memory add <dir> "<text>"`, or
   - edit `.acc-memory.md` directly — it's plain Markdown.

## Notes

- `.acc-memory.md` is gitignored. Don't commit it.
- Never declare a dependency or owner based solely on an `acc discover`
  suggestion. Promote `Inferred` → `Declared` deliberately.
- The `acc` CLI is optional for this workflow; the fallback is reading
  `AGENTS.md`, source, and `.acc-memory.md` directly.