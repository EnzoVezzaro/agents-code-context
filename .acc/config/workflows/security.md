# security.md — Security-Sensitive Changes

A procedure for changes that affect security boundaries, authentication,
authorization, cryptography, or secret handling.

## Steps

1. **Classify the change.** Determine the security impact:
   - Authentication/authorization logic
   - Cryptographic operations
   - Secret/key management
   - Input validation/sanitization
   - Access control boundaries

2. **Read relevant contracts.**
   - `AGENTS.md` for affected functionality and its dependents.
   - `.acc/config/standards/security.md` if it exists.
   - `.acc-memory.md` for known gotchas.

3. **Assess blast radius.**
   - `acc impact <dir>` — all dependents and tests.
   - `acc graph` — verify no new unauthorized paths.
   - Check `forbidden_deps` in config.

4. **Implement with care.**
   - Follow secure coding practices.
   - Use approved libraries (no rolling your own crypto).
   - Constant-time comparisons for secrets.
   - Proper error handling (no info leakage).

5. **Validate.**
   - `acc check` — no new diagnostics.
   - Security-focused tests (unit + integration).
   - Static analysis if available (`cargo audit`, `npm audit`, etc.).
   - `acc graph` — verify architecture unchanged.

6. **Document.**
   - Update `AGENTS.md` constraints if security invariants changed.
   - Add to `.acc-memory.md`: "Security change: <what>. <Rationale>. <Testing done>."
   - Consider a security advisory if user-facing.

## Notes

- Security changes require extra review. Consider requiring two approvals.
- Never commit secrets. Use `.acc-memory.md` for local notes only.
- Rotate secrets if they were exposed during development.