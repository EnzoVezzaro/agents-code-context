/**
 * Architecture graph derivation.
 *
 * The graph is derived at query time from three sources:
 *   1. Declared contracts in AGENTS.md files            (kind: declared)
 *   2. Cross-boundary path references in source files   (kind: discovered)
 *   3. Filesystem structure (functionality boundaries)
 *
 * It is always computed in memory — never read from or written to disk.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const agents = require('./agents');
const { walkFiles, relPath, cmp, dirOf } = require('./util');

const SOURCE_EXTS = new Set([
  '.rs', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.py',
  '.java', '.kt', '.rb', '.php', '.c', '.h', '.cpp', '.hpp', '.swift', '.cs',
]);

/**
 * Build the graph for a project root.
 * Returns { root, nodes, edges, boundaries, warnings }
 * - nodes: [{ id, path, name, has_local_contract, owners, purpose, provenance }]
 * - edges: [{ from, to, kind, provenance }]  (kind: dependency | ownership)
 */
function buildGraph(root, config) {
  const ignore = config.ignore || [];

  // 1. Collect functionality boundaries: directories containing AGENTS.md.
  const files = walkFiles(root, root, ignore, []);
  const boundaryDirs = new Set();
  const contracts = {}; // relDir -> { text, parsed, source: relPath }

  for (const rel of files) {
    if (path.posix.basename(rel).toLowerCase() !== 'agents.md') continue;
    const dir = dirOf(rel);
    const abs = path.join(root, rel);
    const text = fs.readFileSync(abs, 'utf8');
    boundaryDirs.add(dir);
    contracts[dir] = { text, parsed: agents.parse(text), source: rel };
  }

  // Root is always a node.
  boundaryDirs.add('');

  // 2. Build nodes (sorted by id).
  const nodes = [];
  for (const dir of [...boundaryDirs].sort(cmp)) {
    const c = contracts[dir];
    nodes.push({
      id: dir === '' ? '' : dir,
      path: dir === '' ? '.' : dir,
      name: dir === '' ? 'root' : path.posix.basename(dir),
      has_local_contract: !!c,
      owners: c ? c.parsed.owners : [],
      purpose: c ? c.parsed.purpose : null,
      provenance: {
        kind: 'declared',
        source: c ? c.source : 'filesystem structure',
      },
    });
  }

  // 3. Resolve a declared dependency path to the nearest boundary.
  function resolveBoundary(rel) {
    const clean = rel.replace(/\/+$/, '');
    if (boundaryDirs.has(clean)) return clean;
    // Nearest ancestor boundary.
    let dir = clean;
    while (dir.includes('/')) {
      dir = dir.slice(0, dir.lastIndexOf('/'));
      if (boundaryDirs.has(dir)) return dir;
    }
    return boundaryDirs.has('') ? '' : null;
  }

  // 4. Declared edges + ownership edges.
  const edges = [];
  const seen = new Set();

  function addEdge(from, to, kind, provenance) {
    const key = `${from}\u0000${to}\u0000${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, kind, provenance });
  }

  for (const dir of boundaryDirs) {
    const c = contracts[dir];
    if (!c) continue;
    for (const dep of c.parsed.deps) {
      const target = resolveBoundary(dep);
      if (target !== null && target !== dir) {
        addEdge(dir, target, 'dependency', {
          kind: 'declared',
          source: c.source,
          detail: 'Dependencies section',
        });
      }
    }
    for (const owner of c.parsed.owners) {
      const target = resolveBoundary(owner);
      if (target !== null && target !== dir) {
        addEdge(dir, target, 'ownership', {
          kind: 'declared',
          source: c.source,
          detail: 'Ownership section',
        });
      }
    }
  }

  // 5. Discovered edges: source files referencing other boundaries by path.
  const byDir = {};
  for (const dir of boundaryDirs) {
    byDir[dir === '' ? '.' : dir] = dir;
  }

  for (const rel of files) {
    if (!SOURCE_EXTS.has(path.posix.extname(rel))) continue;
    const fromDir = nearestBoundary(dirOf(rel), boundaryDirs);
    if (fromDir === null) continue;
    let content;
    try {
      content = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    for (const dir of boundaryDirs) {
      if (dir === fromDir || dir === '') continue;
      const token = dir;
      if (content.includes(token)) {
        addEdge(fromDir, dir, 'dependency', {
          kind: 'discovered',
          source: `discovered reference in ${rel}`,
          detail: 'source reference',
        });
      }
    }
  }

  // 6. Sort deterministically: from, to, kind, provenance order.
  const provOrder = { declared: 0, discovered: 1, inferred: 2, memory: 3 };
  edges.sort((a, b) => {
    return (
      cmp(a.from, b.from) ||
      cmp(a.to, b.to) ||
      cmp(a.kind, b.kind) ||
      (provOrder[a.provenance.kind] || 0) - (provOrder[b.provenance.kind] || 0)
    );
  });

  // 7. Detect cycles in declared dependencies.
  const declaredOnly = edges.filter((e) => e.kind === 'dependency' && e.provenance.kind === 'declared');
  const adj = {};
  for (const e of declaredOnly) {
    (adj[e.from] = adj[e.from] || []).push(e.to);
  }
  const cycles = findCycles(adj, boundaryDirs);

  return { root, nodes, edges, boundaries: [...boundaryDirs].sort(cmp), cycles };
}

function nearestBoundary(dir, boundaryDirs) {
  if (boundaryDirs.has(dir)) return dir;
  let d = dir;
  while (d.includes('/')) {
    d = d.slice(0, d.lastIndexOf('/'));
    if (boundaryDirs.has(d)) return d;
  }
  return boundaryDirs.has('') ? '' : null;
}

/** Dependency cycles in declared edges (ACC014). */
function findCycles(adj, boundaryDirs) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, pathArr) {
    if (inStack.has(node)) {
      const idx = pathArr.indexOf(node);
      cycles.push(pathArr.slice(idx).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const next of adj[node] || []) {
      dfs(next, pathArr.concat(next));
    }
    inStack.delete(node);
  }

  for (const node of boundaryDirs) dfs(node, [node]);
  // Deduplicate cycles by their rotated string representation.
  const seen = new Set();
  return cycles.filter((c) => {
    const key = c.join('>');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Dependents of a node: reverse edges. */
function dependents(graph, id) {
  return graph.edges.filter((e) => e.to === id && e.kind === 'dependency');
}

module.exports = { buildGraph, dependents, SOURCE_EXTS };
