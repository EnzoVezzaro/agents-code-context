/**
 * `acc graph [path]` — derive and render the architecture graph.
 * Formats: text, mermaid, dot, json (per the CLI command spec).
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
    const maxDepth = values['--max-depth'] === undefined ? Infinity : values['--max-depth'];

    let scope = null;
    if (positionals[0]) {
      scope = positionals[0].replace(/\/+$/, '');
      const exists = graph.nodes.some((n) => n.id === scope || n.path === scope);
      if (!exists) return { error: `no functionality boundary at: ${positionals[0]}`, exit: 2 };
    }

    // Depth relative to the scope root (0 = the scope itself; unscoped,
    // 0 = the root node). --max-depth limits how deep the subgraph goes.
    const depthOf = (id) => {
      if (id === '') return 0;
      if (scope) {
        if (id === scope) return 0;
        return id.startsWith(scope + '/') ? id.slice(scope.length + 1).split('/').length : Infinity;
      }
      return id.split('/').length;
    };
    const nodes = graph.nodes.filter((n) => {
      const inScopeNode = scope ? n.id === scope || n.id.startsWith(scope + '/') : true;
      return inScopeNode && depthOf(n.id) <= maxDepth;
    });
    const inScope = new Set(nodes.map((n) => n.id));
    const edges = scope
      ? graph.edges.filter((e) => inScope.has(e.from) && inScope.has(e.to))
      : graph.edges;

    const showProvenance = values['--provenance'] || ctx.config.graph?.default_provenance;
    // --nodes: emit only nodes (no edges). Default: nodes + edges.
    const includeNodes = true;
    const includeEdges = !values['--nodes'];

    const result = {
      scope: scope || '.',
      nodes: nodes.map((n) => ({
        id: n.id === '' ? '.' : n.id,
        name: n.name,
        has_local_contract: n.has_local_contract,
        owners: n.owners,
        provenance: showProvenance ? n.provenance : undefined,
      })),
      edges: includeEdges
        ? edges.map((e) => ({
            from: e.from === '' ? '.' : e.from,
            to: e.to === '' ? '.' : e.to,
            kind: e.kind,
            provenance: showProvenance ? e.provenance : undefined,
          }))
        : [],
    };

    if (ctx.opts.json || format === 'json') return { result };

    let text;
    if (format === 'mermaid') {
      text = renderMermaid(result, includeNodes, includeEdges);
    } else if (format === 'dot') {
      text = renderDot(result, includeNodes, includeEdges);
    } else {
      text = renderText(result, includeNodes, includeEdges);
    }
    return { text: text.endsWith('\n') ? text : text + '\n' };
  },
};

function renderText(g, includeNodes, includeEdges) {
  const lines = [];
  if (includeNodes) {
    lines.push('Nodes:');
    for (const n of g.nodes) {
      lines.push(`  ${n.id}${n.has_local_contract ? '' : ' (inherits)'}${n.owners.length ? `  owners: [${n.owners.join(', ')}]` : ''}`);
    }
    lines.push('');
  }
  if (includeEdges) {
    if (g.edges.length) {
      lines.push('Edges:');
      for (const e of g.edges) {
        const mark = e.provenance?.kind === 'discovered' ? ' (discovered)' : '';
        lines.push(`  ${e.from} → ${e.to}  [${e.kind}]${mark}`);
      }
    } else {
      lines.push('No edges.');
    }
  }
  return lines.join('\n');
}

function renderMermaid(g, includeNodes, includeEdges) {
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
  if (includeEdges) {
    for (const e of g.edges) {
      const from = labels[e.from] || e.from;
      const to = labels[e.to] || e.to;
      const dash = e.provenance?.kind === 'inferred' ? '-.->' : '-->';
      lines.push(`  ${from} ${dash} ${to}`);
    }
  }
  return lines.join('\n');
}

function renderDot(g, includeNodes, includeEdges) {
  const lines = ['digraph acc {'];
  if (includeNodes) {
    for (const n of g.nodes) {
      lines.push(`  "${n.id}" [label="${n.id}"];`);
    }
  }
  if (includeEdges) {
    for (const e of g.edges) {
      lines.push(`  "${e.from}" -> "${e.to}" [label="${e.kind}"];`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}
