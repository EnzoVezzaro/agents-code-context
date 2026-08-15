# bugfix.md — Fix a Bug

A reproducible procedure for fixing a bug in an ACC-enhanced project.

## Steps

1. **Reproduce and isolate.** Identify the functionality boundary
   containing the bug. Read its `AGENTS.md` and `.acc-memory.md`.

2. **Understand the blast radius.**
   - `acc impact <dir>` — what could break?
   - `acc dependents <dir>` — who depends on this?
   - Check constraints in affected `AGENTS.md` files.

3. **Diagnose.** Use `acc inspect <dir>`, `acc context <dir> --depth 1`,
   and source inspection to locate the root cause.

4. **Fix.** Make the minimal change to resolve the bug.

5. **Validate.**
   - Run existing tests.
   - `acc check` — ensure no new diagnostics.
   - `acc graph` — verify architecture unchanged (or intentionally changed).

6. **Update memory.** Record the fix, root cause, and any gotchas:
   - `acc memory add <dir> "Fixed <bug>: <root cause>. <lesson learned>."`

## Notes

- If the fix changes architecture, update `AGENTS.md` accordingly.
- Consider adding a regression test.