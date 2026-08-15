# 09 — AGENTS.md Authoring Guide

> `AGENTS.md` is plain Markdown. ACC imposes **no schema** and
> **no mandatory sections**. This guide describes conventions that
> maximize the value of the ACC tooling layer while keeping the file
> readable by any coding agent that has never heard of ACC.

---

## 1. The one rule

> A directory with an `AGENTS.md` is a **functionality boundary**.
> One functionality = one local `AGENTS.md`.

Everything else in this guide is convention, not requirement.

---

## 2. Minimal valid `AGENTS.md`

A single paragraph is a valid `AGENTS.md`:

```markdown
This directory contains the audio subsystem. It handles playback,
recording, and format conversion. It depends on the database module
for persisted state and on logging.
```

ACC will parse what it can (e.g. "depends on the database module" is a
weak declared-dependency hint), and the file is fully usable by any
agent without ACC.

---

## 3. Conventional sections

ACC's heuristic parser looks for these headings (case-insensitive,
prefix-matched):

| Section | What ACC extracts | Used by |
|---|---|---|
| `Purpose` | One-line role of the functionality. | `inspect`, `context` Hierarchy summary. |
| `Responsibilities` | Bulleted responsibilities. | `inspect`, `context` Contract. |
| `Ownership` | Owner (person, team, or owning module path). | Ownership conflict detection (`ACC03x`). |
| `Inputs` | Inputs consumed (paths or functional inputs). | `inspect`, `impact`. |
| `Outputs` | Outputs produced. | `inspect`, `context`. |
| `Dependencies` | Other functionality paths this depends on. | Declared edges (`dependency`). |
| `Constraints` | Invariants that MUST hold. | `context` Constraints, `check`. |
| `Architecture` | High-level architecture description. | `inspect`, `context`. |
| `Workflows` | Pointer to `.agents/acc/workflows/<name>.md`. | `discover`, `context`. |

No file needs all of them. No file is rejected for missing any.

---

## 4. Canonical template

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

- See `.agents/acc/workflows/feature.md` for the standard feature workflow.
```

ACC's `acc document <path>` produces this template (optionally
pre-filled from discovery with `<!-- inferred -->` markers).

---

## 5. Writing dependencies

### Use paths, not vague names

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

Paths are canonical references
([02 §7](./02-repository-structure.md#7-path-conventions-used-by-this-spec)).
ACC resolves them to functionality boundaries. Vague names require fuzzy
matching, which is less reliable and produces `ACC012` diagnostics when
no matching boundary is found.

### Relative to project root

Paths are relative to the project root, not to the `AGENTS.md`'s own
directory. If `src/audio/AGENTS.md` depends on `src/database/`, the
entry is `src/database` (not `../database`).

### Declared vs. discovered

Declared dependencies are the architectural **intent**. They do not need
to match discovered imports exactly — that's the point of
[03 — Epistemology §5](./03-epistemology.md#5-truth-resolution):
declared wins; mismatches surface as diagnostics.

If you declare `src/database` and the code does import `src/database`,
you've confirmed your architecture. If the code also imports `src/ui`
that you didn't declare, ACC will surface `ACC022` and `acc discover`
will suggest adding it.

---

## 6. Writing ownership

### Single owner per functionality

```markdown
## Ownership

Owner: audio-team
```

If two `AGENTS.md` files both claim the same path, `ACC030` fires.
Ownership is exclusive by design — shared ownership is modeled as a
meta-functionality that owns both (each with single-owner).

### Owner can be a path

```markdown
## Ownership

Owner: src/platform
```

This declares that the `src/platform` functionality owns this one. ACC
treats path owners as `ownership` edges in the graph.

### Inferred owners are never asserted

ACC may guess an owner from heuristics (recent committers, most-touched
file). It returns the guess with `provenance.kind = "inferred"` and a
suggestion (`ACC034`), never as authoritative. Declared ownership
always wins.

---

## 7. Writing constraints

Constraints are declared invariants. They are the most load-bearing
piece of `AGENTS.md` for `acc impact` and `acc check`.

```markdown
## Constraints

- Must not depend on src/ui.
- All public APIs must be Send + Sync.
- Database access only through src/database's connection pool.
```

### Constraint language

ACC does not parse constraint semantics — it treats constraints as
text, surfaced verbatim in `acc context` and `acc impact`. The
**agent** interprets them when it touches the functionality. ACC's job
is to surface the right constraints in the right context, not to
enforce them mechanically.

This is deliberate: constraints are often domain-specific prose
($"must preserve waveform continuity"$) that no static analyzer can
parse. Keeping them as plain text preserves `AGENTS.md`'s
agent-readability and ACC's language-agnosticism.

---

## 8. Cross-references and standards

### Referencing standards

```markdown
## Architecture

See `.agents/acc/standards/architecture.md` for the project's
architecture expectations. This module follows the layered pattern
described there.
```

ACC treats this as a plain reference. There is no special link syntax.

### Referencing other `AGENTS.md` files

```markdown
This functionality inherits from `src/AGENTS.md` and specializes the
audio contract described in `src/audio/AGENTS.md`.
```

Inheritance is positional (directory hierarchy), not link-based
([02 §1](./02-repository-structure.md#1-agentsmd--standard-ecosystem)).
Links in prose are for the human/agent reader, not for ACC's graph
derivation.

---

## 9. Keeping `AGENTS.md` ACC-friendly

Practices that maximize ACC's value without锁ing you into ACC:

- **Use paths as canonical references.** Makes declared dependencies and
  ownership resolvable.
- **Put one functionality per directory.** Allows `acc context` to
  scope accurately.
- **Declare dependencies explicitly.** Even if the code already imports
  them — declared dependencies are the architectural intent that wins
  over discovery.
- **Declare constraints as prose.** Domain-specific invariants don't
  need a formal language.
- **Keep sections short.** `acc context` summarizes; long sections get
  truncated under `--max-bytes`.
- **Use `acc document` for first drafts.** It produces the canonical
  template, optionally pre-filled from discovery, and with `--from-discovery`
  inferred entries are clearly marked `<!-- inferred -->`.

---

## 10. Anti-patterns

### YAML frontmatter

```markdown
---
owner: audio-team
deps: [src/database]
---
```

ACC does not parse frontmatter. The hard invariant
([01](./01-philosophy.md#the-hard-invariant-technical-restatement))
forbids enforcing proprietary schemas in `AGENTS.md`. Put ownership and
dependencies in Markdown sections instead.

### Competing instruction standards

`AGENTS.md` is the primary instruction interface. Don't add
`CLAUDE.md`/`CURSOR.md`/`CODEX.md` competing files — those split
authority. If you need agent-specific notes, put them in
`.agents/acc/agents/<name>.md` (profiles) or `.acc-memory.md` (durable
agent knowledge).

### Putting memory in `AGENTS.md`

If it's architectural, it's `AGENTS.md`. If it's agent-learned and
durable but not architectural, it's `.acc-memory.md`. Don't put
gotchas, tried-and-rejected notes, or open questions in `AGENTS.md`
unless they've risen to declared invariants.

### Declaring inferred facts

Never write a dependency or owner based on an ACC suggestion without
reviewing it. `acc discover` suggestions are `Inferred` until a human
promotes them. Copying an inferred suggestion into `AGENTS.md` is the
promotion act — do it deliberately.

---

## 11. Relationship to the AGENTS.md ecosystem

ACC follows the inheritance convention used by Codex, Claude Code,
Cursor, Copilot:

```text
project/AGENTS.md          → project-wide context
  └── src/AGENTS.md        → src-specific context (inherits + overrides)
        └── src/audio/AGENTS.md  → audio-specific context
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
