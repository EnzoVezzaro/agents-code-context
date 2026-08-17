# 08 — JSON Output Schema

> **TLDR:** the machine contract. If you're wiring
> `acc` into an agent, a script, or CI, this is the page that tells you
> exactly what JSON you'll get back. It's stable, versioned, and
> deterministic — you can build against it without fear.

Determinism is the whole point: the same repository and the same flags
must always produce the same JSON, so a machine can build on it without
surprises. This page defines the envelope and every payload.

## 1. Design Principles

1. **Deterministic.** Same repo state + same flags → byte-identical JSON across runs. No timestamps, no random ordering, no locale-dependent formatting.
2. **Versioned.** Every JSON payload carries `schema_version`. Breaking shape changes require a major version bump. Additive changes (new optional fields) bump the minor version.
3. **Documented & Stable.** Agents consume JSON, not terminal prose. JSON shape is a public API.
4. **Provenance Everywhere.** No architectural fact appears without a `provenance` object (see [04 — Epistemology](./04-epistemology.md#3-provenance-contract)).
5. **No Opaque IDs.** Paths and names are canonical references.

---

## 2. Envelope

Every `--json` response wraps results in this envelope:

```json
{
  "schema_version": 1,
  "command": "context",
  "acc_version": "0.1.0",
  "root": "/abs/path/to/project",
  "result": { ... },                 // command-specific payload
  "diagnostics": [ ... ],             // diagnostics surfaced during this command
  "truncated": false,                // true if --max-bytes hit
  "truncated_bytes_omitted": 0
}
```

| Field | Always present | Description |
|-------|----------------|-------------|
| `schema_version` | yes | Schema major version of this payload. Bumping the major version signals breaking changes. |
| `command` | yes | Name of the producing command (`context`, `check`, etc.). |
| `acc_version` | yes | Semver of the `acc` binary. |
| `root` | yes | Absolute resolved project root. |
| `result` | yes | Command-specific payload (see §4). `null` if the command emits no result. |
| `diagnostics` | yes | Array of diagnostics (see [06](./07-diagnostic-codes.md#16-json-shape)). Empty if none. |
| `truncated` | yes | `true` when `--max-bytes` clipped output. |
| `truncated_bytes_omitted` | yes | Bytes omitted due to truncation (0 when not truncated). |

---

## 3. Shared Types

### `Provenance`

```json
{
  "kind": "declared",                  // "declared" | "discovered" | "inferred" | "memory"
  "source": "src/auth/AGENTS.md",
  "detail": "Dependencies section"     // optional human note
}
```

`kind` is one of the four string literals. `source` is a path or a
discovery description (e.g., `"Discovered from Rust imports"`). `detail`
is optional.

### `FunctionalityNode`

```json
{
  "id": "src/auth",
  "path": "src/auth",
  "name": "auth",
  "has_local_contract": true,
  "roles": ["module"],
  "owners": ["auth-team"],
  "provenance": { "kind": "declared", "source": "src/auth/AGENTS.md" }
}
```

`roles`, `owners` are arrays of strings (possibly empty). They are
declared-only fields; inferred roles/owners are never placed here.

`acc graph` nodes additionally carry `type: "boundary"` (additive). The
full typed index (boundary, agents, file, test, skill, standard) is
queried via `acc slice` — see below.

### `Edge`

```json
{
  "from": "src/auth",
  "to": "src/database",
  "kind": "dependency",                // "dependency" | "ownership"
  "hop": 0,                            // present when computed via transitive expansion
  "provenance": {
    "kind": "declared",
    "source": "src/auth/AGENTS.md",
    "detail": "Dependencies section"
  }
}
```

### `Diagnostic`

```json
{
  "code": "ACC022",
  "severity": "warn",
  "canonical_severity": "warn",        // present only when overridden via config warn_only
  "path": "src/auth/mod.rs",
  "message": "discovered dependency 'src/auth → src/ui' not declared in any AGENTS.md",
  "detail": { ... }                    // optional, structured
}
```

`canonical_severity` is only emitted when a `warn_only` override is in
effect; otherwise the single `severity` field is canonical.

---

## 4. Per-Command `result` Payloads

### `acc init --json`

```json
{
  "root": "/abs/path/to/project",
  "created": [
    ".acc/config/config.yaml",
    ".acc/config/agents/",
    ".acc/config/workflows/",
    ".acc/config/standards/"
  ],
  "existing": ["AGENTS.md"],
  "gitignore_updated": true,
  "agents_md_template_printed": false
}
```

### `acc check --json`

```json
{
  "diagnostics": [
    { "code": "ACC022", "severity": "warn", "path": "...", "message": "..." },
    ...
  ],
  "summary": {
    "errors": 1,
    "warnings": 3,
    "infos": 2,
    "total": 6
  },
  "exit_code": 1
}
```

(The envelope's `diagnostics` is empty for `check`; the command's
`result.diagnostics` is the payload. This avoids duplication.) When
`--json` is used with `check`, the envelope `diagnostics` is an empty
array, and `result.diagnostics` carries the full list. Agents reading
`check` should consume `result.diagnostics`.

### `acc inspect <path> --json`

```json
{
  "path": "src/auth",
  "functionality": { ... FunctionalityNode ... },
  "roles": ["module"],
  "owners": ["auth-team"],
  "dependencies": [ ... Edge ... ],
  "dependents": [ ... Edge ... ],
  "constraints": [
    { "text": "Must not depend on src/ui.", "provenance": {...} }
  ],
  "inherits_from": ["", "src/"],
  "memory": {
    "exists": true,
    "path": "src/auth/.acc-memory.md",
    "contents": null                    // null unless --with-memory
  },
  "local_contract_source": "src/auth/AGENTS.md"
}
```

### `acc context <path> --json`

```json
{
  "path": "src/auth",
  "depth": 1,
  "sections": {
    "hierarchy": [
      { "path": "", "has_local_contract": true, "source": "AGENTS.md", "summary": "..." },
      { "path": "src/", "has_local_contract": true, "source": "src/AGENTS.md", "summary": "..." },
      { "path": "src/auth/", "has_local_contract": true, "source": "src/auth/AGENTS.md", "summary": "..." }
    ],
    "contract": {
      "source": "src/auth/AGENTS.md",
      "parsed_sections": {
        "Purpose": "Authentication and authorization for the API.",
        "Ownership": "auth-team",
        "Dependencies": "src/database, src/logging",
        "Constraints": "Must not depend on src/ui."
      },
      "raw_ref": "src/auth/AGENTS.md"
    },
    "dependencies": [ ... Edge ... ],
    "constraints": [
      { "text": "Must not depend on src/ui.", "provenance": {...} }
    ],
    "implementations": {
      "files": 8,
      "languages": [
        { "name": "rust", "files": 6, "modules": 23, "functions": 87 },
        { "name": "toml", "files": 2 }
      ],
      "provenance": { "kind": "discovered", "source": "filesystem + rust analyzer" }
    },
    "memory": {
      "exists": true,
      "path": "src/auth/.acc-memory.md",
      "contents": null
    }
  },
  "bytes": 1842,
  "max_bytes": 65536
}
```

### `acc graph [path] --json`

```json
{
  "scope": "src/auth",
  "nodes": [ ... FunctionalityNode ... ],
  "edges": [ ... Edge ... ]
}
```

When `--format mermaid` or `--format dot`, the `result` is a single string:

```json
{ "format": "mermaid", "content": "graph LR\n  ..." }
```

### `acc slice <path> --json`

The compact AI-optimized graph slice (see [05 — CLI Commands](./05-cli-commands.md#acc-slice-path)):

```json
{
  "scope": "src/auth",
  "governed_by": ["AGENTS.md", "src/AGENTS.md", "src/auth/AGENTS.md"],
  "owns": {
    "files": ["src/auth/token.rs"],
    "tests": ["src/auth/token_test.rs"]
  },
  "depends_on": [
    { "to": "src/database", "provenance_kind": "declared" }
  ],
  "dependents": [
    { "from": "src/app", "provenance_kind": "declared" }
  ],
  "tested_by": ["src/auth/token_test.rs"],
  "requires": {
    "skills": ["oauth"],
    "standards": ["idempotency"]
  },
  "impact": { "files": 2, "boundaries": 2, "tests": 1, "contracts": 2 }
}
```

`scope` uses `.` for the root. `governed_by` lists the contract chain
root → scope (nearest file wins). `impact` is the expansion budget over
scope + transitive dependents.

### `acc engine [path] --json`

```json
{
  "scan": {
    "stats": { "boundaries": 4, "files": 3, "tests": 2, "skills": 1, "standards": 1,
               "edges_declared": 2, "edges_discovered": 1, "links": 6, "cycles": 0 },
    "diagnostics": [ ... ],
    "diagnostics_summary": { "errors": 0, "warnings": 1, "infos": 2, "total": 3 },
    "slices": [ ... graphSlice ... ],
    "dependency_gaps": [ { "from": "src/auth", "to": "src/logging", "source": "..." } ],
    "scope": null
  },
  "sync": {
    "applied": false,
    "contracts_missing": [],
    "contracts_created": [],
    "memory_records_created": [],
    "suggestions": 2,
    "suggestions_applied": 0,
    "dependency_gaps": [ ... ]
  },
  "trigger": {
    "mode": "commits", "threshold": 3, "current": 1,
    "triggered": false, "reason": "waiting for 1/3 commits",
    "changedFiles": [ "src/auth/token.rs" ]
  },
  "ai": {
    "enabled": true,
    "skipped": true,
    "reason": "waiting for 1/3 commits",
    "results": [],
    "applied": false,
    "errors": [],
    "changed_files": [],
    "supervisor": { "enabled": false }
  },
  "warn": {
    "file": "ACC_WARN.md",
    "diagnostics": 1,
    "errors": 0,
    "warnings": 1,
    "docs_behind_code": 1,
    "docs_ahead_of_code": 0,
    "ai_findings": 0,
    "supervisor_approved": null
  }
}
```

`warn` is the summary of the regenerated `ACC_WARN.md` drift report
(written to the project root on every run): `diagnostics` counts
error/warn diagnostics, `docs_behind_code` / `docs_ahead_of_code` are
the two drift directions, and `ai_findings` / `supervisor_approved`
reflect the last triggered AI run when one happened.

When the AI phase runs (`triggered` or `--force`), `ai.results` carries
per-boundary `{ dir, knowledge[], drift[], skill_gaps[], standard_gaps[],
supervisor }` and `ai.provider` describes the model used. `trigger.changedFiles`
and `ai.changed_files` list the files whose content changed since the last
triggered run — the code the AI evaluates (embedded in the prompt).

With `--supervisor`, each result carries:
```json
{
  "dir": "src/payments",
  "knowledge": [],
  "drift": [],
  "supervisor": {
    "enabled": true,
    "approved": true,
    "score": 92,
    "issues": [],
    "iterations": [ { "iteration": 1, "score": 78, "issues": [ "..." ] } ]
  }
}
```
and `ai.supervisor` reports `{ enabled, threshold, max_iterations }`.
Knowledge is written to `.acc-memory.md` only when `approved` is true.
AI results are advisory (provenance memory/inferred); the `scan` and
`sync` sections are deterministic.

AI resilience is reported on the same object: `ai.knowledge_written`
counts entries actually written to `.acc-memory.md` (0 when nothing was
approved), `ai.provider_notes` lists providers skipped at resolve time
(e.g. missing API key) as `{ id, error }`, and `ai.retry_log` records
every failed attempt as `{ provider, model, attempt, error }` — empty
when no retries were needed. When every provider is exhausted,
`ai.errors` carries one entry per boundary and `ai.retry_log` holds all
failed attempts; nothing is written and nothing is thrown.

### `acc review [path] --json`

On-demand AI compliance review (read-only — never writes state):

```json
{
  "command": "review",
  "scope": null,
  "diagnostics": { "errors": 0, "warnings": 1, "infos": 2, "total": 3 },
  "dependency_gaps": [ { "from": "src/auth", "to": "src/logging", "source": "..." } ],
  "stale_declarations": [],
  "ai": {
    "enabled": true,
    "skipped": false,
    "provider": { "id": "main", "provider": "openai", "model": "gpt-4o" },
    "threshold": 85,
    "max_iterations": 3,
    "errors": [],
    "boundaries": [
      {
        "dir": "src/auth",
        "score": 92,
        "approved": true,
        "issues": [],
        "drift": [],
        "knowledge": [],
        "skill_gaps": [],
        "standard_gaps": []
      }
    ]
  },
  "score": 92,
  "approved": true
}
```

`score` / `approved` are the overall verdict (the weakest boundary's
score — min across reviewed boundaries). When AI is disabled or the
provider can't be resolved, `ai` carries `enabled: false` (or
`errors[]`) and `score`/`approved` are `null` — the deterministic scan
fields are always present. See
[05 — CLI Commands § acc review](./05-cli-commands.md#acc-review-path-—-on-demand-ai-compliance-review).

### `acc ai --json`

The AI provider manifest (offline — no provider package is loaded or
contacted):

```json
{
  "enabled": true,
  "default": "main",
  "providers": [
    {
      "id": "main",
      "provider": "openai",
      "package": "@ai-sdk/openai",
      "model": "gpt-4o",
      "api_key_env": "OPENAI_API_KEY",
      "api_key_present": true,
      "installed": true,
      "errors": []
    }
  ]
}
```

`api_key_present` reflects the environment at run time; keys themselves
are never emitted or stored.

The write subcommands return:

- `acc ai add` → `{ provider: { id, provider, model, api_key_env,
  base_url? }, env_var, env_file, control_file }`.
- `acc ai remove <id>` → `{ removed, env_keys_removed, control_file }`.
- `acc ai default <id>` → `{ default, control_file }`.
- `acc ai models <id>` → `{ provider, models: string[] }` (network call,
  explicitly requested).

### `acc dependencies <path> --json` / `acc dependents <path> --json`

```json
{
  "path": "src/auth",
  "direction": "dependencies",          // or "dependents"
  "edges": [ ... Edge ... ]             // filtered per --declared/--discovered/--direct/--transitive
}
```

### `acc impact <path> --json`

```json
{
  "path": "src/auth",
  "max_depth": 3,
  "dependents": [
    { "path": "src/app/", "hop": 1, "provenance": {...} },
    { "path": "tests/auth/", "hop": 2, "is_test": true, "provenance": {...} }
  ],
  "affected_tests": ["tests/auth/"],
  "constraints": [
    { "text": "...", "source": "src/app/AGENTS.md", "provenance": {...} }
  ]
}
```

### `acc search <query> --json`

```json
{
  "query": "auth",
  "kind": "all",
  "results": [
    {
      "kind": "contract",                // "contract" | "edge" | "code"
      "path": "src/auth/AGENTS.md",
      "line": 3,
      "snippet": "Authentication and authorization for the API.",
      "provenance": { "kind": "declared", "source": "src/auth/AGENTS.md" }
    },
    ...
  ],
  "truncated": false
}
```

### `acc discover --json`

```json
{
  "suggestions": [
    {
      "kind": "missing-dependency",
      "code": "ACC022",
      "path": "src/auth",
      "description": "Discovered dependency 'src/auth → src/ui' is not declared.",
      "provenance": { "kind": "inferred", "source": "discovered import in src/auth/mod.rs" },
      "proposed_change": {
        "file": "src/auth/AGENTS.md",
        "section": "Dependencies",
        "add": "src/ui"
      },
      "applied": false
    },
    ...
  ],
  "applied_count": 0
}
```

### `acc document <path> --json`

```json
{
  "path": "src/auth",
  "exists": false,
  "template": "# AGENTS.md\n\n## Purpose\n\n...\n",
  "inferred_fields": {
    "dependencies": ["src/database", "src/logging"],
    "owners": []
  },
  "applied": false
}
```

### `acc memory show <path> --json`

```json
{
  "path": "src/auth",
  "exists": true,
  "file": "src/auth/.acc-memory.md",
  "contents": "## 2026-08-15T14:03:21Z\n\nDiscovered the token validation path is non-reentrant ..."
}
```

### `acc memory add <path> <text> --json` / `acc memory clear <path> --json`

```json
{
  "path": "src/auth",
  "file": "src/auth/.acc-memory.md",
  "action": "added",                     // "added" | "cleared"
  "bytes": 142
}
```

---

## 5. Determinism Rules (JSON)

1. Object keys are emitted in **sorted order**. (Implementations SHOULD use a BTreeMap or sort keys before serialization.)
2. Arrays are sorted as specified per command, never insertion order.
3. No trailing whitespace; no `null` unless explicitly specified.
4. UTF-8 only; no BOM; `\n` line terminator.
5. Indentation: 2 spaces. (Stable for human review; agents do not require it but it helps debugging.)
6. No comments (JSON, not JSONC).
7. Booleans as `true`/`false`; never 0/1.
8. Paths are always relative POSIX strings unless the field explicitly documents absolute paths (e.g., envelope `root`).
9. Times, if any, are RFC 3339 UTC (used only in memory entries).

The upshot: `acc context --json` twice in a row gives you byte-identical
output, or something is wrong.

---

## 6. Versioning Policy

| Change | Action |
|--------|--------|
| Add optional field | Minor bump of `schema_version` (e.g., `1` → `1.1`). `acc_version` semver follows. |
| New enum value (in a `kind` field whose set is documented as open) | Minor bump. |
| New enum value in a closed set | Major bump. |
| Remove a field | Major bump. |
| Change a field's type or semantics | Major bump. |
| Reorder / rename keys | Major bump. |

`schema_version` begins at `1`. Consumers SHOULD assert `schema_version`
major matches their expectation and ignore unknown optional fields
forward-compatibly.

---

## 7. Error Envelope

For usage errors (exit code `2`) and panics (exit code `3`), JSON output is a minimal envelope:

```json
{
  "schema_version": 1,
  "command": "context",
  "acc_version": "0.1.0",
  "root": null,
  "result": null,
  "diagnostics": [],
  "error": {
    "kind": "usage",                    // "usage" | "io" | "panic"
    "message": "path does not exist: src/auth",
    "exit_code": 2
  },
  "truncated": false,
  "truncated_bytes_omitted": 0
}
```

`error` is mutually exclusive with a non-null `result`. Its presence
means the command did not produce its normal payload.
