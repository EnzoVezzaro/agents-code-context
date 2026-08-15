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

Instead, please report them privately via the repository's
[Security Advisories](https://github.com/EnzoVezzaro/agents-code-context/security/advisories)
feature, which keeps the report confidential until a fix is released.

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
- All paths are resolved relative to the detected project root.
- Files and directories are validated against the configured `ignore` patterns.

### Input Validation
- All file reads are UTF-8 validated (ACC001).
- YAML parsing is lenient by design (no code execution); config is validated
  against known keys (ACC060) with sensible defaults when absent (ACC062).

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

## Disclosure Policy

- We aim to patch critical vulnerabilities within 7 days.
- Coordinated disclosure: we request 90 days before public disclosure.
- Credit given to reporters in release notes (unless anonymity requested).

## Security-Related Configuration

See `.acc/config/config.yaml` for security-relevant settings:
- `ignore` patterns to exclude untrusted paths from scanning
- `diagnostics.warn_only` to downgrade specific codes

## Contact

For security questions or concerns, open a [security advisory](https://github.com/EnzoVezzaro/agents-code-context/security/advisories) or email the maintainers via the contact details on the repository profile.