# ABA — ACC Battle Arena

ABA is a **standalone benchmark application** used to test and evaluate the
[ACC framework](https://github.com/EnzoVezzaro/agents-code-context).

> **ABA is not part of the ACC framework.** The framework never requires it
> and works without it. ABA lives in this directory so the repository stays
> a single place to develop both, but it is an independent tool with its own
> entry point, dependencies, and lifecycle.

## What it does

ABA imports a project (local directory or GitHub repository), snapshots it
into an isolated Docker container, runs benchmark agents against it, and
collects a diff report. The original repository is never modified.

## Usage

```bash
# Directly (ABA is standalone):
node aba/index.cjs ./my-project
node aba/index.cjs user/repo --network disabled --preserve

# Via the acc CLI (convenience launcher):
acc battle ./my-project
```

| Option | Description |
|--------|-------------|
| `--network <policy>` | `disabled` \| `restricted` \| `enabled` (default `restricted`) |
| `--preserve` | Keep the sandbox container after the battle for debugging |
| `--timeout <seconds>` | Benchmark timeout (default `1800`) |
| `--model <model>` | Default model for benchmark agents |
| `--agent <name:model>` | Specify a benchmark agent (repeatable) |

## Status

Experimental. Docker is required to run isolated benchmarks. The benchmark
agent loop is a placeholder — real agent harnesses plug in here.

## Development

- `aba/cli.cjs` — argument parsing and battle configuration
- `aba/importer.cjs` — project import and isolated snapshots
- `aba/sandbox.cjs` — Docker sandbox lifecycle
- `aba/results.cjs` — result collection and diff reports
- `aba/index.cjs` — standalone entry point
