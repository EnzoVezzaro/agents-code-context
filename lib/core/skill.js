/**
 * ACC as an installable agent skill.
 *
 * ACC is deployed into an agent's skill environment, not forced onto a
 * repository. The repository stays a standard agents.md repository
 * (`AGENTS.md` + source); the skill teaches any agent how to operate on
 * it deterministically.
 *
 * The canonical skill lives at `skills/acc/SKILL.md` in this repository
 * — the same file that `npx skills add EnzoVezzaro/agents-code-context
 * --skill acc` publishes. `acc install` reads that canonical file (plus
 * its `references/`) and copies it to the chosen target, so the CLI
 * path and the `npx skills` path always distribute the exact same
 * skill. This file keeps the targets table and the loader only.
 *
 * The skill encodes the engine contract:
 *   - Engine ON  → the always-on AI engine (`acc engine --watch`)
 *     maintains the ACC files automatically; the coding agent ignores
 *     them and just codes.
 *   - Engine OFF → the coding agent is exclusively responsible for
 *     keeping the ACC files in sync (contracts, memory, diagnostics)
 *     and follows the ACC workflow.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Known per-agent install targets (project-local, deterministic). */
const AGENTS = {
  generic: { dir: '.agents/skills/acc', note: 'Agent Skills standard — portable across agents' },
  claude: { dir: '.claude/skills/acc', note: 'Claude Code project skills' },
  cursor: { dir: '.cursor/skills/acc', note: 'Cursor rules/skills' },
  codex: { dir: '.codex/skills/acc', note: 'Codex CLI skills' },
  opencode: { dir: '.opencode/skills/acc', note: 'opencode skills' },
  gemini: { dir: '.gemini/skills/acc', note: 'Gemini CLI skills' },
  vscode: { dir: '.vscode/skills/acc', note: 'VS Code agent skills' },
};

/** Canonical skill directory (published via npx skills too). */
const SKILL_DIR = path.join(__dirname, '..', '..', 'skills', 'acc');

/** Read the canonical SKILL.md (fallback: embedded template). */
function skillMd(version) {
  const file = path.join(SKILL_DIR, 'SKILL.md');
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, 'utf8').replace(/__ACC_VERSION__/g, version || '');
  }
  // Fallback template — kept in sync with skills/acc/SKILL.md.
  return `---
name: acc
description: >-
  Agent Code Context. Keeps this repository's agent context (AGENTS.md
  contracts, derived graph, memory, diagnostics) accurate and in sync
  with the code. Deterministic commands for context, impact, search and
  validation; an optional always-on AI engine maintains the ACC files
  automatically. Use whenever the repository uses AGENTS.md.
license: MIT
---

# ACC — Agent Code Context

ACC is a deterministic toolkit plus an optional always-on AI engine that
make a repository continuously understandable by agents. It installs as
a skill; the \`acc\` CLI is the deterministic surface that any agent or
developer can run against the repository. The repository itself stays
standard — \`AGENTS.md\` + source code.

## How to use ACC

1. Run \`acc tools\` to list the full capability manifest.
2. Every command is deterministic: same repo + same flags = same output.
3. Prefer ACC over blind exploration: \`acc context\`, \`acc graph\`,
   \`acc slice\` and \`acc impact\` tell you what is related before you
   read large amounts of source.

## The contract — who maintains the ACC files

- **Engine ON** (recommended): \`acc engine --watch\` maintains the ACC
  files automatically — ignore them and just code; read \`ACC_WARN.md\`
  before finishing.
- **Engine OFF**: the coding agent is exclusively responsible for
  keeping the ACC files in sync (see the workflows in
  skills/acc/SKILL.md).

## Commands

Run \`acc tools\` for the authoritative manifest: \`cli\` (deterministic,
offline, no API key) and \`engine\` (intelligence subsystem).
`;
}

/** List the canonical skill's reference files (for --dir installs). */
function skillReferences() {
  const dir = path.join(SKILL_DIR, 'references');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
}

/** Read the canonical skill's README.md, if present (installed too). */
function skillReadme() {
  const file = path.join(SKILL_DIR, 'README.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** List the canonical skill's agent files (optional role sub-agents). */
function skillAgents() {
  const dir = path.join(SKILL_DIR, 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
}

/** Read a canonical agent file's content. */
function skillAgentContent(name) {
  const file = path.join(SKILL_DIR, 'agents', name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** Read a canonical reference file's content. */
function skillReferenceContent(name) {
  const file = path.join(SKILL_DIR, 'references', name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

module.exports = { AGENTS, skillMd, skillReferences, skillReferenceContent, skillReadme, skillAgents, skillAgentContent, SKILL_DIR };
