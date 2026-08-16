/**
 * `acc build [path]` — create the documentation files missing from a project.
 *
 * Scans the codebase for directories that contain source code but no
 * AGENTS.md contract and generates conservative AGENTS.md templates for
 * them, plus an initial `.acc-memory.md` record for each. Dry-run by
 * default; `--yes` creates the files. An optional `path` scopes the scan
 * to a subtree. Additive only: never rewrites existing AGENTS.md or
 * `.acc-memory.md` files (see the CLI command spec).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph, SOURCE_EXTS } = require('../graph');
const { agentsMdTemplate } = require('../templates');
const memory = require('../memory');
const { walkFiles, dirOf, cmp } = require('../util');

const VERSION = require('../../package.json').version;

module.exports = {
  name: 'build',
  summary: 'Create missing AGENTS.md contract files for undocumented code',
  usage: 'acc build [path] [--yes] [--from-discovery] [--json]',
  booleans: ['--yes', '--from-discovery', '--json'],
  flags: {},

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const scope = positionals[0] ? positionals[0].replace(/\/+$/, '') : null;
    const graph = buildGraph(ctx.root, ctx.config);
    const files = walkFiles(ctx.root, ctx.root, ctx.config.ignore || [], []);

    const srcDirs = new Set();
    for (const rel of files) {
      if (SOURCE_EXTS.has(path.posix.extname(rel))) srcDirs.add(dirOf(rel));
    }

    const missing = [];
    for (const dir of srcDirs) {
      if (scope && dir !== '' && dir !== scope && !dir.startsWith(scope + '/')) continue;
      if (graph.boundaries.includes(dir)) continue;
      let covered = false;
      let d = dir;
      while (d.includes('/')) {
        d = d.slice(0, d.lastIndexOf('/'));
        if (graph.boundaries.includes(d)) { covered = true; break; }
      }
      if (covered) continue;
      missing.push(dir || '.');
    }
    missing.sort(cmp);

    const plan = missing.map((dir) => {
      let inferred = { dependencies: [], owners: [] };
      if (values['--from-discovery']) {
        const node = graph.nodes.find((n) => n.id === dir);
        if (node) {
          const depEdges = graph.edges.filter(
            (e) => e.from === dir && e.kind === 'dependency' && e.provenance.kind === 'discovered',
          );
          inferred.dependencies = [...new Set(depEdges.map((e) => e.to))].sort(cmp);
          inferred.owners = [...new Set(depEdges.map((e) => e.provenance.source))].sort(cmp).slice(0, 1);
        }
      }
      const name = dir === '.' ? path.basename(ctx.root) : path.posix.basename(dir);
      const abs = dir === '.' ? ctx.root : path.resolve(ctx.root, dir);
      return {
        dir,
        file: path.join(abs, 'AGENTS.md'),
        name,
        template: agentsMdTemplate(name, inferred),
      };
    });

    const create = !!values['--yes'];
    const created = [];
    const memoryCreated = [];
    if (create) {
      for (const item of plan) {
        if (fs.existsSync(item.file)) continue;
        fs.mkdirSync(path.dirname(item.file), { recursive: true });
        fs.writeFileSync(item.file, item.template);
        created.push(item.dir);
        const record = memory.initialRecordText({ tool: 'acc build', version: VERSION, subject: 'this functionality' });
        const mem = memory.init(ctx.root, item.dir, record);
        if (mem.action === 'created') memoryCreated.push(item.dir);
      }
    }

    const result = {
      scope: scope || null,
      missing: plan.map((p) => p.dir),
      created,
      memory_created: memoryCreated,
      dry_run: !create,
    };

    if (ctx.opts.json) return { result };
    if (ctx.opts.quiet) return { result };

    const lines = [];
    if (create) {
      for (const c of created) lines.push(`Created ${c === '' ? 'AGENTS.md' : `${c}/AGENTS.md`}`);
      if (created.length) {
        lines.push(
          `Created ${memoryCreated.length} .acc-memory.md initial record${memoryCreated.length === 1 ? '' : 's'}:`,
        );
        for (const c of memoryCreated) lines.push(`  ${c === '' ? '.acc-memory.md' : `${c}/.acc-memory.md`}`);
      }
      if (!created.length) lines.push('Nothing to build — every code directory already has an AGENTS.md contract.');
    } else {
      for (const p of plan) lines.push(`[missing] ${p.dir === '' ? 'AGENTS.md' : `${p.dir}/AGENTS.md`}`);
      if (!plan.length) {
        lines.push('Nothing to build — every code directory already has an AGENTS.md contract.');
      } else {
        lines.push('');
        lines.push(`Run with --yes to create ${plan.length} file${plan.length === 1 ? '' : 's'}.`);
      }
    }
    return { result, text: lines.join('\n') + '\n' };
  },
};
