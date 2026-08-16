# 13 — Security Model

> **TLDR:** what ACC guarantees, what it does not, and
> the file surface it touches. The reporting process lives in the
> repository's [SECURITY.md](https://github.com/EnzoVezzaro/agents-code-context/blob/main/SECURITY.md)
> — this page is the model itself.

ACC is designed around a small set of **hard guarantees**. They are
deliberate, documented invariants, not best-effort behavior:

1. **No network access.** The core CLI never makes network calls, never
   sends telemetry, and never uploads repository contents. Offline by
   design.
2. **No arbitrary code execution.** The core CLI does not execute
   project code, npm scripts, Makefiles, or build scripts. The only
   subprocess the core runs is a read-only `git ls-files` call — used
   solely to detect committed `.acc-memory.md` files for diagnostic
   `ACC053`.
3. **Path-boundary enforcement.** Project-root detection stops at the
   home directory, and every ACC operation stays inside the detected
   root. Generated directories (`.git/`, `node_modules/`, `target/`,
   `dist/`, `build/`, `*.lock`) are excluded from scans by default.
4. **Declared facts win.** Repository instructions are parsed
   heuristically and never executed; discovered and inferred facts are
   always second-class to what a human declared.

These guarantees make ACC safe to run on repositories you do not fully
trust — the documented threat model for an agent-native tool.

---

## 1. What ACC Reads

- **`AGENTS.md`** files — declared contracts, parsed heuristically.
- **Source files** — scanned for path tokens to derive discovered edges.
- **`.acc/config/config.yaml`** — the optional control plane.
- **`.acc-memory.md`** — durable agent memory.

ACC never reads `.gitignore` to decide what to scan. It uses its own
built-in defaults plus the `ignore:` list in `.acc/config/config.yaml`.

## 2. What ACC Writes

Only explicit commands write to the repository, and always within the
project root:

| Command | Writes |
|---------|--------|
| `acc init` | `.acc/config/` scaffolding; appends `.acc-memory.md` to `.gitignore` |
| `acc build --yes` | missing `AGENTS.md` contract files (+ initial `.acc-memory.md`) |
| `acc document --apply` | the target `AGENTS.md` |
| `acc discover --apply` | suggested `AGENTS.md` changes |
| `acc memory add\|clear` | `.acc-memory.md` entries |

**Dry-run is the default** for every write-capable command (`build`,
`document`, `discover`). See the "Modifies repo?" column in
[05 — CLI Commands](./05-cli-commands.md).

## 3. Untrusted Input Surface

Repositories may contain malicious or unexpected inputs:

- `AGENTS.md` and other instruction files (parsed, never executed)
- `.acc/config/config.yaml` (malformed or hostile configuration)
- Symlinks and unusual filesystem structures
- Extremely large files or repositories
- Unexpected encodings or parser inputs
- Files specifically crafted to exploit ACC or its dependencies

**ACC is not a sandbox.** It does not replace operating-system
permissions, container isolation, or other security controls. Treat
repository instructions and agent context as potentially untrusted
input when running ACC — or any coding agent — against repositories you
do not fully trust.

## 4. `acc battle` (ABA) — Outside the Framework's Model

`acc battle` launches **ABA (ACC Battle Arena)**, a separate benchmark
application published as `acc-battle-arena`. ABA is **not** part of the
ACC framework's security model: it runs benchmarks against copies of
repositories, may start projects, and can make network calls to model
providers. ABA has its own documentation and should be used only on
repositories you trust. The framework never requires ABA.

## 5. Secrets and Memory

- Never place API keys, passwords, tokens, or private keys in
  `AGENTS.md`, source files, or any file ACC or an agent might read.
- `.acc-memory.md` is **gitignored** (agents write local observations
  there), but it is a scratchpad — **not a vault**.
- Sensitive work belongs in isolated environments: containers,
  sandboxes, or dedicated development environments with least-privilege
  credentials.

## 6. Reporting

ACC's vulnerability reporting process — private disclosure via GitHub
Security Advisories, supported versions, and responsible-disclosure
policy — lives in the repository's
[SECURITY.md](https://github.com/EnzoVezzaro/agents-code-context/blob/main/SECURITY.md).
**Please do not report vulnerabilities through public GitHub issues.**
