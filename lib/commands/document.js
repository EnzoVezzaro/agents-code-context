/**
 * `acc document <path>` — generate a conservative AGENTS.md template
 * (per the CLI command spec). Dry-run by default; --apply writes the file.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('../graph');
const { agentsMdTemplate } = require('../templates');

module.exports = {
  name: 'document',
  summary: 'Generate a conservative AGENTS.md template for a directory',
  usage: 'acc document <path> [--apply] [--force] [--from-discovery] [--json]',
  booleans: ['--apply', '--force', '--from-discovery', '--json'],
  flags: {},

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one path', exit: 2 };

    const dir = positionals[0].replace(/\/+$/, '');
    const targetDir = path.resolve(ctx.root, dir);
    const targetFile = path.join(targetDir, 'AGENTS.md');

    if (!fs.existsSync(targetDir)) {
      return { error: `directory does not exist: ${positionals[0]}`, exit: 2 };
    }
    if (fs.existsSync(targetFile) && values['--apply'] && !values['--force']) {
      return { error: `${dir}/AGENTS.md already exists (use --force to overwrite)`, exit: 1 };
    }

    let inferred = { dependencies: [], owners: [] };
    if (values['--from-discovery']) {
      const graph = buildGraph(ctx.root, ctx.config);
      const node = graph.nodes.find((n) => n.id === dir);
      if (node) {
        const depEdges = graph.edges.filter((e) => e.from === dir && e.kind === 'dependency' && e.provenance.kind === 'discovered');
        inferred.dependencies = [...new Set(depEdges.map((e) => e.to))];
        inferred.owners = [...new Set(depEdges.map((e) => e.provenance.source))].slice(0, 1);
      }
    }

    const template = agentsMdTemplate(path.posix.basename(dir) || dir, inferred);
    const applied = values['--apply'];
    if (applied) {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(targetFile, template);
    }

    const result = {
      path: dir,
      exists: fs.existsSync(targetFile),
      template,
      inferred_fields: values['--from-discovery'] ? inferred : {},
      applied,
    };

    if (ctx.opts.json) return { result };
    if (ctx.opts.quiet) return { result };
    if (applied) {
      return { text: `Wrote ${dir}/AGENTS.md\n` };
    }
    return { text: template };
  },
};
