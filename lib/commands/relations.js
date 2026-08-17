/**
 * `acc dependencies <path>`, `acc dependents <path>`, `acc impact <path>` —
 * relationship traversal and blast-radius analysis.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('../core/graph');
const { parse } = require('../core/agents');
const { readUtf8 } = require('../core/util');

function resolveNode(graph, target) {
  const clean = target.replace(/\/+$/, '');
  return graph.nodes.find((n) => n.id === clean || (n.id === '' && (target === '.' || target === ''))) || null;
}

function sharedSpec(name, summary, usage) {
  return {
    name,
    summary,
    usage,
    booleans: ['--direct', '--transitive', '--declared', '--discovered', '--json'],
    flags: { '--max-depth': { type: 'number' } },
  };
}

const depsCmd = {
  ...sharedSpec(
    'dependencies',
    'List what a path depends on (declared vs discovered)',
    'acc dependencies <path> [--direct|--transitive] [--max-depth N] [--declared|--discovered] [--json]',
  ),
  run(argv, ctx) {
    return runRelations(argv, ctx, 'dependencies');
  },
};

const dependentsCmd = {
  ...sharedSpec(
    'dependents',
    'List what depends on a path (inverse traversal)',
    'acc dependents <path> [--direct|--transitive] [--max-depth N] [--declared|--discovered] [--json]',
  ),
  run(argv, ctx) {
    return runRelations(argv, ctx, 'dependents');
  },
};

function runRelations(argv, ctx, direction) {
  const { positionals, values, unknown } = argv;
  if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
  if (positionals.length !== 1) return { error: 'expected exactly one path', exit: 2 };
  if (values['--direct'] && values['--transitive']) {
    return { error: '--direct and --transitive are mutually exclusive', exit: 2 };
  }
  if (values['--declared'] && values['--discovered']) {
    return { error: '--declared and --discovered are mutually exclusive', exit: 2 };
  }

  const graph = buildGraph(ctx.root, ctx.config);
  const node = resolveNode(graph, positionals[0]);
  if (!node) return { error: `no functionality boundary at: ${positionals[0]}`, exit: 2 };

  const transitive = !!values['--transitive'];
  const maxDepth = values['--max-depth'] === undefined ? Infinity : values['--max-depth'];
  const provFilter = (e) => {
    if (values['--declared']) return e.provenance.kind === 'declared';
    if (values['--discovered']) return e.provenance.kind === 'discovered';
    return true;
  };

  const edges = [];
  const queue = [{ id: node.id, hop: 0 }];
  const seen = new Set();
  while (queue.length) {
    const cur = queue.shift();
    if (cur.hop > maxDepth) continue;
    const matches = graph.edges.filter((e) => {
      if (direction === 'dependencies') return e.from === cur.id && e.kind === 'dependency';
      return e.to === cur.id && e.kind === 'dependency';
    });
    for (const e of matches) {
      if (!provFilter(e)) continue;
      edges.push({ ...e, hop: cur.hop });
      if (transitive && !seen.has(e.to)) {
        seen.add(e.to);
        queue.push({ id: e.to, hop: cur.hop + 1 });
      }
    }
  }

  edges.sort((a, b) => (a.hop - b.hop) || (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));

  const result = {
    path: positionals[0],
    direction,
    edges: edges.map((e) => ({
      from: e.from === '' ? '.' : e.from,
      to: e.to === '' ? '.' : e.to,
      hop: e.hop,
      provenance: e.provenance,
    })),
  };

  if (ctx.opts.json) return { result };

  const lines = [];
  for (const e of edges) {
    const prov = e.provenance.kind;
    lines.push(`${e.from} → ${e.to}    (${prov}, hop=${e.hop})   Source: ${e.provenance.source}`);
  }
  if (!edges.length) lines.push('(none)');
  return { text: lines.join('\n') + '\n' };
}

const impactCmd = {
  name: 'impact',
  summary: 'Answer "what could break?" — dependents, tests, constraints',
  usage: 'acc impact <path> [--max-depth N] [--include dependents|tests|constraints] [--json]',
  booleans: ['--json'],
  flags: { '--max-depth': { type: 'number' }, '--include': { type: 'string' } },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one path', exit: 2 };

    const graph = buildGraph(ctx.root, ctx.config);
    const node = resolveNode(graph, positionals[0]);
    if (!node) return { error: `no functionality boundary at: ${positionals[0]}`, exit: 2 };

    const maxDepth = values['--max-depth'] === undefined ? 3 : values['--max-depth'];
    const include = values['--include'] ? values['--include'].split(',').map((s) => s.trim()) : ['dependents', 'tests', 'constraints'];

    // Transitive dependents closure.
    const dependents = [];
    const queue = [{ id: node.id, hop: 0 }];
    const seen = new Set([node.id]);
    while (queue.length) {
      const cur = queue.shift();
      if (cur.hop >= maxDepth) continue;
      for (const e of graph.edges) {
        if (e.to === cur.id && e.kind === 'dependency' && !seen.has(e.from)) {
          seen.add(e.from);
          dependents.push({ id: e.from, hop: cur.hop + 1, provenance: e.provenance });
          queue.push({ id: e.from, hop: cur.hop + 1 });
        }
      }
    }
    dependents.sort((a, b) => (a.hop - b.hop) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const isTest = (id) => id.split('/').some((p) => p === 'tests' || p === 'test');
    const affectedTests = dependents.filter((d) => isTest(d.id)).map((d) => d.id);

    // Constraints from affected boundaries.
    const constraints = [];
    if (include.includes('constraints')) {
      for (const d of dependents) {
        const contractPath = d.id === '' ? path.join(ctx.root, 'AGENTS.md') : path.join(ctx.root, d.id, 'AGENTS.md');
        if (!fs.existsSync(contractPath)) continue;
        const parsed = parse(readUtf8(contractPath) || '');
        if (parsed.sections.Constraints) {
          for (const line of parsed.sections.Constraints.split(/\r?\n/)) {
            if (line.trim()) {
              constraints.push({
                text: line.replace(/^[-*•]\s*/, '').trim(),
                source: d.id === '' ? 'AGENTS.md' : path.posix.join(d.id, 'AGENTS.md'),
                provenance: { kind: 'declared', source: d.id === '' ? 'AGENTS.md' : path.posix.join(d.id, 'AGENTS.md') },
              });
            }
          }
        }
      }
    }

    const result = {
      path: positionals[0],
      max_depth: maxDepth,
      dependents: dependents.map((d) => ({
        path: d.id === '' ? '.' : d.id,
        hop: d.hop,
        is_test: isTest(d.id),
        provenance: d.provenance,
      })),
      affected_tests: affectedTests,
      constraints,
    };

    if (ctx.opts.json) return { result };

    const lines = [];
    for (const d of result.dependents) {
      lines.push(`${d.path}   (hop=${d.hop}, ${d.provenance.kind})${d.is_test ? '  [test]' : ''}   Source: ${d.provenance.source}`);
    }
    if (!result.dependents.length) lines.push('No dependents.');
    if (constraints.length) {
      lines.push('');
      lines.push('Constraints from affected:');
      for (const c of constraints) lines.push(`- ${c.source}: "${c.text}"`);
    }
    return { text: lines.join('\n') + '\n' };
  },
};

module.exports = { dependencies: depsCmd, dependents: dependentsCmd, impact: impactCmd };
