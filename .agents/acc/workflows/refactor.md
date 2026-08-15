# refactor.md — Refactor a Functionality

A reproducible procedure for refactoring a functionality boundary.

## Steps

1. **Understand the current architecture.**
   - `acc graph --format mermaid` — visualize current state.
   - `acc context <dir> --depth 2` — deep context including dependents.
   - Read `AGENTS.md` and `.acc-memory.md` for the functionality and its dependents.

2. **Define the target architecture.** Document the desired end state
   in a design doc or directly in the target `AGENTS.md` (draft).

3. **Check constraints.**
   - `acc impact <dir>` — full blast radius.
   - `acc check` — ensure no pre-existing violations.
   - Verify no forbidden dependencies will be introduced.

4. **Plan the migration.** Break into small, verifiable steps:
   - Each step should pass `acc check`.
   - Each step should maintain working tests.
   - Use `acc discover` to find undeclared dependencies that need handling.

5. **Execute incrementally.** For each step:
   - Make the change.
   - Run tests.
   - `acc check`.
   - Update `AGENTS.md` if architecture changed.
   - Commit.

6. **Final validation.**
   - `acc check` — clean.
   - `acc graph` — matches target architecture.
   - Full test suite passes.

7. **Update memory.** Record decisions, trade-offs, and migration notes:
   - `acc memory add <dir> "Refactored <X> to <Y>. <Rationale>. <Trade-offs>."`

## Notes

- Prefer small, reversible steps over big bang rewrites.
- Keep `AGENTS.md` in sync with reality throughout.
- Consider feature flags for risky changes.