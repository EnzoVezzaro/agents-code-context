/**
 * `acc slice <path>` — the context router.
 *
 * The graph is an index of relationships, not a knowledge store, and it
 * is queried, not read. `acc slice` returns the compact, AI-optimized
 * slice for a path: what governs it, what it owns, what it depends on,
 * what depends on it, what tests it, what skills/standards apply, and
 * the impact budget (files/boundaries/tests/contracts) — never the
 * whole repository.
 *
 * Content (prose, contracts, memory) is NOT included here: the slice
 * points at the filesystem, and `acc context` assembles the readable
 * context on demand.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph, graphSlice } = require('../core/graph');
const { relPath } = require('../core/util');

module.exports = {
  name: 'slice',
  summary: 'Compact AI-optimized graph slice for a path (context router)',
  usage: 'acc slice <path> [--json]',
  booleans: ['--json'],
  flags: {},

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one path', exit: 2 };

    const target = positionals[0];
    const abs = path.resolve(ctx.root, target);
    if (!fs.existsSync(abs)) {
      return { error: `path does not exist: ${target}`, exit: 2 };
    }

    const graph = buildGraph(ctx.root, ctx.config);
    const rel = relPath(ctx.root, abs);
    const slice = graphSlice(graph, rel === '' ? '.' : rel);

    if (ctx.opts.json) return { result: slice };

    const lines = [];
    lines.push(`SCOPE: ${slice.scope}`);
    if (slice.governed_by.length) {
      lines.push('GOVERNED_BY:');
      for (const g of slice.governed_by) lines.push(`  ${g}`);
    }
    if (slice.owns.files.length) {
      lines.push('OWNS (files):');
      for (const f of slice.owns.files) lines.push(`  ${f}`);
    }
    if (slice.owns.tests.length) {
      lines.push('OWNS (tests):');
      for (const t of slice.owns.tests) lines.push(`  ${t}`);
    }
    if (slice.depends_on.length) {
      lines.push('DEPENDS_ON:');
      for (const d of slice.depends_on) lines.push(`  ${d.to} (${d.provenance_kind})`);
    }
    if (slice.dependents.length) {
      lines.push('DEPENDENTS:');
      for (const d of slice.dependents) lines.push(`  ${d.from} (${d.provenance_kind})`);
    }
    if (slice.tested_by.length) {
      lines.push('TESTED_BY:');
      for (const t of slice.tested_by) lines.push(`  ${t}`);
    }
    if (slice.requires.skills.length) {
      lines.push('SKILLS:');
      for (const s of slice.requires.skills) lines.push(`  ${s}`);
    }
    if (slice.requires.standards.length) {
      lines.push('STANDARDS:');
      for (const s of slice.requires.standards) lines.push(`  ${s}`);
    }
    const imp = slice.impact;
    lines.push(
      `IMPACT: ${imp.files} file${imp.files === 1 ? '' : 's'}, ${imp.boundaries} boundar${imp.boundaries === 1 ? 'y' : 'ies'}, ` +
        `${imp.tests} spec${imp.tests === 1 ? '' : 's'}, ${imp.contracts} contract${imp.contracts === 1 ? '' : 's'}`,
    );
    return { text: lines.join('\n') + '\n' };
  },
};
