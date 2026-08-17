/**
 * `acc inspect <path>` — roles, owners, dependencies, constraints, memory
 * for a path, resolved to its nearest functionality boundary.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('../core/graph');
const { parse } = require('../core/agents');
const { readUtf8, relPath } = require('../core/util');
const memory = require('../core/memory');

module.exports = {
  name: 'inspect',
  summary: 'Inspect roles, owners, dependencies, constraints, memory for a path',
  usage: 'acc inspect <path> [--with-memory] [--json]',
  booleans: ['--with-memory'],
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

    // Resolve to nearest functionality boundary.
    let resolved = null;
    const rel = relPath(ctx.root, abs);
    const dir = rel === '' ? '.' : rel;
    let d = dir;
    for (;;) {
      const hit = graph.nodes.find((n) => n.path === d || (d === '.' && n.id === ''));
      if (hit) { resolved = hit; break; }
      if (d === '.' || d === '') break;
      d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '.';
    }
    if (!resolved) {
      resolved = graph.nodes.find((n) => n.id === '');
    }

    // Local contract contents.
    let contract = null;
    let parsed = null;
    if (resolved.id !== '' && fs.existsSync(path.join(ctx.root, resolved.id, 'AGENTS.md'))) {
      contract = path.posix.join(resolved.id, 'AGENTS.md');
      parsed = parse(readUtf8(path.join(ctx.root, resolved.id, 'AGENTS.md')) || '');
    } else if (resolved.id === '' && fs.existsSync(path.join(ctx.root, 'AGENTS.md'))) {
      contract = 'AGENTS.md';
      parsed = parse(readUtf8(path.join(ctx.root, 'AGENTS.md')) || '');
    }

    const declaredDeps = graph.edges
      .filter((e) => e.from === resolved.id && e.kind === 'dependency' && e.provenance.kind === 'declared')
      .map((e) => e.to);
    const discoveredDeps = graph.edges
      .filter((e) => e.from === resolved.id && e.kind === 'dependency' && e.provenance.kind === 'discovered')
      .map((e) => e.to);

    const mem = memory.show(ctx.root, resolved.id === '' ? '' : resolved.id);
    const memResult = {
      exists: mem.exists,
      path: mem.exists ? mem.file : null,
      contents: values['--with-memory'] ? mem.contents : null,
    };

    const result = {
      path: target,
      functionality: {
        id: resolved.id === '' ? '.' : resolved.id,
        has_local_contract: !!contract,
        owners: resolved.owners,
      },
      roles: [],
      owners: resolved.owners,
      dependencies_declared: [...new Set(declaredDeps)],
      dependencies_discovered: [...new Set(discoveredDeps)],
      constraints: parsed ? parsed.sections.Constraints || [] : [],
      memory: memResult,
      local_contract_source: contract,
    };

    if (ctx.opts.json) return { result };

    const lines = [];
    lines.push(`Path: ${target}`);
    lines.push(`Functionality: ${result.functionality.id}${contract ? ' (has local contract)' : ' (no local contract)'}`);
    if (result.owners.length) lines.push(`Owners: [${result.owners.join(', ')}]`);
    if (result.dependencies_declared.length) lines.push(`Dependencies (declared): ${result.dependencies_declared.join(', ')}`);
    if (result.dependencies_discovered.length) {
      const extra = result.dependencies_discovered.filter((d) => !result.dependencies_declared.includes(d));
      if (extra.length) lines.push(`Dependencies (discovered, undeclared): ${extra.join(', ')}`);
    }
    if (parsed && parsed.sections.Constraints) {
      lines.push('Constraints:');
      for (const c of parsed.sections.Constraints.split(/\r?\n/)) {
        if (c.trim()) lines.push(`  - ${c.trim()}`);
      }
    }
    lines.push(`Memory: ${mem.exists ? `exists at ${mem.file}` : 'not present'}`);
    lines.push(`Local contract: ${contract || 'none'}`);
    return { text: lines.join('\n') + '\n' };
  },
};
