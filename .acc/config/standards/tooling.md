# tooling.md — ACC Tooling Standards

This standard defines tooling conventions for the ACC project itself and projects using ACC.

## Core Principles

1. **Automatic** — Tool detection and registration happens without manual intervention.
2. **Project-aware** — Uses tools declared by the project (package.json, Cargo.toml, etc.).
3. **Deterministic** — Same project state → same tool registry.
4. **Permissioned** — Explicit permission model (safe/moderate/dangerous).
5. **Extensible** — Plugin interface for third-party tooling.

## Tool Detection Standards

### Node.js Projects

| File | Detected Capability |
|------|---------------------|
| `package.json` | Project type, scripts, dependencies |
| `package-lock.json` | Package manager: npm |
| `pnpm-lock.yaml` | Package manager: pnpm |
| `yarn.lock` | Package manager: yarn |
| `tsconfig.json` | TypeScript enabled |
| `.eslintrc.*` / `eslint.config.*` | ESLint |
| `.prettierrc*` | Prettier |
| `vitest.config.*` / `jest.config.*` | Test runner |

### Rust Projects

| File | Detected Capability |
|------|---------------------|
| `Cargo.toml` | Project type, dependencies, targets |
| `Cargo.lock` | Locked dependencies |
| `rust-toolchain.toml` | Toolchain version |
| `clippy.toml` | Clippy config |

### Python Projects

| File | Detected Capability |
|------|---------------------|
| `pyproject.toml` | Project type, dependencies, tools config |
| `requirements.txt` / `requirements-*.txt` | Dependencies |
| `poetry.lock` / `uv.lock` | Package manager |
| `pytest.ini` / `pyproject.toml [tool.pytest]` | Pytest config |
| `ruff.toml` / `pyproject.toml [tool.ruff]` | Ruff config |
| `mypy.ini` / `pyproject.toml [tool.mypy]` | Mypy config |

### Go Projects

| File | Detected Capability |
|------|---------------------|
| `go.mod` | Project type, dependencies |
| `go.sum` | Checksums |
| `golangci.yml` / `.golangci.yml` | Golangci-lint config |

## Permission Defaults

### Safe (Always Enabled)
- `filesystem.read`, `filesystem.glob`, `filesystem.stat`
- `search.contracts`, `search.edges`, `search.code`
- `git.read` (status, log, diff, show)
- `graph`, `context`, `memory.read`
- `project.detect`

### Moderate (Configurable, Default: Auto-Approve)
- `filesystem.write`
- `shell.enabled` with `approval: "auto"`
- `git.write` (commit, add, branch)
- `tool.test`, `tool.lint`, `tool.typecheck`, `tool.build`, `tool.format`, `tool.audit`

### Dangerous (Default: Denied)
- `filesystem.delete`
- `network.enabled`
- `tool.install` (package installation)
- `git.push`
- `deploy`

## Plugin Standards

### Plugin Structure
```
.acc/config/tools/<name>/
├── plugin.yaml          # Manifest (required)
├── index.js|py|rs|go    # Implementation (required)
├── README.md            # Documentation
└── test/                # Plugin tests
```

### Plugin Manifest (`plugin.yaml`)
```yaml
name: <unique-name>
version: "1.0.0"
description: "One-line description"
author: "Name <email>"
license: "MIT"

capabilities:
  - name: <capability-name>
    description: "What this does"
    command: "<command-template>"
    permissions: ["shell", "network"]  # subset of ACC permissions

project_detection:
  files: ["<glob-patterns>"]
  ecosystems: ["<ecosystem-names>"]  # or ["any"]

dependencies:
  - "<external-dependency>"  # e.g., "docker CLI"
```

### Plugin Implementation
- MUST accept JSON input via stdin
- MUST emit JSON output via stdout
- MUST exit 0 on success, non-zero on failure
- MUST honor ACC project root boundary
- MUST NOT make network calls unless `network` permission granted

## Tool Execution Standards

### `acc tool <name>` Contract
- Input: `--args` (array), `--scope` (path), `--json` flag
- Output: Structured JSON with `exit_code`, `stdout`, `stderr`, `duration_ms`
- Exit code: Tool's exit code, `2` = tool not found, `1` = permission denied

### `acc shell` Contract
- Input: Command string, `--cwd`, `--timeout`, `--env`, `--json`
- Output: Structured JSON with `exit_code`, `stdout`, `stderr`, `duration_ms`
- Sandbox: Restricted environment, project root boundary, resource limits

## Configuration Standards

### Minimal Config
```yaml
tools:
  auto_discover: true
```

### Recommended Config
```yaml
tools:
  auto_discover: true
  defaults:
    filesystem: true
    search: true
    shell: true
    git: true
    project: true
    context: true
    graph: true
    memory: true
    check: true
  detected:
    enabled: true
  plugins:
    enabled: true
  permissions:
    filesystem:
      read: true
      write: true
      glob: true
    shell:
      enabled: true
      approval: "auto"
    git:
      read: true
      write: true
    network:
      enabled: false
```

## Security Standards

1. **No auto-install** — ACC never installs tools without explicit user action.
2. **Path boundary** — All filesystem operations bounded to project root.
3. **No secrets** — Shell environment stripped of secrets by default.
4. **Resource limits** — Timeout, memory, CPU limits enforced.
5. **Audit trail** — All tool invocations logged with provenance.

## Multi-Agent Tool Distribution

| Agent Role | Tool Set |
|------------|----------|
| Coordinator | Full graph, full context, validation, git write, shell (integration) |
| Worker | Scoped context, scoped graph, scoped filesystem, scoped shell, relevant detected tools |

Workers receive `acc tools --json --scope <path>` capability manifest.