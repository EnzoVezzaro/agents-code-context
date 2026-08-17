/**
 * `acc install` — deploy ACC as an agent skill.
 *
 * ACC is an agent capability, not a per-repository framework. This
 * command writes the ACC SKILL.md into a target directory so any agent
 * (Claude Code, Cursor, Codex, OpenCode, Gemini CLI, VS Code agents, or
 * a generic Agent-Skills environment) learns how to operate on the
 * repository deterministically.
 *
 * Deterministic and offline: writes a fixed SKILL.md, never executes
 * anything, never touches the network. Idempotent: an existing SKILL.md
 * is left untouched unless --force.
 *
 * Targets:
 *   - default (or --agent generic): <project>/.agents/skills/acc/
 *     (the Agent Skills standard location the graph also detects).
 *   - --agent <name>: a well-known project-local dir per agent
 *     (.claude/skills/acc, .cursor/skills/acc, ...).
 *   - --dir <path>: an explicit path (absolute or relative to the
 *     project root) — e.g. a global agent skills directory.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { AGENTS, skillMd, skillReferences, skillReferenceContent, skillReadme, skillAgents, skillAgentContent } = require('../core/skill');
// Read directly from package.json — requiring bin/acc here would be a
// circular dependency (bin/acc requires the command modules).
const VERSION = require('../../package.json').version;

module.exports = {
  name: 'install',
  summary: 'Install the ACC skill into an agent environment',
  usage: 'acc install [--agent generic|claude|cursor|codex|opencode|gemini|vscode] [--dir <path>] [--force] [--json]',
  booleans: ['--force', '--json'],
  flags: { '--agent': { type: 'string' }, '--dir': { type: 'string' } },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 0) return { error: 'too many arguments', exit: 2 };
    if (values['--agent'] && values['--dir']) {
      return { error: '--agent and --dir are mutually exclusive', exit: 2 };
    }

    const agent = values['--agent'] || 'generic';
    if (!AGENTS[agent]) {
      return { error: `unknown agent: ${agent} (expected ${Object.keys(AGENTS).join('|')})`, exit: 2 };
    }

    // Resolve the target directory.
    let targetDir;
    if (values['--dir']) {
      targetDir = path.resolve(ctx.root, values['--dir']);
    } else {
      targetDir = path.join(ctx.root, AGENTS[agent].dir);
    }

    const target = path.join(targetDir, 'SKILL.md');
    const content = skillMd(VERSION);

    if (fs.existsSync(target) && !values['--force']) {
      const result = {
        installed: false,
        existed: true,
        file: path.relative(ctx.root, target).split(path.sep).join('/'),
        agent,
        note: 'SKILL.md already present — use --force to overwrite',
      };
      if (ctx.opts.json) return { result };
      return { text: `ACC skill already installed at ${result.file} (use --force to overwrite)\n` };
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(target, content);

    // Copy the canonical references/ + README.md alongside the skill
    // (single source shared with `npx skills add
    // EnzoVezzaro/agents-code-context`).
    const references = [];
    const refsDir = path.join(targetDir, 'references');
    for (const name of skillReferences()) {
      const body = skillReferenceContent(name);
      if (body === null) continue;
      fs.mkdirSync(refsDir, { recursive: true });
      fs.writeFileSync(path.join(refsDir, name), body);
      references.push(`references/${name}`);
    }
    const readme = skillReadme();
    if (readme !== null) {
      fs.writeFileSync(path.join(targetDir, 'README.md'), readme);
      references.push('README.md');
    }
    // Copy the optional role sub-agents alongside the skill.
    const agents = [];
    const agentsDir = path.join(targetDir, 'agents');
    for (const name of skillAgents()) {
      const body = skillAgentContent(name);
      if (body === null) continue;
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, name), body);
      agents.push(`agents/${name}`);
    }

    const result = {
      installed: true,
      existed: false,
      file: path.relative(ctx.root, target).split(path.sep).join('/'),
      references,
      agents,
      agent,
      version: VERSION,
      note: AGENTS[agent].note,
    };
    if (ctx.opts.json) return { result };
    const refLine = references.length ? ` (${references.length} reference(s))` : '';
    const agentLine = agents.length ? ` (${agents.length} role agent(s))` : '';
    return {
      text:
        `Installed the ACC skill (v${VERSION}) at ${result.file}${refLine}${agentLine}\n` +
        `Target: ${AGENTS[agent].note}. Every agent with Agent Skills support can now load it.\n` +
        `Universal install: npx skills add EnzoVezzaro/agents-code-context --skill acc${agent !== 'generic' ? ` --agent ${agent}` : ''}\n`,
    };
  },
};
