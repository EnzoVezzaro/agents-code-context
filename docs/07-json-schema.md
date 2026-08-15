# 07 — JSON Output Schema

## 1. Design principles

1. **Deterministic.** Same repo state + same flags → byte-identical JSON
   across runs. No timestamps, no random ordering, no locale-dependent
   formatting.
2. **Versioned.** Every JSON payload carries `schema_version`. Breaking
   shape changes require a major version bump. Additive changes
   (new optional fields) bump the minor version.
3. **Documented & stable.** Agents consume JSON, not terminal prose.
   JSON shape is a public API.
4. **Provenance everywhere.** No architectural fact appears without a
   `provenance` object (see [03 — Epistemology](./03-epistemology.md#3-provenance-contract)).
5. **No opaque IDs.** Paths and names are canonical references.

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
|---|---|---|
| `schema_version` | yes | Schema major version of this payload. Bumping the major version signals breaking changes. |
| `command` | yes | Name of the producing command (`context`, `check`, etc.). |
| `acc_version` | yes | Semver of the `acc` binary. |
| `root` | yes | Absolute resolved project root. |
| `result` | yes | Command-specific payload (see §4). `null` if the command emits no result. |
| `diagnostics` | yes | Array of diagnostics (see [06](./06-diagnostic-codes.md#14-json-shape)). Empty if none. |
| `truncated` | yes | `true` when `--max-bytes` clipped output. |
| `truncated_bytes_omitted` | yes | Bytes omitted due to truncation (0 when not truncated). |

---

## 3. Shared types

### `Provenance`

```json
{
  "kind": "declared",                  // "declared" | "discovered" | "inferred" | "memory"
  "source": "src/audio/AGENTS.md",
  "detail": "Dependencies section"     // optional human note
}
```

`kind` is one of the four string literals. `source` is a path or a
discovery description (e.g. `"Discovered from Rust imports"`).
`detail` is optional.

### `FunctionalityNode`

```json
{
  "id": "src/audio",
  "path": "src/audio",
  "name": "audio",
  "has_local_contract": true,
  "roles": ["module"],
  "owners": ["audio-team"],
  "provenance": { "kind": "declared", "source": "src/audio/AGENTS.md" }
}
```

`roles`, `owners` are arrays of strings (possibly empty). They are
declared-only fields; inferred roles/owners are never placed here.

### `Edge`

```json
{
  "from": "src/audio",
  "to": "src/database",
  "kind": "dependency",                // "dependency" | "ownership"
  "hop": 0,                            // present when computed via transitive expansion
  "provenance": {
    "kind": "declared",
    "source": "src/audio/AGENTS.md",
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
  "path": "src/audio/mod.rs",
  "message": "discovered dependency 'src/audio → src/ui' not declared in any AGENTS.md",
  "detail": { ... }                    // optional, structured
}
```

`canonical_severity` is only emitted when a `warn_only` override is in
effect; otherwise the single `severity` field is canonical.

---

## 4. Per-command `result` payloads

### `acc init --json`

```json
{
  "root": "/abs/path/to/project",
  "created": [
    ".agents/acc/config.yaml",
    ".agents/acc/agents/",
    ".agents/acc/workflows/",
    ".agents/acc/standards/"
  ],
  "existing": ["AGENTS.md"],
  "gitignore_updated": true,
  "agents_md_templateprinted": false
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
  "path": "src/audio",
  "functionality": { ... FunctionalityNode ... },
  "roles": ["module"],
  "owners": ["audio-team"],
  "dependencies": [ ... Edge ... ],
  "dependents": [ ... Edge ... ],
  "constraints": [
    { "text": "Must not depend on src/ui.", "provenance": {...} }
  ],
  "inherits_from": ["", "src/"],
  "memory": {
    "exists": true,
    "path": "src/audio/.acc-memory.md",
    "contents": null                    // null unless --with-memory
  },
  "local_contract_source": "src/audio/AGENTS.md"
}
```

### `acc context <path> --json`

```json
{
  "path": "src/audio",
  "depth": 1,
  "sections": {
    "hierarchy": [
      { "path": "", "has_local_contract": true, "source": "AGENTS.md", "summary": "..." },
      { "path": "src/", "has_local_contract": true, "source": "src/AGENTS.md", "summary": "..." },
      { "path": "src/audio/", "has_local_contract": true, "source": "src/audio/AGENTS.md", "summary": "..." }
    ],
    "contract": {
      "source": "src/audio/AGENTS.md",
      "parsed_sections": {
        "Purpose": "Audio playback and recording for the app.",
        "Ownership": "audio-team",
        "Dependencies": "src/database, src/logging",
        "Constraints": "Must not depend on src/ui."
      },
      "raw_ref": "src/audio/AGENTS.md"
    },
    "dependencies": [ ... Edge ... ],
    "constraints": [
      { "text": "Must not depend on src/ui.", "provenance": {...} }
    ],
    "implementations": {
      "files": 12,
      "languages": [
        { "name": "rust", "files": 9, "modules": 41, "functions": 156 },
        { "name": "toml", "files": 3 }
      ],
      "provenance": { "kind": "discovered", "source": "filesystem + rust analyzer" }
    },
    "memory": {
      "exists": true,
      "path": "src/audio/.acc-memory.md",
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
  "scope": "src/audio",
  "nodes": [ ... FunctionalityNode ... ],
  "edges": [ ... Edge ... ]
}
```

When `--format mermaid` or `--format dot`, the `result` is a single
string:

```json
{ "format": "mermaid", "content": "graph LR\n  ..." }
```

### `acc dependencies <path> --json` / `acc dependents <path> --json`

```json
{
  "path": "src/audio",
  "direction": "dependencies",          // or "dependents"
  "edges": [ ... Edge ... ]             // filtered per --declared/--discovered/--direct/--transitive
}
```

### `acc impact <path> --json`

```json
{
  "path": "src/audio",
  "max_depth": 3,
  "dependents": [
    { "path": "src/app/", "hop": 1, "provenance": {...} },
    { "path": "tests/audio_test/", "hop": 2, "is_test": true, "provenance": {...} }
  ],
  "affected_tests": ["tests/audio_test/"],
  "constraints": [
    { "text": "...", "source": "src/app/AGENTS.md", "provenance": {...} }
  ]
}
```

### `acc search <query> --json`

```json
{
  "query": "audio",
  "kind": "all",
  "results": [
    {
      "kind": "contract",                // "contract" | "edge" | "code"
      "path": "src/audio/AGENTS.md",
      "line": 3,
      "snippet": "Audio playback and recording for the app.",
      "provenance": { "kind": "declared", "source": "src/audio/AGENTS.md" }
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
      "path": "src/audio",
      "description": "Discovered dependency 'src/audio → src/ui' is not declared.",
      "provenance": { "kind": "inferred", "source": "discovered import in src/audio/mod.rs" },
      "proposed_change": {
        "file": "src/audio/AGENTS.md",
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
  "path": "src/audio",
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
  "path": "src/audio",
  "exists": true,
  "file": "src/audio/.acc-memory.md",
  "contents": "## 2026-08-15T14:03:21Z\n\nDiscovered the decoding path is non-reentrant ..."
}
```

### `acc memory add <path> <text> --json` / `acc memory clear <path> --json`

```json
{
  "path": "src/audio",
  "file": "src/audio/.acc-memory.md",
  "action": "added",                     // "added" | "cleared"
  "bytes": 142
}
```

---

## 5. Determinism rules (JSON)

1. Object keys are emitted in **sorted order**. (Implementations SHOULD
   use a BTreeMap or sort keys before serialization.)
2. Arrays are sorted as specified per command, never insertion order.
3. No trailing whitespace; no `null` unless explicitly specified.
4. UTF-8 only; no BOM; `\n` line terminator.
5. Indentation: 2 spaces. (Stable for human review; agents do not
   require it but it helps debugging.)
6. No comments (JSON, not JSONC).
7. Booleans as `true`/`false`; never 0/1.
8. Paths are always relative POSIX strings unless the field explicitly
   documents absolute paths (e.g. envelope `root`).
9. Times, if any, are RFC 3339 UTC (used only in memory entries).

---

## 6. Versioning policy

| Change | Action |
|---|---|
| Add optional field | Minor bump of `schema_version` (e.g. `1` → `1.1`). `acc_version` semver follows. |
| New enum value (in a `kind` field whose set is documented as open) | Minor bump. |
| New enum value in a closed set | Major bump. |
| Remove a field | Major bump. |
| Change a field's type or semantics | Major bump. |
| Reorder / rename keys | Major bump. |

`schema_version` begins at `1`. Consumers SHOULD assert
`schema_version` major matches their expectation and ignore unknown
optional fields forward-compatibly.

---

## 7. Error envelope

For usage errors (exit code `2`) and panics (exit code `3`), JSON output
is a minimal envelope:

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
    "message": "path does not exist: src/audio",
    "exit_code": 2
  },
  "truncated": false,
  "truncated_bytes_omitted": 0
}
```

`error` is mutually exclusive with a non-null `result`. Its presence
means the command did not produce its normal payload.
