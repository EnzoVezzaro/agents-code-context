# Security Policy

ACC is an open-source, community-driven project. We take security
seriously — this policy documents what ACC guarantees, what it does not,
and how to report issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.4.x   | ✅        |
| 0.3.x   | ✅        |
| 0.2.x   | ⚠️ security fixes only |
| < 0.2   | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub
issues.**

Use GitHub's private [Security Advisories](https://github.com/EnzoVezzaro/agents-code-context/security/advisories)
to report vulnerabilities. When possible, include:

- A description of the vulnerability
- Steps to reproduce it
- The affected version or commit
- Potential impact
- Proof of concept or relevant files
- Possible mitigations or suggested fixes

If you're unsure whether something is a security vulnerability, **report
it anyway**. We'd rather investigate a false alarm than miss a real
issue. We make a reasonable effort to acknowledge, investigate, and
address valid reports as quickly as possible.

---

## Security Model

ACC is designed around a small set of hard guarantees. These are
deliberate, documented invariants — see
[docs/01-philosophy.md](./docs/01-philosophy.md) and
[docs/05-cli-commands.md](./docs/05-cli-commands.md).

### What ACC guarantees

- **No network access.** The core CLI never makes network calls, never
  sends telemetry, and never uploads repository contents. It is offline
  by design.
- **No arbitrary code execution.** The core CLI does not execute
  project code, npm scripts, Makefiles, or build scripts. The only
  subprocess the core runs is a read-only `git ls-files` call (to
  detect committed `.acc-memory.md` files for diagnostic `ACC053`).
- **Path-boundary enforcement.** Project-root detection stops at the
  home directory, and ACC operations stay inside the detected root.
  `node_modules/`, `.git/`, and other generated directories are
  excluded from scans by default.
- **Declared facts win.** Repository instructions are parsed
  heuristically and are never executed; discovered and inferred facts
  are always second-class to what a human declared.

### What ACC reads

- `AGENTS.md` files (declared contracts, parsed heuristically)
- Source files (for discovered edges, via path-token matching)
- `.acc/config/config.yaml` (the optional control plane)
- `.acc-memory.md` files (durable agent memory)

### What ACC writes

Only explicit commands write to the repository, and always to the
project root:

- `acc init` — creates `.acc/config/` scaffolding and appends
  `.acc-memory.md` to `.gitignore`
- `acc build --yes`, `acc document --apply`, `acc discover --apply` —
  create or update `AGENTS.md` contract files
- `acc memory add|clear` — write to `.acc-memory.md`

Dry-run is the default for every write-capable command. See the
"Modifies repo?" column in [docs/05-cli-commands.md](./docs/05-cli-commands.md).

### Untrusted input surface

Repositories may contain malicious or unexpected inputs, including:

- `AGENTS.md` and other instruction files (parsed, never executed)
- `.acc/config/config.yaml` (malformed or hostile configuration)
- Symlinks and unusual filesystem structures
- Extremely large files or repositories
- Unexpected encodings or parser inputs
- Files specifically crafted to exploit ACC or its dependencies

**ACC is not a sandbox.** It does not replace operating-system
permissions, container isolation, or other security controls. Treat
repository instructions and agent context as potentially untrusted
input, and use appropriate caution when running ACC — or any agent —
against repositories you do not fully trust.

### A note on `acc battle` (ABA)

`acc battle` launches **ABA (ACC Battle Arena)**, a separate benchmark
application published as `acc-battle-arena`. ABA is **not** part of the
ACC framework's security model: it runs benchmarks against copies of
repositories, may start projects, and can make network calls to model
providers. ABA has its own documentation and should be used only on
repositories you trust. The framework never requires ABA.

---

## Agentic Development

ACC exists to help coding agents work with repositories. Agents read
files, modify files, and may execute tools — which means the *agent
ecosystem* around ACC carries its own risks. ACC itself stays offline
and non-executing, but the agents using it are not.

If you discover that ACC can:

- Execute unintended code
- Access files outside its intended scope
- Escape repository boundaries
- Cause unexpected network activity
- Bypass configured restrictions
- Expose sensitive information
- Or otherwise create a security risk

**please report it privately.**

---

## Recommended Practices

- **Keep ACC and its dependencies up to date.** Security fixes are only
  useful once you install them.
- **Never put secrets in repository files.** Don't place API keys,
  passwords, tokens, or private keys in `AGENTS.md`, source files, or
  anywhere ACC or an agent might read. `.acc-memory.md` is gitignored,
  but it is a scratchpad — **not a vault**.
- **Review your `.gitignore` and ACC configuration.** Make sure
  sensitive files and directories are excluded. ACC never reads
  `.gitignore` to decide what to scan — it uses its own defaults plus
  the `ignore:` list in `.acc/config/config.yaml`.
- **Review agent changes before committing.** Don't assume an agent is
  correct because the code compiles.
- **Use least privilege.** Give agents and tools only the filesystem,
  credentials, and permissions they actually need.
- **Use isolated environments for sensitive work.** Containers,
  sandboxes, or dedicated development environments reduce the impact of
  unexpected behavior.
- **Don't rely on ACC as a security boundary.** ACC provides context;
  it is not a substitute for permissions, sandboxing, or
  authentication.
- **If something looks wrong, stop and investigate.** Report
  vulnerabilities responsibly — even a small observation can help.

> **You know your environment better than we do.** Use ACC according to
> the level of trust appropriate for your repository and your data.
> When in doubt, **protect your data first**.

---

## Disclosure & Disclaimer

When appropriate, reported vulnerabilities may be disclosed publicly
after a fix or mitigation is available. For significant vulnerabilities,
we may coordinate disclosure with the reporter. Security researchers
who responsibly report vulnerabilities may be credited in release notes
unless they prefer to remain anonymous.

ACC is provided as open-source software on an **"AS IS" and "AS
AVAILABLE" basis**, to the fullest extent permitted by applicable law.
The maintainers and contributors cannot guarantee that ACC will always
be free from bugs, vulnerabilities, privacy risks, or unexpected
behavior, and are not responsible for damages arising from its use,
misuse, modification, or inability to use it.

**Please protect yourself, protect your data, and use your best
judgment.** Thank you for helping make ACC safer for everyone.
