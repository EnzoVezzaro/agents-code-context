/**
 * `acc init` — convert a repository into an ACC-enhanced one.
 *
 * Only adds files; never deletes or rewrites existing content. Preserves
 * any existing AGENTS.md, .agents/ and .gitignore content (docs/04).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveRoot } = require('../config');
const { agentsMdTemplate, configYaml } = require('../templates');

module.exports = {
  name: 'init',
  summary: 'Initialize ACC structure in a directory',
  usage: 'acc init [directory] [--force]',
  booleans: ['--force'],
  flags: {},

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const root = resolveRoot(ctx.rootFlag || positionals[0]);
    const accDir = path.join(root, '.acc', 'config');
    const configFile = path.join(accDir, 'config.yaml');

    const created = [];
    const existing = [];
    let gitignoreUpdated = false;

    // 1. Scaffold .acc/config/ (config.yaml + agents/workflows/standards).
    if (fs.existsSync(configFile) && !values['--force']) {
      existing.push('.acc/config/config.yaml');
    } else if (fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, configYaml(path.basename(root)));
      created.push('.acc/config/config.yaml');
    } else {
      fs.mkdirSync(accDir, { recursive: true });
      fs.writeFileSync(configFile, configYaml(path.basename(root)));
      created.push('.acc/config/config.yaml');
    }
    for (const sub of ['agents', 'workflows', 'standards']) {
      const dir = path.join(accDir, sub);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        created.push(`.acc/config/${sub}/`);
      } else {
        existing.push(`.acc/config/${sub}/`);
      }
    }

    // 2. Ensure .gitignore excludes .acc-memory.md (append if missing).
    const gitignorePath = path.join(root, '.gitignore');
    let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (!/\.acc-memory\.md/.test(gitignore)) {
      const addition = `${gitignore.endsWith('\n') || gitignore === '' ? '' : '\n'}.acc-memory.md\n`;
      fs.writeFileSync(gitignorePath, gitignore + addition);
      gitignoreUpdated = true;
    }

    // 3. Print an AGENTS.md template to stdout if none exists (never writes).
    const agentsPath = path.join(root, 'AGENTS.md');
    let agentsMdTemplatePrinted = false;
    if (!fs.existsSync(agentsPath)) {
      agentsMdTemplatePrinted = true;
    }

    const result = {
      root,
      created: created.sort(),
      existing: existing.sort(),
      gitignore_updated: gitignoreUpdated,
      agents_md_template_printed: agentsMdTemplatePrinted,
    };

    if (ctx.opts.json) return { result };
    if (ctx.opts.quiet) return { result };

    const lines = [];
    for (const c of created) lines.push(`Created ${c}`);
    for (const e of existing) lines.push(`Exists  ${e}`);
    if (gitignoreUpdated) lines.push('Updated .gitignore (added .acc-memory.md)');
    if (agentsMdTemplatePrinted) {
      lines.push('');
      lines.push('No AGENTS.md found at root — printed template to stdout. Review and commit:');
      lines.push('');
      lines.push(agentsMdTemplate(path.basename(root)));
    }
    return { text: lines.join('\n') + '\n' };
  },
};
