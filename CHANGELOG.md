# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.7] - 2026-08-18

### Added
- **PR AI Contribution Verification** — optional AI tooling declaration
  for pull requests. Contributors can add `.github/pr.yml` to declare
  harness, provider, and model used. CI verifies against the repository's
  provider/harness allowlist in `.github/pr_allow_providers.yml` and posts
  (or updates) a single bot comment on the PR with the result.
- **`pr_allow_providers.yml`** — repository-controlled provider/harness
  policy. Supports provider-level `free_api_access`, `(all)` for all models,
  per-model `free-model`/`paid-model` lists, and harness allowlists.
  Committed to the repo for determinism, transparency, and reviewability.
- **`acc uninstall`** — remove all ACC-generated files from the repository
  (`.acc/`, `AGENTS.md` at root if template-matching, `ACC_WARN.md`,
  `.acc-memory.md`, `.env` ACC keys, `.gitignore` ACC entries). Asks for
  confirmation interactively; `--yes` skips the prompt.
- **`acc engine --rollback`** — undo the last ACC file-modifying
  operation by restoring a snapshot from `.acc/state/rollback/`. `--list`
  shows available snapshots; `--id <snapshot-id>` restores a specific one;
  `--yes` skips the confirmation prompt. Only the last 5 snapshots kept.
- **Snapshot-based rollback in `engine --init-context`** — saves a
  snapshot before the engine modifies files, so `acc engine --rollback`
  can restore the pre-init state.
- **AI contract filling** — the engine AI phase now returns filled
  `AGENTS.md` contract content (Purpose, Responsibilities, Ownership,
  Inputs, Outputs, Dependencies, Constraints, Architecture) alongside
  knowledge entries and drift proposals. With `--apply`, filled contracts
  are written to `AGENTS.md` and knowledge to `.acc-memory.md`.
- **Template system** — `.acc/config/templates/` holds customizable
  Markdown templates for `AGENTS.md`, `.acc-memory.md`, and
  `ACC_WARN.md`. Templates use `{{variable}}` syntax. Resolution order:
  explicit `--template` path → `.acc/config/templates/<name>.md` →
  built-in default.
- **`--template <path>` flag** — on `acc init` and
  `acc engine --init-context` to override the default template.
- **`templates` config section** — `config.yaml` now supports
  `templates.agents_md` for config-based template override.
- **Supervisor provider/model config** — `engine.supervisor` now
  supports separate `provider` and `model` keys so the supervisor can
  use a different AI provider than the engine.
- **JSON output mode for AI** — `realGenerateText` now passes
  `responseFormat: { type: 'json_object' }` for OpenAI-compatible
  providers (NVIDIA, OpenRouter, Groq, Together).
- **Interrupt memory** — mandatory agent behavior: when the human
  stops, corrects, or redirects the agent mid-task, the agent must
  record the reason in `.acc-memory.md` under "Interrupts & Corrections".
- **`scripts/sync-skill-copies.sh`** — one-command script to sync
  canonical `skills/acc/SKILL.md` to all 7 agent locations.

### Changed
- **`acc init` writes AGENTS.md to disk** — previously printed the
  template to stdout only; now writes the file to the project root.
- **`acc init` scaffolds `templates/` directory** — `.acc/config/templates/`
  is now created during init with the default `agents.md` template.
- **CI publish-safety** — checks for `['bin','lib','skills']` files field
  (added `skills` to published files).
- **`check-skill-copies.js`** — now includes `.agents/skills/acc` in the
  checked locations list.
- **Engine docs updated** — `docs/05-cli-commands.md` and README updated
  to reflect all new features.
- **All 7 skill copies synced** — updated with interrupt memory, templates
  section, and new commands (`uninstall`, `engine --rollback`).

## [0.6.5] - 2026-08-18

### Changed
- **Automatic npm publish on push to main** — replaced manual
  `release.yml` (workflow_dispatch + NPM_TOKEN) with `publish.yml`:
  pushes to main auto-publish to npm when `package.json` version is
  new. Uses npm Trusted Publishing (OIDC) for provenance. Tests,
  consistency checks, and git tag creation are all automatic. Release
  process is now: bump version, commit, push.

## [0.6.4] - 2026-08-18

### Added
- **`acc graph` includes full knowledge graph** — every node now carries
  diagnostics (ACC0xx violations), memory state (`.acc-memory.md`
  existence, size, entries), and edge counts (inbound/outbound/total).
  The result includes a `summary` with aggregate diagnostics, memory
  coverage, drift report status, and engine state. Scoped views
  (`acc graph src/auth`) show the complete knowledge for one boundary.
- **Graph command tests** — 12 new tests covering enriched node data,
  scoped output, memory tracking, and all output formats.

### Changed
- **Scoped graph keeps ownership edges** — `acc graph [path]` now
  includes ownership edges to the root node even when root is outside
  the depth filter, so ownership relationships are never silently lost.

## [Unreleased]

## [0.6.3] - 2026-08-18

### Changed
- **Package renamed to `acc-code-context`** — the npm package is now
  `acc-code-context` (was `acc-agents`). All references updated:
  package.json, CI/release workflows, all 7 skill copies, docs site,
  CLI code, tests.
- **CI test job installs dependencies** — `npm install` added to the
  `test-cli` CI job so `@ai-sdk/openai` (and other AI SDK providers)
  are available during the test suite. Fixes 27 failing tests caused by
  `getModel()` returning "provider package not installed" errors.

## [0.6.2] - 2026-08-18

### Changed
- **Release pipeline hardened** — pre-flight checks now verify: tests
  pass, package name is `acc-code-context`, all 6 host manifests agree
  (`check:versions`), all skill copies are in sync
  (`check:skill-copies`), npm auth is valid, package contents are
  correct (`npm pack --dry-run`), version doesn't already exist on npm,
  and version is higher than the latest published release.
- **CI consistency gate** — new `consistency` job runs
  `check:versions` + `check:skill-copies` on every push and PR. New
  `publish-safety` job verifies root package is `acc-code-context`, docs is
  `private: true`, and `files` is `["bin","lib"]`.
- **`lib/` restructured into two layers** — the domain logic moved to
  `lib/core/` (graph, diagnostics, config, memory, ai, engine, skill,
  templates, …) and `lib/commands/` keeps the thin per-command CLI
  handlers. This is why `lib/core/ai.js` (provider/model logic) and
  `lib/commands/ai.js` (`acc ai` handler) coexist — the same-name files
  are not duplicates, they are the core/CLI split. All requires
  updated; behavior unchanged (full deterministic suite passes).

### Added
- **`.agents/` distribution folder** — the universal Agent Skills
  installation target (`.agents/skills/acc/`), the fallback path read
  by Codex, Cursor, Copilot, Gemini, and OpenCode. Ships SKILL.md,
  22 reference playbooks, 7 role sub-agents, and README — byte-identical
  to the canonical `skills/acc/` source and all other agent-native
  copies.
- **Host adapter manifests** — ACC is now discoverable/installable from
  every major agent ecosystem, replicating the ponytail layout:
  `opencode.json` + `.opencode/plugins/acc.mjs` (OpenCode plugin that
  exposes the `acc` CLI as a native tool), `plugin.json` (generic) +
  `plugin.yaml` (Hermes-style), `.claude-plugin/marketplace.json` +
  `plugin.json` (Claude Code), `.codex-plugin/plugin.json` (Codex,
  with skills + interface), `.grok-plugin/marketplace.json` (Grok),
  `gemini-extension.json` (Gemini CLI), and `.cursor/rules/acc.mdc`
  (Cursor always-on rule). All version-bearing manifests agree with
  `package.json` (enforced by `scripts/check-versions.js`).
- **Consistency scripts** — `npm run check:versions` verifies every
  host manifest version agrees with `package.json` (catches the
  "stale together" failure mode ponytail shipped in v4.8.0), and
  `npm run check:skill-copies` verifies every installed skill copy
  (`.agents/skills/acc`, `.claude/skills/acc`, …) is byte-identical
  to the canonical `skills/acc/` (modulo `__ACC_VERSION__`).
- **Fixed `acc install --agent opencode` target** — the OpenCode skill
  installs to `.opencode/skills/acc/` (plural `skills`, the location

## [0.6.1] - 2026-08-17

_This section was cut from [Unreleased] by `npm run bump`._

## [0.5.0] - 2026-08-17

_This section was cut from [Unreleased] by `npm run bump`._
  OpenCode actually discovers) instead of `.opencode/skill/acc`.
- **Native skill copies for every agent** — the ACC repository now
  ships the skill installed in each agent's native config directory
  (`.claude/skills/acc`, `.codex/skills/acc`, `.cursor/skills/acc`,
  `.opencode/skills/acc`, `.gemini/skills/acc`, `.vscode/skills/acc`),
  so any agent that opens the repo finds ACC already configured — the
  same pattern used by impeccable/ponytail. All copies are verified
  byte-identical to `skills/acc/` by `check:skill-copies`. The
  redundant `.agents/` bootstrap copy was removed (this repo *is* the
  skill).
- **Fixed dep extraction for backticked/annotated paths** — the
  `AGENTS.md` heuristic parser now strips inline-code backticks and
  wrapping parens/brackets when extracting dependencies, so
  `` `.claude-plugin/` `` and `(skills/acc)` resolve as real paths
  (previously they produced ACC010 broken-reference errors).
- **CLI-managed AI provider setup (`acc ai`)** — the engine's provider
  flow is now `select provider → api key → model`: `acc ai add` walks
  the three steps interactively or fully deterministic with flags,
  `acc ai remove <id>` / `acc ai default <id>` manage the lifecycle,
  and `acc ai models <id>` loads a provider's available models
  dynamically. Keys are stored in the project's `.env` (gitignored) as
  `ACC_<PROVIDER_ID>_KEY`; providers are written to the CLI-managed
  `.acc/config/ai.yaml` (loaded on top of `config.yaml`, the human
  config is never rewritten). `.env.example` is committed as the
  template.
- **Engine AI resilience** — `engine.ai` in config controls per-call
  retries (`retries`), the pause between attempts
  (`retry_delay_ms`), provider fallback (`fallback`), and watch-mode
  max consecutive all-providers-failed runs
  (`max_consecutive_failures`). Every failed attempt is reported
  (`ai.retry_log`), skipped providers are named (`ai.provider_notes`),
  and `acc engine --watch` stops with a FATAL error after the configured
  consecutive failures instead of silently burning tokens.
- **Full ACC skill** — `skills/acc/` redesigned with an
  impeccable-style structure: rich frontmatter, operating principles,
  a commands table, per-command routing, and 21 per-command
  `references/` (workflows, flags, edge cases) covering the whole CLI +
  engine surface.
- **Canonical skill at `skills/acc/` + universal install via `npx skills`**
  — the ACC skill now lives at `skills/acc/SKILL.md` in the repo
  (with `references/`: engine limits + over-feeding), the same file
  published through the standard Agent Skills flow
  (`npx skills add EnzoVezzaro/agents-code-context --skill acc`, per
  agent or `--global`). `acc install` reads that canonical file and
  copies SKILL.md + references to the target, so both channels always
  distribute the same skill — npm ships the engine (CLI), Agent
  Skills ships the instructions. Docs (05/03/README) updated with the
  universal install path.
- **Engine intelligence benchmark (`npm run benchmark:engine`)** —
  `scripts/benchmark-engine.cjs` measures, live, three dimensions:
  (1) AI degradation vs repository size (22 → ~3,900 files, seeded
  drift, contract obedience, hallucination, knowledge budget),
  (2) ACC-file contribution (same code with vs without contracts +
  memory), and (3) graph compactness (bytes/item/file at every scale).
  First measured run (`docs/benchmarks/engine-2026-08-17.md`, NVIDIA
  NIM nemotron nano): drift detected 4/4 sizes with constant ~4.6 KB
  per-review context; ACC files doubled reported drift items; graph
  stayed ~180 bytes/item with no prose from 22 to 3,908 files.
- **Engine limits documented (measured)** — the AI phase's hard
  budgets (contract ≤ 4 KB, slice ≤ 1.5 KB, ≤ 10 changed files, ≤ 6 KB
  changed code, ≤ 5 knowledge entries) and the four measured findings
  now live in `docs/05` under "Engine limits".
- **The over-feeding problem documented** — a new section in
  `docs/04` explains context explosion (why feeding a big repo whole
  degrades models) and ACC's structural answer: routing index (no
  prose), per-scope context assembly, hard budgets, trigger gating,
  and determinism as the floor.

### Added
- **Skill sub-agents (`skills/acc/agents/`)** — optional role agents
  that take on ACC jobs the engine would otherwise fill, available as
  the engine-OFF alternative: `acc-supervisor` (scores proposed ACC
  changes before they land, the supervisor role without the engine),
  `acc-documenter` (keeps AGENTS.md + memory in sync after a change),
  `acc-reviewer` (scores repository ACC health 0–100, read-only),
  `acc-explorer` (maps the repo through the CLI before reading source).
  Each has agent frontmatter (name, codex-name, description, tools,
  model, effort, max-turns) + a role playbook. `acc install` copies
  them alongside SKILL.md/README/references; SKILL.md + README document
  the agent table with engine-ON behavior (the engine runs these roles
  automatically).
- **One sub-agent per ACC job** — `acc-checker` (runs the ACC0xx scan
  and fixes every violation until `acc check` is clean),
  `acc-filler` (completes placeholder contracts with real content read
  from the code), and `acc-initializer` (bootstraps a fresh repo with
  the full ACC framework in one pass). The agent set now covers the
  whole lifecycle: bootstrap → map → validate & fix → complete → sync →
  audit → gate; `acc-documenter` hands off validation/completion to
  `acc-checker`/`acc-filler` instead of duplicating them. `acc install`
  copies all 7 agents; install tests assert each byte-identical copy.
- **`acc battle` installs ABA on first use** — when the standalone
  ABA benchmark (ACC Battle Arena) is not already available
  (npm-installed `acc-battle-arena` package or local `aba/` checkout),
  `acc battle` now clones the aba-arena repository into the per-user
  cache (`~/.cache/acc/aba-arena`, honoring `XDG_CACHE_HOME`), installs
  its dependencies (the prepare script builds the bundled UI), resolves
  the entry point from the cloned package.json (`src/index.cjs` in the
  repo layout), and then runs it against the project. Verified
  end-to-end: fresh install → clone → npm install → headless benchmark
  → clean shutdown. In `acc tools`, `battle` is now listed under its
  own `launcher` tier (auto_install, aba_launcher, headless,
  local_sandbox, network_policy) — never as a CLI or engine
  capability. The skill (`skills/acc/`) documents it with
  `references/battle.md`.

### Removed
- **`acc tool` and `acc shell` removed from the docs** — these commands
  were documented but never existed in the CLI (no registry entry, no
  implementation), and executing project code contradicts ACC's core
  security invariant (no code execution on untrusted repos; the agent
  executes, ACC understands). Their spec sections in `docs/05`, the
  speculative `docs/12-tooling.md` (execution model, permission model,
  plugin runtime), the `ACC110`–`ACC119` diagnostic range, and the
  `.acc/config/workflows/tooling.md` workflow were all removed. What
  remains is real: `acc tools` lists capabilities (core/detected/
  plugins) but never executes. The config example now shows only the
  `tools` keys the implementation actually reads.

### Added
- **ACC as an installable skill** — `acc install` deploys the ACC
  capability into the agent environment (default `--agent claude` →
  `.agents/skills/acc/`): a `SKILL.md` with the engine ON/OFF
  responsibility split, the full deterministic command surface, and the
  engine run instructions; `--dir <path>` for a custom target. The
  repository itself stays a standard `AGENTS.md` repo — ACC is a
  capability the agent has, not a framework the repo must adopt.
  Idempotent (never overwrites without `--force`), rejects unknown
  agents / conflicting flags (exit 2), and the installed skill is
  detected by the graph (`skill` nodes) and surfaced through
  `acc slice`.
- **Engine ON/OFF responsibility split** — when the engine is ON
  (always-on AI intelligence, `acc engine --watch`), the coding agent
  ignores ACC file upkeep: the engine does automatically what the agent
  would otherwise have to do. When the engine is OFF, the agent working
  on the project owns the job on its workflow (keep ACC files and
  knowledge in sync via the deterministic commands). Supervisor scoring
  (`--supervisor`) unchanged. Documented in the skill, the repo
  workflows (`.acc/config/workflows/feature.md`) and `docs/05`.
- **`acc engine`** — keeps ACC files and knowledge in sync: deterministic
  scan (graph + diagnostics + slices + dependency-gap plan) always;
  deterministic sync via `acc build`/`acc discover` (additive kinds only,
  never auto-removing declared facts or injecting placeholder owners)
  with `--apply`; and an optional AI phase (AI SDK v5) that reviews each
  boundary contract against its derived slice, writing durable knowledge
  to `.acc-memory.md` and reporting drift/skill/standard gaps as
  proposals.
- **Code-aware AI evaluation** — the trigger now exposes the changed
  files (content-hash diff vs the previous run's snapshot) in both
  `commits` and `changes` modes, and the AI prompt embeds that changed
  source code (budgeted) so the model reviews the actual code, not just
  the derived relationships.
- **Supervisor (`--supervisor`)** — a second AI pass scores the engine's
  proposals against ACC rules (0-100). Below the config threshold
  (default `85`, `engine.supervisor.threshold`) it iterates on its own
  proposals with the supervisor's feedback until compliant or
  `max_iterations` (default 3) is reached; knowledge is written only
  after approval.
- **Live watch mode (`--watch`)** — keeps the engine running as a server
  in the terminal: re-runs on filesystem changes (debounced) and streams
  phase logs, AI results, and supervisor scores to stdout.
- **`ACC_WARN.md` drift report** — every engine run regenerates the
  developer-facing alarm in the project root (gitignored): code
  violations (ACC0xx error/warn), docs-behind-code drift (discovered
  deps not declared), docs-ahead-of-code drift (declared deps with no
  code reference — new `codeBacked` tracking in the graph), and AI
  findings with supervisor verdicts. Deterministic when AI is disabled.
  Excluded from the trigger snapshot and watch loop so it never counts
  as code or re-triggers itself.
- **`acc engine --init-context`** — one-shot bootstrap of a repository
  into full ACC context: scaffolds ACC (`init --scan`), creates the root
  AGENTS.md contract, generates every missing per-boundary contract
  from the codebase, declares discovered dependencies, writes
  `ACC_WARN.md`, and reports remaining fill work. Additive, deterministic,
  idempotent.
- **CLI vs engine tier separation in `acc tools`** — the capability
  manifest now exposes explicit `tiers` (`cli` deterministic/offline/no
  API key; `engine` intelligence) and per-command
  `{ tier, deterministic, requires_api_key, capabilities }` metadata,
  so external agents can filter by tier before calling. The engine tier
  is `ai` (offline provider control), `engine` (sync) and `review`
  (  on-demand compliance scoring); `battle`/ABA is listed under its own
  `launcher` tier (a separate product, never part of the ACC capability
  surface). Enforced by tests: every registered command must appear with
  the right tier, CLI commands must not load the AI SDK or make network
  calls, and bad args always exit 2.
- **`npm run test:metrics`** — one command runs every suite and prints a
  formatted report (per-suite pass/fail/skip/time, tier coverage, pass
  rate, verdict); `--json` and `--quiet` modes.
- **Edge-case hardening** — `acc discover --kind nonsense` now exits 2
  (usage error) instead of silently ignoring the invalid kind; new edge
  tests cover bad args across all commands, empty-repo reads, and
  engine-without-key degradation.
- **Engine trigger (token protection)** — `engine.trigger` in config
  gates the AI phase: `mode: commits` (default) counts git commits since
  the last triggered run by reading the reflog as plain files; `mode:
  changes` keeps a content-hash snapshot and counts changed files;
  `mode: always` never waits. Default threshold: 3. Baseline state lives
  in the gitignored `.acc/state/engine.json`; `--force` bypasses.
- **AI SDK v5 provider wiring fix** — provider-level settings
  (`apiKey`/`baseURL`) are passed to the `create*` factories
  (`createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`), and
  OpenAI-compatible custom endpoints (`base_url` set) use the
  `/chat/completions` model instead of the responses API.
- **`acc discover --apply` idempotency + safety** — dependencies are never
  appended twice, and the remove helper is line-precise (it previously
  could glue headings together and drop more lines than intended).
- **Live provider tests** — `test/engine.live.test.js` runs the engine
  AI phase against real providers (NVIDIA NIM, Gemini, OpenRouter free
  tier) gated on `TEST_*_KEY` env vars; skipped by default so the suite
  stays offline.
- **Determinism battery** — `test/determinism.test.js` runs every
  read-only command twice in fresh processes and requires byte-identical
  output (the guarantee agents build on). Fixed the one violation found:
  `acc tools` now sorts plugin directories and `package.json` script
  names instead of trusting `readdir`/key order.
- **Dogfooded `.acc` example updated** — the repository's own
  `.acc/config/config.yaml` (the living example) now shows the `engine:`
  section (trigger mode/threshold + supervisor threshold/iterations) and
  the `ai:` section (AI SDK v5 providers incl. OpenAI-compatible
  `base_url` gateways like NVIDIA/OpenRouter). `acc init`'s config
  template (lib/templates.js) mirrors the engine block. Config loader
  hardened: bare/empty list keys (all items commented, e.g. `providers:`)
  no longer replace the `[]` defaults; regression-tested.
- **Config = the full control plane** — every knob in `.acc/config/config.yaml`
  is now wired into the commands that should honor it (deterministic and
  intelligence tiers alike):
  - `discover.default_kinds` → default suggestion kinds for `acc discover`
    (`--kind` still overrides).
  - `memory.warn_bytes` → `ACC054` in `acc check` + a warning from
    `acc memory add` when a memory file exceeds the threshold;
    `memory.timestamp_format` (`rfc3339` | `date`) → memory entry
    timestamps.
  - `forbidden_deps` → implemented end-to-end: `ACC024` (error, an edge
    under both prefixes), `ACC025` (warn, inert rule whose paths exist
    but never match), `ACC065` (warn, rule naming a missing path).
  - `ownership.strict` → `ACC030` fail-fast (stop at the first conflict)
    vs collect-all.
  - `context.default_include` → default `acc context` sections
    (`--include`/`--exclude` still win).
  - `tools.auto_discover` and `tools.plugins.{enabled,directory}` → gate
    the `acc tools` detected/plugin listings.
  The example config restores the `memory:`, `discover:` and
  `forbidden_deps:` sections; `test/config-control.test.js` locks every
  knob in.
- **Knowledge-graph index** — the derived graph is now a typed,
  machine-only index (nodes: boundary/agents/file/test/skill/standard;
  edges: governs/owns/requires/tested_by) with minimal metadata
  (id/type/parent/hash/flags/provenance) and **no prose** — content stays
  in Markdown and is read on demand. The graph is an index of
  relationships, not a knowledge store (`lib/graph.js`).
- **`acc slice <path>`** — the context router: compact AI-optimized
  graph slice (governed_by, owns, depends_on, dependents, tested_by,
  requires, impact budget) for a path, text + JSON.
- **AI configuration (AI SDK v5)** — `.acc/config/config.yaml` `ai:`
  section configures one or more providers (`openai`/`anthropic`/`google`
  or custom package). Offline-first: `ai.enabled` defaults to `false`,
  provider packages load lazily, API keys come from the environment and
  are never stored. New `acc ai` command lists providers and status
  without any network call.
- **YAML parser: sequence-of-mappings items** — the minimal parser now
  supports `- key: value` list items (needed for `ai.providers`).
- **`npm run bump -- <version>`** — single-source version bump: updates
  `package.json`, cuts the CHANGELOG `[Unreleased]` section, and the docs
  site follows automatically (the landing hero and docs footer read the
  version from `package.json` at build time via `__ACC_VERSION__`).
- **Docs deploy hardening** — the Pages workflow now uses `npm ci` with a
  committed `docs/package-lock.json`, and triggers on `package.json` /
  `scripts/**` changes so a version bump redeploys the site.
- **Discovered-reference matcher refinements** — object keys (`{ scripts: … }`)
  and the npm `scripts` field (`package.json scripts`, `npm scripts`) no
  longer count as code references to a `scripts/` boundary.
- **`scripts/` contract** — `scripts/AGENTS.md` for the developer tooling
  boundary (bump script + docs wiring).
- **`acc review [path]`** — on-demand AI compliance review of a scope
  (engine tier): deterministic scan always, then a supervisor-scored
  verdict (0-100, config threshold) with actionable issues. Read-only —
  never writes AGENTS.md, memory, or ACC_WARN.md. The counterpart to the
  token-gated `acc engine` for manual/agent-driven checks.
- **Diagnostic engine completeness** — `acc check` now emits diagnostics
  that were previously registered but unreachable:
  - `ACC022` (discovered dependency not declared) — was missing from
    `acc check` entirely; now diffs declared vs. discovered edges.
  - `ACC031` (unowned dependency target) — was registered but never
    emitted.
  - `ACC050` (orphan `.acc-memory.md`) and `ACC072` (orphaned code) —
    could never fire because the implicit root node covered everything;
    anchoring is now based on actual `AGENTS.md` contracts.
- **Declared edges cover sub-boundaries** — a declared dependency on
  `lib/` now satisfies discovered references to `lib/commands/` when
  diffing `ACC022`.
- **Discovered-edge matcher refinements** — path-like token matching:
  no substring matches inside larger words, no method-call matches
  (a regex `.test(`), no quoted string values, no bracket markers
  (the impact output's `[test]` tag).
- **Comprehensive framework test suite** (`test/framework.test.js`) —
  every command surface and every implemented `ACC0xx` diagnostic is
  exercised end-to-end against the real CLI (37 → 111 tests total).
- **Functionality contracts** — `AGENTS.md` for `bin/`, `lib/`,
  `lib/commands/`, and `test/`; the flagship repo now reports
  "Nothing to build" from `acc build`.
- **Docs** — "Markdown is all you need" page
  (`docs/02-markdown-is-all-you-need.md`), a security-model page
  (`docs/13-security.md`), a friendlier landing, a shared
  markdown-file favicon, and payments-based examples throughout.
- JavaScript language analyzer enabled in the dogfooded config.

### Changed
- **Docs renumbered to match navigation order** — the "Markdown is
  all you need" page moved from `12-` to `02-` and the pages after it
  shifted up, so every spec file's number matches its sidebar position
  (01 → 13). URLs are unchanged (rewrites keep the same slugs).
- **Graph default format is now `json`** — `graph.default_format` in
  `.acc/config/config.yaml` (and the built-in default) changed from
  `text` to `json`, so `acc graph` emits machine-readable JSON out of
  the box; `--format text|mermaid|dot` still render the readable forms.
- **`acc engine --init-context --supervisor`** — the one-shot bootstrap
  now passes the supervisor through, so when AI is enabled the generated
  knowledge is scored against ACC rules before anything is written.

### Fixed
- **Dogfood `acc check` noise** — the repository's own check emitted
  false-positive ACC022s because comments and output strings referenced
  the `docs/`/`test`/`bin` boundaries as bare words (e.g. "docs ahead of
  code", "test metrics", "bin/acc.js"). The wording was adjusted
  (quoted/backticked path tokens, "documentation"/"tests" phrasing) so
  the reference matcher no longer reads English words as dependencies;
  `acc check` on this repo is clean (0 diagnostics).
- **`acc check --severity` filter was inverted** — `--severity warn`
  dropped errors and kept infos; it now keeps error + warn (and
  `--severity error` keeps errors only), per the diagnostics spec.
- **`acc graph --max-depth` was declared but inert** — now limits the
  emitted subgraph; `--nodes --json` also returns no edges.
- **`acc <command> --help` showed top-level help** — command-level
  usage was dead code in the dispatcher; now routed correctly.
- **VitePress build artifacts polluting the graph** — `docs/.vitepress/`
  is now excluded from derivation.

---

## [0.4.0] - 2026-08-15

### Added
- **`acc fill [path]`** — a generic, read-only fill directive for
  completing `AGENTS.md` files. It walks the project, classifies every
  section of every `AGENTS.md` as **missing**, **empty**, or holding
  **template placeholders**, and emits a per-file checklist plus a
  directive a coding agent follows to replace the placeholders with
  accurate content. Companion to `acc build`.

### Fixed
- **Project-root detection escape** — `detectProjectRoot` no longer
  resolves to (or above) the user's home directory. A stray marker in
  the home dir (e.g. `~/package.json`) previously made the **entire
  home tree** the project root for any repository run in a nested
  sandbox, causing `acc build`/`acc graph` to walk caches,
  `node_modules`, and browser profiles for minutes. Root detection now
  stops at the home boundary and falls back to the current directory.

---

## [0.3.0] - 2026-08-15

### Added
- **`acc build [path]`** — create all missing `AGENTS.md` contract files
  in a project (dry-run by default; `--yes` writes, `--from-discovery`
  pre-fills inferred dependencies/owners). A project is "fully
  documented" when `acc build` has nothing left to create.
- **`acc init` scan-and-prepare prompt** — in an interactive terminal,
  init now asks whether to scan the codebase and prepare the project;
  confirmed answers (or `--scan`) run the diagnostics scan (`acc check`)
  and create the missing contract files. `--no-scan` and non-interactive
  runs (CI, piped stdin) never scan, keeping init deterministic and safe
  on untrusted repositories.
- **Memory provenance** —
  - `acc init` creates the root `.acc-memory.md` initial record (when
    missing) seeded with the project's clone date (from `.git`, reflog
    first entry or filesystem birthtime) and, when the origin is GitHub,
    the owner/repo and default branch. All reads are pure filesystem —
    no git binary is ever executed.
  - `acc build --yes` creates an initial `.acc-memory.md` record
    alongside every `AGENTS.md` contract it creates.

---

## [0.2.0] - 2026-08-15

### Added
- **Reference `acc` CLI** (zero runtime dependencies, offline,
  deterministic) in `bin/acc.js` + `lib/`: `init`, `check`, `inspect`,
  `context`, `graph`, `dependencies`, `dependents`, `impact`, `search`,
  `discover`, `document`, `build`, `fill`, `memory`, `tools`.
- **Documentation site (VitePress)** built directly from `docs/` — the
  numbered spec files are the site's pages; no separate content copy.
- **ABA as a standalone project** — its own repository and npm package
  (`acc-battle-arena`); the `aba/` directory is a self-contained git
  repo, never pushed with ACC; `acc-code-context` depends on the package so
  `acc battle` works out of the box. Runs without Docker (isolated
  snapshot copy; container when available, host otherwise); spawns a
  Vite web app (battle arena) by default with per-panel
  provider/model, live streaming, metric pills, blind mode, and
  `--headless` terminal flow.

### Changed
- Published to npm as `acc-code-context` (renamed from `agents-code-context`).
- CI rewritten for the Node CLI: tests, dogfood, determinism, schema
  validation, docs build, hard-invariant check; GitHub Pages deploy for
  the docs site.
- `CONTRIBUTING.md` rewritten for the Node CLI project; `SECURITY.md`
  corrected to the implemented diagnostic codes.
- agents.md compliance: ACC is a strict superset of the AGENTS.md
  standard; control plane lives in `.acc/config/`.

### Removed
- Dead code (`aba/models.cjs`, broken `aba/bin/aba.js` stub, duplicated
  helpers), fictional Rust/analyzer CI, release, and dependabot
  configurations, tracked junk (`.DS_Store`, legacy `site/` landing,
  committed VitePress cache and generated pages), empty placeholder
  directories under `aba/`.

---

## [0.1.0] - 2026-08-15

### Added
- First stable release of the ACC specification:
  - Core philosophy: agent-agnostic, filesystem-first, offline;
    hard invariant — removing `.acc/` leaves a valid agents.md repo.
  - Architecture graph derivation (declared/discovered/inferred) with
    provenance everywhere.
  - Stable `ACC0xx` diagnostic codes with a stability contract.
  - Deterministic JSON output with `schema_version`.
  - Progressive context engine with provenance and budget caps.
  - Memory semantics (`.acc-memory.md` files).
  - `AGENTS.md` authoring guide.
  - Control plane: `.acc/config/config.yaml`, agents, workflows,
    standards.
  - Multi-agent orchestration specification (optional, config-gated).
- MIT license (same as the agents.md standard).
