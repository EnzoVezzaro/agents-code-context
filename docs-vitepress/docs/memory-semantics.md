# 08 — Memory Semantics

> `.acc-memory.md` is the **durable, functionality-local, agent-written, gitignored Markdown** memory layer. It is the scratchpad for durable knowledge that an agent learns about a functionality but that is not yet (or should not be) part of the committed `AGENTS.md` contract.

---

## 1. Role in the Framework

| Artifact | Durability | Git | Authority | Audience |
|----------|------------|-----|-----------|----------|
| `AGENTS.md` | Permanent | Yes (committed) | Declared architecture | Any agent, any human |
| `.acc-memory.md` | Durable | No (gitignored) | Agent knowledge | The next agent/human to touch this functionality |
| Source code | Permanent | Yes | Discovered | Everyone |

`.acc-memory.md` sits between the committed contract (`AGENTS.md`) and the ephemeral agent conversation. It is the place for:

- Lessons learned during a modification that the next agent should not have to rediscover
- Quirks, gotchas, non-obvious invariants that don't rise to the level of committed declarations
- Rationale for a non-declared but observed pattern
- A history of what has been tried and rejected

It is **not** a commit log, not a chat transcript, and not a replacement for `AGENTS.md`. Anything load-bearing and architectural belongs in `AGENTS.md` (committed), not in memory. Memory is for the soft, agent-oriented "things I wish I'd known before I started."

---

## 2. Path & Lifecycle

### Path

```
<functionality-dir>/.acc-memory.md
```

A functionality directory is a directory containing an `AGENTS.md` (or the project root, which may or may not have one). Memory is scoped to the functionality boundary, not to arbitrary directories.

If a directory has no `AGENTS.md` and no ancestor with one, `.acc-memory.md` there is an orphan and ACC emits `ACC050` (see [06 — Diagnostic Codes](./diagnostic-codes.md#9-memory-acc050-acc059)).

### Lifecycle

1. **Create on first use.** An agent (or human) creates `<dir>/.acc-memory.md` when it learns something durable about the functionality — usually during or after a modification. The file may be created empty as a convention marker, then filled in.
2. **Read before modifying.** Before modifying a functionality, an agent SHOULD read its `.acc-memory.md` (if present) to recover lessons learned. `acc context <path> --include memory` includes it.
3. **Update after modifying.** After a successful modification, the agent SHOULD append new durable knowledge.
4. **Delete when the functionality is removed.** If the functionality directory is deleted, its `.acc-memory.md` goes with it.

### Git

`.acc-memory.md` **MUST** be in `.gitignore`. `acc init` ensures this. If a `.acc-memory.md` is found tracked by git, `acc check` emits `ACC053` (warn) but does not modify the repo.

Rationale: memory is local and agent-specific. Committing it would create merge conflicts across agents and users, and would blur the line between declared authority (`AGENTS.md`, committed) and agent knowledge (memory, local).

If a team wants **shared** durable knowledge, it belongs in `AGENTS.md` (committed), not in `.acc-memory.md`.

---

## 3. Format

### Primary: Unstructured Prose

`.acc-memory.md` is plain Markdown. No schema. No frontmatter. An entry is a `## <RFC 3339 UTC timestamp>` heading followed by free-form prose.

```markdown
## 2026-08-15T14:03:21Z

The auth token validator in `validator.rs` is non-reentrant. Calling
`validate()` from within a `validate()` callback deadlocks the token cache.

Workaround: queue callbacks and flush after the outer `validate()` returns.
```

### Optional: Well-Known Headings

ACC recognizes a small set of well-known headings as structured keys. These are **convention**, not protocol — any agent can ignore them and just read the prose. They allow `acc memory` and `acc context --include memory` to surface key facts quickly.

| Heading | Purpose |
|---------|---------|
| `## Gotchas` | Non-obvious failure modes and traps. |
| `## Invariants` | Observed invariants not declared in `AGENTS.md`. |
| `## Decisions` | Rationale for non-declared design choices. |
| `## Tried & Rejected` | Approaches attempted and why they failed. |
| `## Open Questions` | Unresolved architectural questions. |

Entries under well-known headings MAY omit timestamps (they represent ongoing knowledge rather than a log event). Free-form timestamped entries coexist with well-known headings in the same file.

```markdown
## Gotchas

- `validate()` is non-reentrant.
- The token cache is not safe to flush from within a callback.

## 2026-08-15T14:03:21Z

Investigated refresh token rotation. The non-reentrant validate path is the
blocker. See `## Gotchas` above. Decided to defer until v2.

## Decisions

- Refresh token rotation deferred to v2. Reason: validate reentrancy.
```

---

## 4. Provenance

Memory has its own provenance kind: `"memory"` (not declared, discovered, or inferred). It is agent-authored knowledge, not architectural authority and not code observation.

```json
{
  "provenance": {
    "kind": "memory",
    "source": "src/auth/.acc-memory.md"
  }
}
```

`acc context --include memory` surfaces memory entries with this provenance. `acc check` never treats memory contents as architectural facts — memory is reported for existence and validity only, never interpreted as declared architecture. ACC MUST NOT use memory to derive graph edges, owners, or constraints.

---

## 5. Read/Write Rules

### Reads

- `acc context <path> --include memory` includes the file contents in the `memory` section.
- `acc inspect <path> --with-memory` includes the file contents.
- `acc inspect <path>` (default) reports only existence.
- `acc memory show <path>` prints the file.
- Any agent can `cat <dir>/.acc-memory.md` as plain Markdown — no CLI needed.

### Writes

- `acc memory add <path> <text>` appends a timestamped entry.
- `acc memory clear <path>` truncates the file (the file is left empty, not deleted, to preserve the convention marker). Requires `--force` or interactive confirmation.
- ACC never silently writes `.acc-memory.md` outside `acc memory` subcommands. In particular, `acc check`, `acc context`, `acc graph`, `acc discover`, `acc document`, `acc search` are pure reads and never modify memory.
- `acc discover --apply` updates `AGENTS.md`, NOT `.acc-memory.md`. The two stores are separate.

### Edge Cases

| Case | Behavior |
|------|----------|
| Memory file absent | Memory section reports `exists: false`. No diagnostic. |
| Memory file present but empty | `ACC051` info (verbose only). `exists: true`, `contents: ""`. |
| Memory file not UTF-8 | `ACC052` warn. `acc memory show` prints an error; `acc context` omits contents. |
| Memory in dir with no `AGENTS.md` and no ancestor | `ACC050` warn (orphan memory). |
| Memory tracked by git | `ACC053` warn. No automatic fix. |
| Memory very large (> `memory_warn_bytes`, default 65536) | `ACC054` info. `acc context --include memory` truncates to `--max-bytes`. |

---

## 6. Memory vs. `AGENTS.md` — When to Use Which

| Knowledge | Where it goes |
|-----------|---------------|
| "This module owns the database connection." | `AGENTS.md` Ownership (declared). |
| "The database connection is non-reentrant after a reconnect." | `.acc-memory.md` Gotchas. |
| "We forbid dependencies on `src/ui` from this module." | `AGENTS.md` Constraints (declared). |
| "We tried splitting the validator into a separate crate and reverted — overhead wasn't worth it." | `.acc-memory.md` Tried & Rejected. |
| "This module exports `validate()` and `refresh()`." | Source (discovered) + optionally `AGENTS.md` Outputs. |
| "The TODO at line 42 of `validator.rs` is a known ergonomic issue, not a bug." | `.acc-memory.md` Open Questions. |

Rule of thumb: **if it's architectural, declare it in `AGENTS.md`. If it's orientational, note it in `.acc-memory.md`.**

---

## 7. Agent Portability

Because `.acc-memory.md` is plain Markdown with a stable path convention:

- Any agent reads it directly. No CLI required.
- Switching from Cursor to Claude does not lose memory — the file is in the repo (even if gitignored, it's on the local working tree).
- The absence of the CLI does not make memory inaccessible.
- `acc memory` is an accelerator; the fallback is `cat`.

This realizes the **portability guarantee** from [01 — Philosophy §10](./philosophy.md#10-portability-guarantee): context persistence is a property of the repository, not the agent.

---

## 8. Format Stability

- The well-known headings (`Gotchas`, `Invariants`, `Decisions`, `Tried & Rejected`, `Open Questions`) are stable; new headings may be added in a minor bump but existing ones are never removed or renamed.
- Timestamps are RFC 3339 UTC. `acc memory add` always emits UTC.
- The file is UTF-8 Markdown. ACC will not introduce a binary or non-Markdown memory format in V1.