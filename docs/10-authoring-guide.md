# 10 — AGENTS.md Authoring Guide

> `AGENTS.md` is plain Markdown. ACC imposes **no schema** and **no
> mandatory sections**. This guide describes conventions that maximize
> the value of the ACC tooling layer while keeping the file readable by
> any coding agent that has never heard of ACC.
>
> If you write nothing else into your repository, write this. It's the
> lowest-effort, highest-leverage thing you can do for your future self
> and your agents.

---

## 1. The One Rule

> A directory with an `AGENTS.md` is a **functionality boundary**.
> One functionality = one local `AGENTS.md`.

Everything else in this guide is convention, not requirement.

---

## 2. Minimal Valid `AGENTS.md`

A single paragraph is a valid `AGENTS.md`:

```markdown
This directory contains the auth subsystem. It handles authentication,
authorization, and token management. It depends on the database module
for persisted state and on logging.
```

ACC will parse what it can (e.g., "depends on the database module" is a
weak declared-dependency hint), and the file is fully usable by any
agent without ACC. Done is better than perfect — a one-paragraph
contract beats a perfectly-formatted file that was never written.

---

## 3. Conventional Sections

ACC's heuristic parser looks for these headings (case-insensitive, prefix-matched):

| Section | What ACC Extracts | Used By |
|---------|-------------------|---------|
| `Purpose` | One-line role of the functionality. | `inspect`, `context` Hierarchy summary. |
| `Responsibilities` | Bulleted responsibilities. | `inspect`, `context` Contract. |
| `Ownership` | Owner (person, team, or owning module path). | Ownership conflict detection (`ACC03x`). |
| `Inputs` | Inputs consumed (paths or functional inputs). | `inspect`, `impact`. |
| `Outputs` | Outputs produced. | `inspect`, `context`. |
| `Dependencies` | Other functionality paths this depends on. | Declared edges (`dependency`). |
| `Constraints` | Invariants that MUST hold. | `context` Constraints, `check`. |
| `Architecture` | High-level architecture description. | `inspect`, `context`. |
| `Workflows` | Pointer to `.acc/config/workflows/<name>.md`. | `discover`, `context`. |

No file needs all of them. No file is rejected for missing any. Think
of the sections as "the more you fill in, the smarter ACC can be" —
not an exam you can fail.

---

## 4. Canonical Template

```markdown
# <Functionality name>

## Purpose

<One sentence describing what this functionality does.>

## Responsibilities

- <Responsibility 1>
- <Responsibility 2>

## Ownership

Owner: <team or module path>

## Inputs

- <Input 1>
- <Input 2>

## Outputs

- <Output 1>

## Dependencies

- <path/to/dependency>
- <path/to/another>

## Constraints

- <Invariant 1>
- <Invariant 2>

## Architecture

<Prose describing the high-level structure.>

## Workflows

- See `.acc/config/workflows/feature.md` for the standard feature workflow.
```

ACC's `acc document <path>` produces this template (optionally
pre-filled from discovery with `<!-- inferred -->` markers).

---

## 5. Writing Dependencies

### Use Paths, Not Vague Names

Prefer:

```markdown
## Dependencies

- src/database
- src/logging
```

Over:

```markdown
## Dependencies

- the database module
- logging
```

Paths are canonical references ([02 §7](./03-repository-structure.md#7-path-conventions-used-by-this-spec)). ACC resolves them to functionality boundaries. Vague names require fuzzy matching, which is less reliable and produces `ACC012` diagnostics when no matching boundary is found.

### Relative to Project Root

Paths are relative to the project root, not to the `AGENTS.md`'s own
directory. If `src/auth/AGENTS.md` depends on `src/database/`, the
entry is `src/database` (not `../database`).

### Declared vs. Discovered

Declared dependencies are the architectural **intent**. They do not
need to match discovered imports exactly — that's the point of
[04 — Epistemology §5](./04-epistemology.md#5-truth-resolution):
declared wins; mismatches surface as diagnostics.

If you declare `src/database` and the code does import `src/database`,
you've confirmed your architecture. If the code also imports `src/ui`
that you didn't declare, ACC will surface `ACC022` and `acc discover`
will suggest adding it. Disagreement is information, not failure.

---

## 6. Writing Ownership

### Single Owner Per Functionality

```markdown
## Ownership

Owner: auth-team
```

If two `AGENTS.md` files both claim the same path, `ACC030` fires.
Ownership is exclusive by design — shared ownership is modeled as a
meta-functionality that owns both (each with single-owner).

### Owner Can Be a Path

```markdown
## Ownership

Owner: src/platform
```

This declares that the `src/platform` functionality owns this one. ACC
treats path owners as `ownership` edges in the graph.

### Inferred Owners Are Never Asserted

ACC may guess an owner from heuristics (recent committers, most-touched
file). It returns the guess with `provenance.kind = "inferred"` and a
suggestion (`ACC034`), never as authoritative. Declared ownership
always wins.

---

## 7. Writing Constraints

Constraints are declared invariants. They are the most load-bearing
piece of `AGENTS.md` for `acc impact` and `acc check`.

```markdown
## Constraints

- Must not depend on src/ui.
- All public APIs must be Send + Sync.
- Database access only through src/database's connection pool.
- Token validation must complete within 50ms p99.
```

### Constraint Language

ACC does not parse constraint semantics — it treats constraints as
text, surfaced verbatim in `acc context` and `acc impact`. The
**agent** interprets them when it touches the functionality. ACC's job
is to surface the right constraints in the right context, not to
enforce them mechanically.

This is deliberate: constraints are often domain-specific prose ("must
preserve token rotation atomicity") that no static analyzer can parse.
Keeping them as plain text preserves `AGENTS.md`'s agent-readability
and ACC's language-agnosticism.

---

## 8. Cross-References and Standards

### Referencing Standards

```markdown
## Architecture

See `.acc/config/standards/architecture.md` for the project's
architecture expectations. This module follows the layered pattern
described there.
```

ACC treats this as a plain reference. There is no special link syntax.

### Referencing Other `AGENTS.md` Files

```markdown
This functionality inherits from `src/AGENTS.md` and specializes the
auth contract described in `src/auth/AGENTS.md`.
```

Inheritance is positional (directory hierarchy), not link-based
([02 §1](./03-repository-structure.md#1-agentsmd--standard-ecosystem)).
Links in prose are for the human/agent reader, not for ACC's graph
derivation.

---

## 9. Keeping `AGENTS.md` ACC-Friendly

Practices that maximize ACC's value without locking you into ACC:

- **Use paths as canonical references.** Makes declared dependencies and ownership resolvable.
- **Put one functionality per directory.** Allows `acc context` to scope accurately.
- **Declare dependencies explicitly.** Even if the code already imports them — declared dependencies are the architectural intent that wins over discovery.
- **Declare constraints as prose.** Domain-specific invariants don't need a formal language.
- **Keep sections short.** `acc context` summarizes; long sections get truncated under `--max-bytes`.
- **Use `acc document` for first drafts.** It produces the canonical template, optionally pre-filled from discovery, and with `--from-discovery` inferred entries are clearly marked `<!-- inferred -->`.

---

## 10. Anti-Patterns

### YAML Frontmatter

```markdown
---
owner: auth-team
deps: [src/database]
---
```

ACC does not parse frontmatter. The hard invariant ([01](./01-philosophy.md#13-the-hard-invariant-technical-restatement)) forbids enforcing proprietary schemas in `AGENTS.md`. Put ownership and dependencies in Markdown sections instead.

### Competing Instruction Standards

`AGENTS.md` is the primary instruction interface. Don't add
`CLAUDE.md`/`CURSOR.md`/`CODEX.md` competing files — those split
authority. If you need agent-specific notes, put them in
`.acc/config/agents/<name>.md` (profiles) or `.acc-memory.md` (durable
agent knowledge).

### Putting Memory in `AGENTS.md`

If it's architectural, it's `AGENTS.md`. If it's agent-learned and
durable but not architectural, it's `.acc-memory.md`. Don't put
gotchas, tried-and-rejected notes, or open questions in `AGENTS.md`
unless they've risen to declared invariants.

### Declaring Inferred Facts

Never write a dependency or owner based on an ACC suggestion without
reviewing it. `acc discover` suggestions are `Inferred` until a human
promotes them. Copying an inferred suggestion into `AGENTS.md` is the
promotion act — do it deliberately. ACC is great at *suggesting*; the
decision stays yours.

---

## 11. Complete Example: `src/auth/AGENTS.md`

```markdown
# auth

## Purpose

Authentication and authorization for the API, including token issuance,
validation, refresh, and revocation.

## Responsibilities

- Issue access and refresh tokens
- Validate tokens on incoming requests
- Rotate and revoke tokens
- Enforce scope-based authorization

## Ownership

Owner: auth-team

## Inputs

- HTTP Authorization headers
- Token rotation requests from clients
- Revocation events from admin API

## Outputs

- Signed JWT access tokens
- Opaque refresh tokens
- Authorization decisions (allow/deny)

## Dependencies

- src/database
- src/logging
- src/config
- src/crypto

## Constraints

- Must not depend on src/ui.
- Token validation must complete within 50ms p99.
- Refresh token rotation must be atomic.
- No secrets in logs.

## Architecture

This module follows the layered pattern from
`.acc/config/standards/architecture.md`:

- `src/auth/token/` — token issuance, validation, rotation
- `src/auth/scope/` — scope evaluation and authorization
- `src/auth/store/` — persistence via src/database

Token validation is the hot path; it uses a lock-free cache backed by
`src/crypto` for signature verification.

## Workflows

- See `.acc/config/workflows/feature.md` for the standard feature workflow.
- See `.acc/config/workflows/security.md` for security-sensitive changes.
```

---

## 12. Relationship to the AGENTS.md Ecosystem

ACC follows the inheritance convention defined by the open
[agents.md](https://agents.md/) standard — the same convention used by
Codex, Claude Code, Cursor, Copilot, OpenCode, and others:

```text
project/AGENTS.md          → project-wide context
  └── src/AGENTS.md        → src-specific context (inherits + overrides)
        └── src/auth/AGENTS.md  → auth-specific context
```

Your `AGENTS.md` files work with those tools today, unchanged. ACC
reads the same files and adds graph derivation, provenance, context
generation, and validation on top.

An agent that has never heard of ACC reads your `AGENTS.md` and gets:
- a description of the functionality
- its declared dependencies
- its constraints
- its ownership
- pointers to standards and workflows

That's enough to operate. ACC just makes it faster and more reliable.
