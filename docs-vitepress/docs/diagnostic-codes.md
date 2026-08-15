# 06 — Diagnostic Codes

## 1. Stability Contract

Diagnostic codes are the load-bearing contract for `acc check`, `acc discover`, and CI integration. They MUST be stable.

- Codes are strings of the form `ACCddd` where `ddd` is a zero-padded three-digit integer (`ACC001` … `ACC999`).
- Codes are partitioned by category (see §2). Adding a new code to a category is a **minor** version bump.
- **Renumbering, repurposing, or removing an existing code is forbidden.** A code that becomes obsolete retains its meaning forever; superseded codes emit a deprecation note alongside the diagnostic.
- Severities are stable per code: a code's severity NEVER changes after release. To change severity, mint a new code.
- Diagnostic code text (`message`) is informational and MAY be refined between versions; the code string and severity are the stable contract. Agents consume `(code, severity, path)` tuples, not prose.

---

## 2. Categories

| Prefix range | Category |
|--------------|----------|
| `ACC001`–`ACC009` | Core / contract structure |
| `ACC010`–`ACC019` | Broken references |
| `ACC020`–`ACC029` | Declared-vs-discovered dependency mismatches |
| `ACC030`–`ACC039` | Ownership |
| `ACC040`–`ACC049` | Language analyzers / interpretation |
| `ACC050`–`ACC059` | Memory |
| `ACC060`–`ACC069` | Configuration / `.acc/config/` |
| `ACC070`–`ACC079` | Stale docs / contracts |
| `ACC080`–`ACC089` | Security / safety |
| `ACC090`–`ACC099` | Reserved |
| `ACC100`–`ACC109` | Multi-agent orchestration |
| `ACC110`–`ACC119` | Tooling subsystem |

---

## 3. Severities

| Severity | Meaning | `acc check` exit contribution |
|----------|---------|------------------------------|
| `error` | Violation of a hard ACC rule; the repository is malformed or contract is broken. | Exit `1`. |
| `warn` | Likely problem; should be reviewed but not fatal. | Exit `0` unless `--severity error` filters it out — still reported. |
| `info` | Informational observation (e.g., no analyzer for a file type). | Exit `0`. |

CLI `--severity` flag filters to minimum severity: `--severity warn` emits `warn` and `error` but not `info`.

---

## 4. Core / Contract Structure (`ACC001`–`ACC009`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC001` | error | `malformed AGENTS.md at <path>: <reason>` | `AGENTS.md` exists but is unreadable or not valid UTF-8. |
| `ACC002` | warn | `AGENTS.md at <path> has no recognizable sections` | File exists and is valid Markdown but ACC's heuristic parse finds no conventional section headings. Informational — the file is still a valid contract to agents. |
| `ACC003` | error | `duplicate AGENTS.md at <path> (case-insensitive collision with <other>)` | On case-insensitive filesystems, two files differing only in case (e.g., `Agents.md` and `AGENTS.md`). |
| `ACC004` | warn | `reference '<anchor>' in <AGENTS.md> points to unknown section` | A Markdown link inside an `AGENTS.md` points to a heading that does not exist in the same file. |
| `ACC005` | info | `AGENTS.md at <path> has no <section> section` | One of the conventional sections (`Purpose`, `Responsibilities`, etc.) is absent. Not an error; only emitted when `acc check --verbose` or `acc document --from-discovery` is run. |
| `ACC006` | error | `nested functionality boundary without parent AGENTS.md` | A subdirectory `dir/AGENTS.md` exists but no ancestor `AGENTS.md` is present up to the root. The root `AGENTS.md` may itself be absent — in that case, the nearest boundary is the root node and this code is downgraded to `info`. |

---

## 5. Broken References (`ACC010`–`ACC019`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC010` | error | `broken reference: <path> in <AGENTS.md> does not exist` | An `AGENTS.md` references a path (in `Dependencies`, `Ownership`, `Inputs`, `Outputs`, or prose) that does not exist on disk. |
| `ACC011` | warn | `reference '<path>' in <AGENTS.md> points outside the project root` | A reference escapes the project root (e.g., `../sibling`). |
| `ACC012` | error | `reference '<path>' in <AGENTS.md> is not a functionality boundary` | A `Dependencies` entry points to a path that has no `AGENTS.md` and is not under one. Per [03](./epistemology.md), every dependency edge is between two functionality boundaries. |
| `ACC013` | warn | `reference '<path>' in <AGENTS.md> is not resolved by any language analyzer` | A declared dependency cannot be confirmed or denied by discovery because no analyzer covers the referenced code's language. |
| `ACC014` | warn | `circular reference: <a> → <b> → … → <a>` | A cycle exists in declared dependencies. Not forbidden by ACC (some architectures are cyclic), but surfaced for review. |

---

## 6. Declared-vs-Discovered Mismatches (`ACC020`–`ACC029`)

Truth resolution per [03 §5](./epistemology.md#5-truth-resolution).

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC020` | warn | `declared dependency '<a> → <b>' not discovered in code` | Declared edge has no corresponding discovered import. Possible stale declared dependency, or the dependency is dynamic/runtime-only and not statically discoverable. |
| `ACC021` | error | `declared/discovered direction mismatch: declared '<a> → <b>', discovered '<b> → <a>'` | Declared and discovered edges go in opposite directions. |
| `ACC022` | warn | `discovered dependency '<a> → <b>' not declared in any AGENTS.md` | Discovered edge with no declared counterpart. Surfaces as a `missing-dependency` suggestion in `acc discover`. |
| `ACC023` | info | `declared and discovered dependency '<a> → <b>' agree` | Aligned edge. Emitted only in `acc check --verbose` or JSON `include_aligned: true` mode — by default aligned edges are silent. |
| `ACC024` | error | `forbidden dependency detected: '<a> → <b>'` | A discovered or declared edge matches a `forbidden_deps` rule in `.acc/config/config.yaml`. |
| `ACC025` | warn | `forbidden dependency declared but unenforced: '<a> → <b>'` | A `forbidden_deps` rule references a path pair that never actually appears in declared or discovered edges; the rule is inert. |

---

## 7. Ownership (`ACC030`–`ACC039`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC030` | error | `duplicate ownership: <path> claimed by <a> and <b>` | Two `AGENTS.md` files both declare ownership of the same functionality path. |
| `ACC031` | warn | `unowned dependency target: <path> has no declared owner` | A path appears as a dependency target but no `AGENTS.md` declares an owner for it. |
| `ACC032` | info | `ownership drift: <path> owner changed from <old> to <new>` | Only emitted when `acc check` reads git history (optional). V1 default: not emitted. |
| `ACC033` | error | `ownership references unknown path '<path>'` | An `Ownership` section names a path that does not exist. |
| `ACC034` | warn | `inferred ownership for <path> not declared` | `acc discover` found a plausible owner from heuristics but no `AGENTS.md` declares it. Always surfaced as a suggestion, never asserted as authoritative. |

---

## 8. Language Analyzers (`ACC040`–`ACC049`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC040` | info | `no language analyzer for extension '<ext>'` | A source file's extension has no enabled analyzer. Emitted at most once per extension per run. |
| `ACC041` | warn | `language analyzer '<name>' failed on <file>: <reason>` | An analyzer threw or returned malformed output on a specific file. The file is skipped; declared edges still apply. |
| `ACC042` | info | `language analyzer '<name>' produced no references for <file>` | Analyzer ran successfully but found no imports. Informational; common for leaf files. |

---

## 9. Memory (`ACC050`–`ACC059`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC050` | warn | `orphan .acc-memory.md at <path>: no AGENTS.md in this directory or any ancestor` | A `.acc-memory.md` exists in a directory with no functionality boundary. Memory is meant to be functionality-local. |
| `ACC051` | info | `empty .acc-memory.md at <path>` | The file exists but is empty. Harmless; emitted only in `acc check --verbose`. |
| `ACC052` | warn | `.acc-memory.md at <path> is not valid UTF-8` | Memory must be Markdown (UTF-8). Recoverable by rewriting. |
| `ACC053` | warn | `.acc-memory.md at <path> appears committed (not gitignored)` | A `.acc-memory.md` is tracked by git. Suggests adding it to `.gitignore`. Does not modify the repo. |
| `ACC054` | info | `.acc-memory.md at <path> exceeds <N> bytes` | Large memory file. Informational; large memories may bloat `acc context --include memory`. |

---

## 10. Configuration (`ACC060`–`ACC069`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC060` | error | `malformed .acc/config/config.yaml: <reason>` | Config exists but is not valid YAML or violates schema. |
| `ACC061` | warn | `unknown key '<key>' in .acc/config/config.yaml` | Config contains a key not recognized by this ACC version. |
| `ACC062` | info | `.acc/config/config.yaml absent; using defaults` | No control plane config. Informational; ACC still works. |
| `ACC063` | warn | `config references unknown language analyzer '<name>'` | `language_analyzers` enables an analyzer that is not compiled in. |
| `ACC064` | error | `ignore pattern '<pat>' invalid: <reason>` | A glob in `ignore` is malformed. |
| `ACC065` | warn | `forbidden_deps rule references unknown path '<path>'` | A `forbidden_deps` entry names a path that doesn't exist. |

---

## 11. Stale Docs (`ACC070`–`ACC079`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC070` | warn | `stale contract: <AGENTS.md> describes <path> but the path no longer exists` | An `AGENTS.md` references a path that has since been removed. |
| `ACC071` | warn | `stale contract: <AGENTS.md> section <section> is empty` | A conventional section is present but has no content. |
| `ACC072` | info | `orphaned code at <path>: no AGENTS.md covers this directory` | Source files exist under a directory with no enclosing functionality boundary. `acc discover` surfaces this as `orphan-code`. |
| `ACC073` | warn | `AGENTS.md at <path> unchanged for <N> commits while code under it changed` | Only emitted when `acc check` reads git history (optional). V1 default: not emitted. |

---

## 12. Security / Safety (`ACC080`–`ACC089`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC080` | error | `unsafe path: '<path>' escapes project root` | Any ACC operation encountered a path that resolves outside the project root. Hard stop for that operation. |
| `ACC081` | error | `unsafe content: AGENTS.md at <path> contains NUL bytes` | The file is not valid UTF-8 text. |
| `ACC082` | warn | `symlink at <path> points outside project root` | A symlink chain escapes the project root. The link is not followed. |
| `ACC083` | error | `refused to execute: <command>` | An ACC operation would have invoked an external build/test tool — this is forbidden by spec (security). Should never happen in correct CLI usage; emitted if a misuse path is hit. |

---

## 13. Reserved (`ACC090`–`ACC099`)

Reserved for future categories. MUST NOT be assigned in V1.

---

## 14. Multi-Agent Orchestration (`ACC100`–`ACC109`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC100` | error | `multi-agent enabled but isolation mode '<mode>' not supported` | `isolation_mode` in config references an unsupported mode. |
| `ACC101` | error | `max_concurrency <N> exceeds resource limits` | `max_concurrency` exceeds configured CPU/memory/token budgets. |
| `ACC102` | warn | `worker modified functionality owned by another worker` | Conflict detected per `conflict_policy`. |
| `ACC103` | error | `recursive spawning exceeds max_depth <N>` | Worker attempted to spawn beyond configured `max_depth`. |
| `ACC104` | warn | `worker task timeout exceeded (<N>s)` | Worker exceeded `task_timeout`. |
| `ACC105` | info | `multi-agent mode disabled; running sequentially` | Multi-agent config enabled but agent doesn't support sub-agents. |

---

## 15. Tooling Subsystem (`ACC110`–`ACC119`)

| Code | Severity | Message pattern | Trigger |
|------|----------|-----------------|---------|
| `ACC110` | warn | `tool '<name>' declared but not found in PATH` | Project declares tool (e.g., `eslint`) but binary missing |
| `ACC111` | error | `tool '<name>' version mismatch: expected <v>, found <v>` | Detected tool version doesn't match declared range |
| `ACC112` | warn | `multiple package managers detected: <list>` | Both `package-lock.json` and `pnpm-lock.yaml` present |
| `ACC113` | info | `project type '<type>' detected but no tools configured` | Ecosystem detected but no tools section in config |
| `ACC114` | error | `plugin '<name>' failed validation: <reason>` | Plugin manifest invalid or dependencies missing |
| `ACC115` | error | `permission denied: <operation> requires <level> permission` | Agent attempted operation beyond granted permissions |
| `ACC116` | warn | `shell command '<cmd>' exited with code <n>` | Shell tool command failed (non-zero exit) |
| `ACC117` | info | `tool registry refreshed: <n> tools added, <m> removed` | Automatic or manual refresh completed |
| `ACC118` | error | `plugin '<name>' capability '<cap>' not implemented` | Plugin declares capability but no handler |
| `ACC119` | warn | `detected tool '<name>' conflicts with core tool '<name>'` | Name collision between detected and core |

---

## 16. JSON Shape

See [07 — JSON Output Schema](./json-schema.md). Each diagnostic in JSON output:

```json
{
  "code": "ACC022",
  "severity": "warn",
  "path": "src/auth/mod.rs",
  "message": "discovered dependency 'src/auth → src/ui' not declared in any AGENTS.md",
  "detail": {
    "from": "src/auth",
    "to": "src/ui",
    "provenance": {
      "kind": "discovered",
      "source": "src/auth/mod.rs",
      "detail": "Rust import"
    }
  }
}
```

`code`, `severity`, `path` are always present. `message` always present. `detail` is optional, command-specific structured context.

---

## 17. Severity-vs-Code Invariants

- A code's severity is fixed at minting.
- `--severity` filter never upgrades a code's severity — it only filters which severities are emitted.
- `config.yaml:warn_only` MAY downgrade a specific code from `error` to `warn` for a project's policy. This is a **per-project override**, not a global code-severity change. The code's canonical severity remains its spec-defined value; `acc check --json` reports both `severity: "warn"` and `canonical_severity: "error"` when overridden.
- A code may never be upgraded above its canonical severity via config.

---

## 18. Adding a New Diagnostic Code

See `.acc/config/workflows/diagnostic.md` for the mandatory procedure. Summary:

1. Pick the next available number in the correct category range.
2. Fix the severity permanently.
3. Define the exact trigger predicate.
4. Define the JSON `detail` payload shape.
5. Add to the correct category table in this document.
6. Wire the emission site in the derivation/check pipeline.
7. Unit test the trigger predicate.
8. Dogfood: run `acc check` on the ACC repo itself; the new code should NOT fire spuriously.
9. Bump versions: new code = minor `acc_version` bump and minor `schema_version` bump.