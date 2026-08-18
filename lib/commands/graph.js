/**
 * `acc graph [path]` — derive and render the architecture graph.
 * Formats: text, mermaid, dot, json (per the CLI command spec).
 *
 * When a path is provided, nodes are enriched with diagnostics,
 * memory state, and edge counts — the full knowledge for that boundary.
 */
'use strict';

const { buildGraph } = require('../core/graph');
const { check } = require('../core/diagnostics');
const { show: memoryShow } = require('../core/memory');
const { loadState } = require('../core/trigger');
const { WARN_FILE } = require('../core/warnfile');
const fs = require('fs');
const path = require('path');

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
      ? graph.edges.filter((e) => inScope.has(e.from) || inScope.has(e.to))
      : graph.edges;

    const showProvenance = values['--provenance'] || ctx.config.graph?.default_provenance;
    // --nodes: emit only nodes (no edges). Default: nodes + edges.
    const includeNodes = true;
    const includeEdges = !values['--nodes'];

    // Enrich nodes with knowledge data (diagnostics, memory, edge counts).
    const diags = check(ctx.root, ctx.config, {
      configPresent: ctx.configPresent,
      configValid: ctx.configValid,
      error: ctx.configError,
    });
    const diagsByPath = indexDiagnostics(diags);
    const engineState = loadState(ctx.root);
    const driftReportExists = fs.existsSync(path.join(ctx.root, WARN_FILE));

    const enrichedNodes = nodes.map((n) => {
      const boundary = n.id;
      const boundaryDiags = diagsByPath.get(boundary) || [];
      const mem = memoryShow(ctx.root, boundary);
      const boundaryEdges = edges.filter(
        (e) => e.from === boundary || e.to === boundary || (!boundary && (e.from === '' || e.to === ''))
      );
      const depCount = boundaryEdges.filter((e) => e.kind === 'dependency').length;
      const inboundCount = boundaryEdges.filter((e) => e.to === boundary && e.kind === 'dependency').length;
      const outboundCount = boundaryEdges.filter((e) => e.from === boundary && e.kind === 'dependency').length;

      const node = {
        id: n.id === '' ? '.' : n.id,
        type: n.type,
        name: n.name,
        has_local_contract: n.has_local_contract,
        owners: n.owners,
        provenance: showProvenance ? n.provenance : undefined,
        diagnostics: boundaryDiags,
        memory: {
          exists: mem.exists,
          file: mem.file,
          size: mem.exists && mem.contents ? Buffer.byteLength(mem.contents, 'utf8') : 0,
          entries: mem.exists && mem.contents ? countEntries(mem.contents) : 0,
        },
        edges: { total: depCount, inbound: inboundCount, outbound: outboundCount },
      };
      return node;
    });

    const summary = {
      boundaries: enrichedNodes.length,
      diagnostics: {
        total: diags.length,
        errors: diags.filter((d) => d.severity === 'error').length,
        warnings: diags.filter((d) => d.severity === 'warn').length,
        infos: diags.filter((d) => d.severity === 'info').length,
      },
      edges: { total: edges.filter((e) => e.kind === 'dependency').length },
      memory: {
        with_memory: enrichedNodes.filter((n) => n.memory.exists).length,
        without_memory: enrichedNodes.filter((n) => !n.memory.exists).length,
      },
      drift_report: driftReportExists,
      engine_state: engineState ? { last_trigger: engineState.trigger || null } : null,
    };

    const result = {
      scope: scope || '.',
      nodes: enrichedNodes,
      edges: includeEdges
        ? edges.map((e) => ({
            from: e.from === '' ? '.' : e.from,
            to: e.to === '' ? '.' : e.to,
            kind: e.kind,
            provenance: showProvenance ? e.provenance : undefined,
          }))
        : [],
      summary,
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
  const s = g.summary;
  lines.push(`Summary: ${s.boundaries} boundary(ies), ${s.edges.total} edge(s)`);
  const d = s.diagnostics;
  lines.push(`  Diagnostics: ${d.total} (${d.errors} errors, ${d.warnings} warnings, ${d.infos} infos)`);
  lines.push(`  Memory: ${s.memory.with_memory}/${s.boundaries} boundary(ies) have memory`);
  lines.push(`  Drift report: ${s.drift_report ? 'present' : 'absent'}`);
  lines.push('');

  if (includeNodes) {
    lines.push('Nodes:');
    for (const n of g.nodes) {
      const diags = n.diagnostics.length ? ` ${n.diagnostics.length} diag(s)` : '';
      const mem = n.memory.exists ? ` mem: ${n.memory.size}b` : '';
      const owners = n.owners.length ? ` owners: [${n.owners.join(', ')}]` : '';
      const inherits = n.has_local_contract ? '' : ' (inherits)';
      lines.push(`  ${n.id}${inherits}${owners}${diags}${mem}`);
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

/* ---- knowledge helpers ---- */

function indexDiagnostics(diags) {
  const byPath = new Map();
  for (const d of diags) {
    const dir = d.path ? d.path.split('/').slice(0, -1).join('/') : '';
    if (!byPath.has(dir)) byPath.set(dir, []);
    byPath.get(dir).push({ code: d.code, severity: d.severity, message: d.message, path: d.path });
  }
  return byPath;
}

function countEntries(contents) {
  const matches = contents.match(/^## /gm);
  return matches ? matches.length : 0;
}
