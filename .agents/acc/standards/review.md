# review.md — ACC Code Review Guidelines

This standard defines the code review process for the ACC project.

## Review Checklist

### Architecture

- [ ] Changes respect functionality boundaries (one `AGENTS.md` per boundary).
- [ ] Dependencies declared in `AGENTS.md` using canonical paths.
- [ ] Constraints updated if architecture invariants changed.
- [ ] Ownership clear and non-conflicting.
- [ ] `acc check` passes with no new error-level diagnostics.

### Code Quality

- [ ] Code follows language style guides (rustfmt, prettier, gofmt, black).
- [ ] Linting passes (`cargo clippy`, `eslint`, `golangci-lint`, `ruff`).
- [ ] Tests added for new functionality; existing tests pass.
- [ ] No dead code, unused imports, or commented-out code.
- [ ] Error handling is appropriate (no unwrap/expect in production paths).

### Documentation

- [ ] `AGENTS.md` updated for new/modified functionality boundaries.
- [ ] `.acc-memory.md` updated for durable knowledge (gotchas, decisions).
- [ ] `docs/` updated if CLI surface or JSON schema changed.
- [ ] Inferred content in `AGENTS.md` marked `<!-- inferred -->`.
- [ ] No proprietary schemas (YAML frontmatter, etc.) in `AGENTS.md`.

### Security

- [ ] No code execution, network calls, or arbitrary command invocation.
- [ ] No secrets, tokens, or credentials in code or docs.
- [ ] Path traversal prevented (ACC080).
- [ ] Input validation on all external inputs.

### Multi-Agent (if applicable)

- [ ] Multi-agent config changes validated (`acc check`).
- [ ] Resource limits reasonable for the task.
- [ ] Isolation mode supported on target platforms.
- [ ] Conflict policy appropriate for the change type.

## Review Process

1. **Automated checks** run in CI: lint, test, `acc check`, `acc graph`.
2. **Reviewer** assigned (see `.agents/acc/agents/reviewer.md`).
3. **Architect review** required for architecture changes (see `architect.md`).
4. **Security review** required for security-sensitive changes (see `security.md` workflow).
5. **Approval** from at least one reviewer + architect if applicable.
6. **Merge** after CI passes and approvals granted.

## Review Etiquette

- Be constructive and specific.
- Reference `ACC0xx` codes for architectural issues.
- Distinguish between blocking (error) and non-blocking (warn/info) feedback.
- Prefer questions over demands for subjective items.
- Approve when concerns are addressed; don't nitpick style if linting passes.