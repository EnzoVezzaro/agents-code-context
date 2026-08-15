/**
 * `acc discover [path]` — architectural suggestions from the diff between
 * declared contracts and discovered code. Inferred provenance only;
 * dry-run by default (docs/04).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('../graph');
const { parse } = require('../agents');
const { readUtf8, walkFiles, dirOf } = require('../util');

const KINDS = ['missing-contract', 'missing-dependency', 'stale-dependency', 'unknown-owner', 'orphan-code'];

module.exports = {
  name: 'discover',
  summary: 'Suggest architectural improvements (dry-run by default)',
  usage: 'acc discover [path] [--kind kind[,kind...]] [--apply] [--yes] [--json]',
  booleans: ['--apply', '--yes', '--json'],
  flags: { '--kind': { type: 'string' } },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const requested = values['--kind'] ? values['--kind'].split(',').map((s) => s.trim()) : KINDS;
    const graph = buildGraph(ctx.root, ctx.config);
    const files = walkFiles(ctx.root, ctx.root, ctx.config.ignore || [], []);

    const suggestions = [];
    const inScope = (id) => (positionals[0] ? id.startsWith(positionals[0].replace(/\/+$/, '')) : true);

    // missing-contract: directory with source code but no AGENTS.md.
    if (requested.includes('missing-contract')) {
      const srcDirs = new Set();
      for (const rel of files) {
        if (/\.(rs|ts|tsx|js|jsx|go|py|java|rb|php|c|cpp|h|hpp|swift|kt|cs)$/.test(rel)) {
          srcDirs.add(dirOf(rel));
        }
      }
      for (const dir of srcDirs) {
        if (!inScope(dir)) continue;
        if (graph.boundaries.includes(dir)) continue;
        let covered = false;
        let d = dir;
        while (d.includes('/')) {
          d = d.slice(0, d.lastIndexOf('/'));
          if (graph.boundaries.includes(d)) { covered = true; break; }
        }
        if (covered) continue;
        suggestions.push({
          kind: 'missing-contract',
          path: dir || '.',
          description: `${dir || '.'} has code but no AGENTS.md`,
          code: 'ACC072',
          proposed_change: { file: path.posix.join(dir, 'AGENTS.md'), action: 'create' },
          provenance: { kind: 'inferred', source: 'discovered from filesystem structure' },
        });
      }
    }

    // missing-dependency / stale-dependency / unknown-owner from declared vs discovered.
    const declaredByNode = {};
    const discoveredByNode = {};
    for (const e of graph.edges) {
      if (e.kind !== 'dependency') continue;
      if (e.provenance.kind === 'declared') {
        (declaredByNode[e.from] = declaredByNode[e.from] || []).push(e.to);
      } else if (e.provenance.kind === 'discovered') {
        (discoveredByNode[e.from] = discoveredByNode[e.from] || []).push(e.to);
      }
    }

    for (const node of graph.nodes) {
      if (node.id === '' || !inScope(node.id)) continue;
      const declared = new Set(declaredByNode[node.id] || []);
      const discovered = new Set(discoveredByNode[node.id] || []);

      if (requested.includes('missing-dependency')) {
        for (const to of discovered) {
          if (!declared.has(to)) {
            suggestions.push({
              kind: 'missing-dependency',
              path: node.id,
              description: `${node.id} → ${to} discovered but not declared`,
              code: 'ACC022',
              proposed_change: { file: path.posix.join(node.id, 'AGENTS.md'), section: 'Dependencies', add: to },
              provenance: { kind: 'inferred', source: `discovered reference in ${node.id}` },
            });
          }
        }
      }
      if (requested.includes('stale-dependency')) {
        for (const to of declared) {
          if (!discovered.has(to)) {
            suggestions.push({
              kind: 'stale-dependency',
              path: node.id,
              description: `${node.id} → ${to} declared but not discovered in code`,
              code: 'ACC020',
              proposed_change: { file: path.posix.join(node.id, 'AGENTS.md'), section: 'Dependencies', remove: to },
              provenance: { kind: 'inferred', source: 'declared vs discovered diff' },
            });
          }
        }
      }
      if (requested.includes('unknown-owner')) {
        if (node.owners.length === 0) {
          suggestions.push({
            kind: 'unknown-owner',
            path: node.id,
            description: `${node.id} has no declared owner`,
            code: 'ACC031',
            proposed_change: { file: path.posix.join(node.id, 'AGENTS.md'), section: 'Ownership', add: '<owner>' },
            provenance: { kind: 'inferred', source: 'ownership section missing' },
          });
        }
      }
    }

    // orphan-code
    if (requested.includes('orphan-code')) {
      // Same computation as missing-contract at the root level.
      const srcDirs = new Set();
      for (const rel of files) {
        if (/\.(rs|ts|tsx|js|jsx|go|py|java|rb|php|c|cpp|h|hpp|swift|kt|cs)$/.test(rel)) {
          srcDirs.add(dirOf(rel));
        }
      }
      for (const dir of srcDirs) {
        if (dir === '') continue;
        if (graph.boundaries.includes(dir)) continue;
        let covered = false;
        let d = dir;
        while (d.includes('/')) {
          d = d.slice(0, d.lastIndexOf('/'));
          if (graph.boundaries.includes(d)) { covered = true; break; }
        }
        if (!covered) {
          suggestions.push({
            kind: 'orphan-code',
            path: dir,
            description: `source files at ${dir} are outside any functionality boundary`,
            code: 'ACC072',
            proposed_change: { file: path.posix.join(dir, 'AGENTS.md'), action: 'create' },
            provenance: { kind: 'inferred', source: 'filesystem structure' },
          });
        }
      }
    }

    // Deduplicate.
    const seen = new Set();
    const unique = suggestions.filter((s) => {
      const key = `${s.kind}|${s.path}|${s.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let appliedCount = 0;
    if (values['--apply']) {
      const shouldApply = values['--yes'] || true; // non-interactive in V1
      if (shouldApply) {
        for (const s of unique) {
          const file = path.resolve(ctx.root, s.proposed_change.file);
          if (s.kind === 'missing-contract' || s.kind === 'orphan-code') {
            if (!fs.existsSync(file)) {
              const { agentsMdTemplate } = require('../templates');
              fs.mkdirSync(path.dirname(file), { recursive: true });
              fs.writeFileSync(file, agentsMdTemplate(path.posix.basename(path.dirname(file))));
              appliedCount++;
            }
          } else if (s.kind === 'missing-dependency' || s.kind === 'unknown-owner' || s.kind === 'stale-dependency') {
            if (fs.existsSync(file)) {
              let text = fs.readFileSync(file, 'utf8');
              if (s.kind === 'missing-dependency') {
                text = appendToSection(text, 'Dependencies', s.proposed_change.add);
              } else if (s.kind === 'unknown-owner') {
                text = appendToSection(text, 'Ownership', 'Owner: <owner>');
              } else {
                text = removeFromSection(text, 'Dependencies', s.proposed_change.remove);
              }
              fs.writeFileSync(file, text);
              appliedCount++;
            }
          }
        }
      }
    }

    const result = {
      suggestions: unique.map((s) => ({ ...s, applied: values['--apply'] })),
      applied_count: appliedCount,
    };
    if (ctx.opts.json) return { result };

    const lines = [];
    for (const s of unique) {
      lines.push(`[${s.kind}] ${s.description}`);
      lines.push(`  → ${s.code} — ${s.proposed_change.file}`);
      lines.push('');
    }
    if (!unique.length) lines.push('No suggestions. Declared and discovered agree.');
    return { text: lines.join('\n') };
  },
};

function appendToSection(text, section, value) {
  const re = new RegExp(`(##\\s*${section}[^#]*)(?=\\n##|$)`, 'i');
  if (re.test(text)) {
    return text.replace(re, (m) => `${m.replace(/\s+$/, '')}\n- ${value}\n`);
  }
  return `${text.replace(/\s+$/, '')}\n\n## ${section}\n\n- ${value}\n`;
}

function removeFromSection(text, section, value) {
  const re = new RegExp(`(##\\s*${section}[^#]*?)(^\\s*-\\s*${escapeRe(value)}\\s*\\n?)`, 'im');
  return text.replace(re, '$1').replace(/\n{3,}/g, '\n\n');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
