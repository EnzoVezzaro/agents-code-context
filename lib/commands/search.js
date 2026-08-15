/**
 * `acc search <query>` — architecture-aware search across contracts, edges,
 * and code (docs/04). Each result carries provenance.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('../graph');
const { readUtf8, walkFiles, cmp } = require('../util');

const KINDS = ['contracts', 'edges', 'code', 'all'];

module.exports = {
  name: 'search',
  summary: 'Architecture-aware search across contracts, edges, and code',
  usage: 'acc search <query> [--kind contracts|edges|code|all] [--limit N] [--regex] [--path prefix] [--json]',
  booleans: ['--regex', '--json'],
  flags: { '--kind': { type: 'string' }, '--limit': { type: 'number' }, '--path': { type: 'string' } },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one query', exit: 2 };

    const kind = values['--kind'] || 'all';
    if (!KINDS.includes(kind)) return { error: `invalid kind: ${kind}`, exit: 2 };
    const limit = values['--limit'] === undefined ? 50 : values['--limit'];
    const prefix = values['--path'] || null;
    const query = positionals[0];

    let matcher;
    if (values['--regex']) {
      try {
        matcher = (s) => new RegExp(query).test(s);
      } catch (e) {
        return { error: `invalid regex: ${e.message}`, exit: 2 };
      }
    } else {
      matcher = (s) => s.toLowerCase().includes(query.toLowerCase());
    }

    const results = [];
    const graph = buildGraph(ctx.root, ctx.config);
    const files = walkFiles(ctx.root, ctx.root, ctx.config.ignore || [], []);

    const inScope = (rel) => (prefix ? rel.startsWith(prefix) : true);

    if (kind === 'contracts' || kind === 'all') {
      for (const rel of files) {
        if (!inScope(rel) || path.posix.basename(rel).toLowerCase() !== 'agents.md') continue;
        const text = readUtf8(path.join(ctx.root, rel));
        if (!text) continue;
        const lines = text.split(/\r?\n/);
        lines.forEach((line, i) => {
          if (matcher(line)) {
            results.push({
              kind: 'contract',
              path: rel,
              line: i + 1,
              snippet: line.trim().slice(0, 120),
              provenance: { kind: 'declared', source: rel },
            });
          }
        });
      }
    }

    if (kind === 'edges' || kind === 'all') {
      for (const e of graph.edges) {
        const hay = `${e.from} ${e.to} ${e.kind}`;
        if (matcher(hay)) {
          results.push({
            kind: 'edge',
            path: e.from === '' ? '.' : e.from,
            line: null,
            snippet: `${e.from} → ${e.to} [${e.kind}]`,
            provenance: e.provenance,
          });
        }
      }
    }

    if (kind === 'code' || kind === 'all') {
      const textExts = /\.(rs|ts|tsx|js|jsx|go|py|java|rb|php|c|cpp|h|hpp|swift|kt|cs|md)$/;
      for (const rel of files) {
        if (!inScope(rel) || !textExts.test(rel)) continue;
        if (path.posix.basename(rel).toLowerCase() === 'agents.md') continue;
        const text = readUtf8(path.join(ctx.root, rel));
        if (!text || !matcher(text)) continue;
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (matcher(lines[i])) {
            results.push({
              kind: 'code',
              path: rel,
              line: i + 1,
              snippet: lines[i].trim().slice(0, 120),
              provenance: { kind: 'discovered', source: rel },
            });
            break; // one hit per file to keep results focused
          }
        }
      }
    }

    results.sort((a, b) => cmp(a.path, b.path) || (a.line || 0) - (b.line || 0));
    const truncated = results.length > limit;
    const shown = results.slice(0, limit);

    const result = { query, kind, results: shown, truncated };
    if (ctx.opts.json) return { result };

    const lines = [];
    for (const r of shown) {
      const at = r.line ? `${r.path}:${r.line}` : r.path;
      lines.push(`${at}  ${r.snippet}`);
    }
    if (truncated) lines.push(`… ${results.length - limit} more results (use --limit to expand)`);
    if (!shown.length) lines.push('No matches.');
    return { text: lines.join('\n') + '\n' };
  },
};
