/**
 * `acc tools` — list the deterministic core tools and project-detected
 * capabilities (docs/11). V1 exposes the capability listing; execution
 * commands (`acc tool`, `acc shell`) are documented as future work.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CORE = [
  { name: 'filesystem', capabilities: ['read', 'write', 'glob'] },
  { name: 'search', capabilities: ['contracts', 'edges', 'code'] },
  { name: 'context', capabilities: ['progressive_depth', 'provenance'] },
  { name: 'graph', capabilities: ['text', 'mermaid', 'dot', 'json'] },
  { name: 'check', capabilities: ['diagnostics', 'severity_filter'] },
  { name: 'memory', capabilities: ['read', 'write'] },
  { name: 'inspect', capabilities: ['roles', 'owners', 'dependencies'] },
  { name: 'impact', capabilities: ['dependents', 'tests', 'constraints'] },
];

module.exports = {
  name: 'tools',
  summary: 'List available tools and capabilities',
  usage: 'acc tools [--json] [--category core|detected|plugins|all]',
  booleans: ['--json'],
  flags: { '--category': { type: 'string' } },

  run(argv, ctx) {
    const { values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    const category = values['--category'] || 'all';
    if (!['core', 'detected', 'plugins', 'all'].includes(category)) {
      return { error: `invalid category: ${category}`, exit: 2 };
    }

    // Detected project tools from package.json scripts (offline, read-only).
    const detected = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ctx.root, 'package.json'), 'utf8'));
      if (pkg.scripts) {
        for (const [name, cmd] of Object.entries(pkg.scripts)) {
          detected.push({ name, command: cmd, source: 'package.json scripts' });
        }
      }
    } catch {
      /* no package.json — fine */
    }

    // Plugins from .acc/config/tools (declared but not executed).
    const plugins = [];
    const toolsDir = path.join(ctx.root, '.acc', 'config', 'tools');
    if (fs.existsSync(toolsDir)) {
      for (const entry of fs.readdirSync(toolsDir)) {
        if (fs.statSync(path.join(toolsDir, entry)).isDirectory()) {
          plugins.push({ name: entry, path: `.acc/config/tools/${entry}` });
        }
      }
    }

    const result = {
      core: CORE,
      detected,
      plugins,
      note: 'V1 lists capabilities only. acc tool / acc shell execution is documented as future work (docs/11-tooling.md).',
    };

    if (ctx.opts.json) return { result };

    const lines = ['Core tools'];
    if (category === 'core' || category === 'all') {
      for (const t of CORE) lines.push(`  ✓ ${t.name} (${t.capabilities.join(', ')})`);
    }
    if ((category === 'detected' || category === 'all') && detected.length) {
      lines.push('');
      lines.push('Detected project tools');
      for (const t of detected) lines.push(`  ✓ ${t.name} — ${t.command}`);
    }
    if ((category === 'plugins' || category === 'all') && plugins.length) {
      lines.push('');
      lines.push('Plugins');
      for (const t of plugins) lines.push(`  ○ ${t.name}`);
    }
    return { text: lines.join('\n') + '\n' };
  },
};
