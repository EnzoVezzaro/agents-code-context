/**
 * `acc graph [path]` — derive and render the architecture graph.
 * Formats: text, mermaid, dot, json (docs/04).
 */
'use strict';

const { buildGraph } = require('../graph');

module.exports = {
  name: 'graph',
  summary: 'Derive the architecture graph (text, mermaid, dot, json)',
  usage: 'acc graph [path] [--format text|mermaid|dot|json] [--nodes] [--provenance] [--max-depth N]',
  booleans: ['--nodes', '--provenance', '--json'],
  flags: { '--format': { type: 'string' }, '--max-depth': { type: 'number' } },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const format = values['--json'] ? 'json' : (values['--format'] || ctx.config.graph?.default_format || 'text');
    if (!['text', 'mermaid', 'dot', 'json'].includes(format)) {
      return { error: `invalid format: ${format}`, exit: 2 };
    }

    const graph = buildGraph(ctx.root, ctx.config);

    let scope = null;
    if (positionals[0]) {
      scope = positionals[0].replace(/\/+$/, '');
      const exists = graph.nodes.some((n) => n.id === scope || n.path === scope);
      if (!exists) return { error: `no functionality boundary at: ${positionals[0]}`, exit: 2 };
    }

    const nodes = scope
      ? graph.nodes.filter((n) => n.id === scope || n.id.startsWith(scope + '/'))
      : graph.nodes;
    const inScope = new Set(nodes.map((n) => n.id));
    const edges = scope
      ? graph.edges.filter((e) => inScope.has(e.from) && inScope.has(e.to))
      : graph.edges;

    const showProvenance = values['--provenance'] || ctx.config.graph?.default_provenance;
    const includeNodes = !values['--nodes'];

    const result = {
      scope: scope || '.',
      nodes: nodes.map((n) => ({
        id: n.id === '' ? '.' : n.id,
        name: n.name,
        has_local_contract: n.has_local_contract,
        owners: n.owners,
        provenance: showProvenance ? n.provenance : undefined,
      })),
      edges: edges.map((e) => ({
        from: e.from === '' ? '.' : e.from,
        to: e.to === '' ? '.' : e.to,
        kind: e.kind,
        provenance: showProvenance ? e.provenance : undefined,
      })),
    };

    if (ctx.opts.json || format === 'json') return { result };

    let text;
    if (format === 'mermaid') {
      text = renderMermaid(result, includeNodes);
    } else if (format === 'dot') {
      text = renderDot(result, includeNodes);
    } else {
      text = renderText(result, includeNodes);
    }
    return { text: text.endsWith('\n') ? text : text + '\n' };
  },
};

function renderText(g, includeNodes) {
  const lines = [];
  if (includeNodes) {
    lines.push('Nodes:');
    for (const n of g.nodes) {
      lines.push(`  ${n.id}${n.has_local_contract ? '' : ' (inherits)'}${n.owners.length ? `  owners: [${n.owners.join(', ')}]` : ''}`);
    }
    lines.push('');
  }
  if (g.edges.length) {
    lines.push('Edges:');
    for (const e of g.edges) {
      const mark = e.provenance?.kind === 'discovered' ? ' (discovered)' : '';
      lines.push(`  ${e.from} → ${e.to}  [${e.kind}]${mark}`);
    }
  } else {
    lines.push('No edges.');
  }
  return lines.join('\n');
}

function renderMermaid(g, includeNodes) {
  const lines = ['graph LR'];
  const labels = {};
  let i = 0;
  for (const n of g.nodes) {
    const label = 'n' + i++;
    labels[n.id] = label;
    if (includeNodes) {
      lines.push(`  ${label}[${n.id}]`);
    }
  }
  for (const e of g.edges) {
    const from = labels[e.from] || e.from;
    const to = labels[e.to] || e.to;
    const dash = e.provenance?.kind === 'inferred' ? '-.->' : '-->';
    lines.push(`  ${from} ${dash} ${to}`);
  }
  return lines.join('\n');
}

function renderDot(g, includeNodes) {
  const lines = ['digraph acc {'];
  if (includeNodes) {
    for (const n of g.nodes) {
      lines.push(`  "${n.id}" [label="${n.id}"];`);
    }
  }
  for (const e of g.edges) {
    lines.push(`  "${e.from}" -> "${e.to}" [label="${e.kind}"];`);
  }
  lines.push('}');
  return lines.join('\n');
}
