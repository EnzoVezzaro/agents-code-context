# Security Policy

## Supported Versions

We take security seriously. The following versions are currently supported
with security updates:

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **security@acc-framework.dev** (placeholder).

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any known mitigations

We will acknowledge receipt within 48 hours and provide a more detailed
response within 7 days.

## Security Model

ACC is designed with security as a core principle:

### No Code Execution
- ACC never executes arbitrary code, npm scripts, Makefiles, or build scripts.
- This makes it safe to run on untrusted repositories.

### No Network Access
- ACC is offline-first. No telemetry, no uploads, no hidden network calls.
- All operations are filesystem-local.

### Path Safety
- Paths escaping the project root are refused (ACC080).
- Symlinks escaping the project root are not followed (ACC082).
- All paths are resolved relative to the detected project root.

### Input Validation
- All file reads are UTF-8 validated (ACC001, ACC081).
- YAML/JSON parsing uses safe libraries with size limits.
- Glob patterns are validated (ACC064).

### Deterministic Operations
- Same repo state + same flags = byte-identical output.
- No timestamps, random IDs, or locale-dependent formatting in JSON.
- This prevents supply-chain attacks on CI systems consuming ACC output.

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious `AGENTS.md` | Heuristic parsing only; no code execution |
| Symlink attacks | Path resolution with root boundary checks |
| Path traversal | All paths canonicalized and bounded to project root |
| Resource exhaustion | `--max-bytes`, configurable limits |
| Supply chain (JSON) | Deterministic output, schema validation |
| Analyzer exploits | Optional, sandboxed, size-limited |

## Disclosure Policy

- We aim to patch critical vulnerabilities within 7 days.
- Coordinated disclosure: we request 90 days before public disclosure.
- Credit given to reporters in release notes (unless anonymity requested).

## Security-Related Configuration

See `.agents/acc/config.yaml` for security-relevant settings:
- `ignore` patterns to exclude untrusted paths
- `forbidden_deps` to enforce architectural boundaries
- `multi_agent.resource_limits` to bound resource usage

## Contact

For security questions or concerns: **security@acc-framework.dev** (placeholder)