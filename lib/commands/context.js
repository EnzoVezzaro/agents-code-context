/**
 * `acc context <path>` — focused, progressive, provenance-tagged context
 * for a path (see the context-engine spec). Never dumps the whole
 * repository.
 *
 * Sections: hierarchy, contract, dependencies, constraints, implementations,
 * memory. Depth limits transitive contract expansion; --max-bytes caps the
 * output.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('../core/graph');
const { parse } = require('../core/agents');
const { readUtf8, relPath, cmp } = require('../core/util');
const { sourceTag } = require('../core/output');
const memory = require('../core/memory');

const SECTIONS = ['hierarchy', 'contract', 'dependencies', 'constraints', 'implementations', 'memory'];

module.exports = {
  name: 'context',
  summary: 'Generate focused, progressive agent context for a path',
  usage: 'acc context <path> [--depth N] [--max-bytes N] [--include kinds] [--exclude kinds] [--json]',
  booleans: ['--json'],
  flags: {
    '--depth': { type: 'number' },
    '--max-bytes': { type: 'number' },
    '--include': { type: 'string' },
    '--exclude': { type: 'string' },
  },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one path', exit: 2 };

    const target = positionals[0];
    const abs = path.resolve(ctx.root, target);
    if (!fs.existsSync(abs)) {
      return { error: `path does not exist: ${target}`, exit: 2 };
    }
    if (values['--depth'] !== undefined && values['--depth'] < 0) {
      return { error: '--depth must be >= 0', exit: 2 };
    }
    if (values['--include'] && values['--exclude']) {
      return { error: '--include and --exclude are mutually exclusive', exit: 2 };
    }
    if (values['--include']) {
      const bad = values['--include'].split(',').map((s) => s.trim()).filter((s) => !SECTIONS.includes(s));
      if (bad.length) return { error: `unknown section kind: ${bad[0]} (expected ${SECTIONS.join('|')})`, exit: 2 };
    }
    if (values['--exclude']) {
      const bad = values['--exclude'].split(',').map((s) => s.trim()).filter((s) => !SECTIONS.includes(s));
      if (bad.length) return { error: `unknown section kind: ${bad[0]} (expected ${SECTIONS.join('|')})`, exit: 2 };
    }

    const depth = values['--depth'] === undefined ? (ctx.config.context?.default_depth ?? 1) : values['--depth'];
    const maxBytes = values['--max-bytes'] === undefined ? (ctx.config.context?.default_max_bytes ?? 65536) : values['--max-bytes'];

    // All six sections by default — Memory shows existence, with contents
    // only when explicitly requested via --include memory (per the
    // context-engine spec). The config control plane (context.default_include)
    // narrows the default set; --include/--exclude always win.
    const explicit = values['--include'] ? values['--include'].split(',').map((s) => s.trim()) : null;
    const cfgInclude =
      Array.isArray(ctx.config.context?.default_include) && ctx.config.context.default_include.length
        ? ctx.config.context.default_include.filter((s) => SECTIONS.includes(s))
        : null;
    const effectiveDefault = cfgInclude || [...SECTIONS];
    const showMemoryContents = !!explicit ? explicit.includes('memory') : cfgInclude ? cfgInclude.includes('memory') : false;
    let include = explicit ? [...explicit] : [...effectiveDefault];
    if (values['--exclude']) {
      const ex = new Set(values['--exclude'].split(',').map((s) => s.trim()));
      include = SECTIONS.filter((s) => !ex.has(s));
    }

    const graph = buildGraph(ctx.root, ctx.config);
    const rel = relPath(ctx.root, abs);
    const dir = rel === '' ? '.' : rel;

    // Resolve boundary.
    let node = null;
    let d = dir;
    for (;;) {
      node = graph.nodes.find((n) => (n.path === d) || (d === '.' && n.id === ''));
      if (node) break;
      if (d === '.' || d === '') break;
      d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '.';
    }
    if (!node) node = graph.nodes.find((n) => n.id === '');

    // Ancestor chain.
    const ancestors = [];
    const parts = node.id === '' ? [] : node.id.split('/');
    for (let i = 0; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/');
      const n = graph.nodes.find((x) => x.id === p || (p === '' && x.id === ''));
      if (n) ancestors.push(n);
    }

    // Purpose is contract content, not graph content: the graph is an
    // index (id/type/parent/hash/flags), so summaries are parsed from
    // the AGENTS.md on demand, never stored on graph nodes.
    const purposeOf = (anc) => {
      if (!anc.has_local_contract) return null;
      const src = anc.id === '' ? 'AGENTS.md' : path.posix.join(anc.id, 'AGENTS.md');
      const text = readUtf8(path.join(ctx.root, anc.id === '' ? '' : anc.id, 'AGENTS.md'));
      if (!text) return null;
      return parse(text).purpose;
    };

    // Transitive dependencies (contract expansion up to depth).
    const depEdges = [];
    const queue = [{ id: node.id, hop: 0 }];
    const visited = new Set();
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur.id) || cur.hop > depth) continue;
      visited.add(cur.id);
      const edges = graph.edges
        .filter((e) => e.from === cur.id && e.kind === 'dependency')
        .filter((e) => e.provenance.kind === 'declared' || e.provenance.kind === 'discovered');
      for (const e of edges) {
        depEdges.push({ ...e, hop: cur.hop });
        queue.push({ id: e.to, hop: cur.hop + 1 });
      }
    }

    // Local contract.
    let contractText = null;
    let parsed = null;
    let contractSource = null;
    if (node.id === '' && fs.existsSync(path.join(ctx.root, 'AGENTS.md'))) {
      contractSource = 'AGENTS.md';
      contractText = readUtf8(path.join(ctx.root, 'AGENTS.md'));
      parsed = parse(contractText || '');
    } else if (node.id !== '' && fs.existsSync(path.join(ctx.root, node.id, 'AGENTS.md'))) {
      contractSource = path.posix.join(node.id, 'AGENTS.md');
      contractText = readUtf8(path.join(ctx.root, node.id, 'AGENTS.md'));
      parsed = parse(contractText || '');
    }

    // Inherited constraints: every ancestor contract (root → parent) that
    // declares a Constraints section (per the context-engine spec). The
    // local node's own
    // constraints are handled separately below.
    const inheritedConstraints = [];
    for (const anc of ancestors.slice(0, -1)) {
      if (!anc.has_local_contract) continue;
      const src = anc.id === '' ? 'AGENTS.md' : path.posix.join(anc.id, 'AGENTS.md');
      const ancText = readUtf8(path.join(ctx.root, anc.id === '' ? '' : anc.id, 'AGENTS.md'));
      const ancParsed = parse(ancText || '');
      if (!ancParsed.sections.Constraints) continue;
      for (const line of ancParsed.sections.Constraints.split(/\r?\n/)) {
        if (!line.trim()) continue;
        inheritedConstraints.push({
          text: line.replace(/^[-*•]\s*/, '').trim(),
          provenance: { kind: 'declared', source: src },
        });
      }
    }

    // Implementations summary.
    const impl = summarizeImplementations(ctx.root, node.id, ctx.config);

    const mem = memory.show(ctx.root, node.id === '' ? '' : node.id);
    const memorySection = {
      exists: mem.exists,
      path: mem.exists ? mem.file : null,
      contents: showMemoryContents ? mem.contents : null,
    };

    const sections = {};
    if (include.includes('hierarchy')) {
      sections.hierarchy = ancestors.map((a) => ({
        path: a.path === '.' ? '' : a.path,
        has_local_contract: a.has_local_contract,
        source: a.id === '' && a.has_local_contract ? 'AGENTS.md' : a.has_local_contract ? path.posix.join(a.id, 'AGENTS.md') : null,
        summary: purposeOf(a),
      }));
    }
    if (include.includes('contract')) {
      sections.contract = {
        source: contractSource,
        parsed_sections: parsed ? parsed.sections : {},
        raw_ref: contractSource,
      };
    }
    if (include.includes('dependencies')) {
      sections.dependencies = depEdges
        .sort((a, b) => cmp(a.to, b.to))
        .map((e) => ({
          from: e.from === '' ? '.' : e.from,
          to: e.to === '' ? '.' : e.to,
          hop: e.hop,
          provenance: e.provenance,
        }));
    }
    if (include.includes('constraints')) {
      const local = parsed && parsed.sections.Constraints
        ? parsed.sections.Constraints.split(/\r?\n/).filter((l) => l.trim()).map((l) => ({
            text: l.replace(/^[-*•]\s*/, '').trim(),
            provenance: { kind: 'declared', source: contractSource },
          }))
        : [];
      sections.constraints = local.concat(inheritedConstraints);
    }
    if (include.includes('implementations')) {
      sections.implementations = impl;
    }
    if (include.includes('memory')) {
      sections.memory = memorySection;
    }

    const payload = {
      path: target,
      depth,
      sections,
      bytes: 0,
      max_bytes: maxBytes,
    };

    // Measure and truncate.
    const encoded = JSON.stringify(payload);
    let truncated = false;
    let omitted = 0;
    if (Buffer.byteLength(encoded) > maxBytes) {
      truncated = true;
      omitted = Buffer.byteLength(encoded) - maxBytes;
    }

    if (ctx.opts.json) {
      const result = { ...payload, bytes: Buffer.byteLength(JSON.stringify(payload)), truncated, truncated_bytes_omitted: omitted };
      return { result };
    }

    const lines = [];
    if (include.includes('hierarchy')) {
      lines.push('## Hierarchy');
      for (const h of sections.hierarchy) {
        const label = h.path === '' ? 'project root' : h.path;
        const src = h.source ? `Source: ${h.source}` : 'no local contract';
        lines.push(`  ${h.path === '' ? '' : '└─ '}${label}        ${src}`);
      }
      lines.push('');
    }
    if (include.includes('contract') && sections.contract.source) {
      lines.push(`## Contract (${sections.contract.source})`);
      for (const [name, body] of Object.entries(sections.contract.parsed_sections || {})) {
        lines.push(`${name}:`);
        lines.push(body);
        lines.push('');
      }
      lines.push(`Source: ${sections.contract.source} (parsed; raw file is source of truth)`);
      lines.push('');
    }
    if (include.includes('dependencies')) {
      lines.push(`## Dependencies (depth=${depth})`);
      const declared = sections.dependencies.filter((d) => d.provenance.kind === 'declared');
      const discovered = sections.dependencies.filter((d) => d.provenance.kind === 'discovered');
      if (declared.length) {
        lines.push('Declared:');
        for (const d of declared) lines.push(`  → ${d.to}   hop=${d.hop}   ${sourceTag(d.provenance)}`);
      }
      if (discovered.length) {
        lines.push('Discovered:');
        for (const d of discovered) lines.push(`  → ${d.to}   hop=${d.hop}   ${sourceTag(d.provenance)}`);
      }
      if (!declared.length && !discovered.length) lines.push('  (none)');
      lines.push('');
    }
    if (include.includes('constraints') && sections.constraints.length) {
      lines.push('## Constraints');
      for (const c of sections.constraints) lines.push(`- ${c.text}   ${sourceTag(c.provenance)}`);
      lines.push('');
    }
    if (include.includes('implementations')) {
      lines.push('## Implementations');
      lines.push(`Files: ${sections.implementations.files}`);
      lines.push(`Bytes: ${sections.implementations.bytes}`);
      for (const l of sections.implementations.languages || []) {
        lines.push(`  ${l.name}: ${l.files} files`);
      }
      lines.push(sourceTag({ source: 'discovered from filesystem' }));
      lines.push('');
    }
    if (include.includes('memory')) {
      lines.push('## Memory');
      if (mem.exists) {
        lines.push(`.acc-memory.md present at ${mem.file}`);
        if (showMemoryContents && mem.contents) {
          lines.push('');
          lines.push(mem.contents.replace(/\s+$/, ''));
        }
      } else {
        lines.push('.acc-memory.md not present');
      }
      lines.push('');
    }

    let text = lines.join('\n');
    const bytes = Buffer.byteLength(text);
    let truncatedNote = '';
    if (bytes > maxBytes) {
      const cut = text.slice(0, maxBytes);
      truncatedNote = `\n… [truncated: ${bytes - maxBytes} bytes omitted; use --max-bytes to expand or --depth to narrow]\n`;
      text = cut + truncatedNote;
    }
    text += `Context bytes: ${bytes} / ${maxBytes}\n`;
    return { text };
  },
};

function summarizeImplementations(root, id, config) {
  const base = id === '' ? root : path.join(root, id);
  const langs = {};
  let count = 0;
  let bytes = 0;
  if (fs.existsSync(base)) {
    const walk = (dir) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (e.isFile()) {
          const ext = path.extname(e.name).replace('.', '');
          if (ext) {
            langs[ext] = (langs[ext] || 0) + 1;
            count++;
            try {
              bytes += fs.statSync(abs).size;
            } catch {
              /* unreadable — skip */
            }
          }
        }
      }
    };
    walk(base);
  }
  return {
    files: count,
    bytes,
    languages: Object.keys(langs).sort(cmp).map((name) => ({ name, files: langs[name] })),
  };
}
