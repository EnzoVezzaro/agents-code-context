/**
 * Graph derivation.
 *
 * Two layers, derived at query time from three sources:
 *   1. Declared contracts in AGENTS.md files            (kind: declared)
 *   2. Cross-boundary path references in source files   (kind: discovered)
 *   3. Filesystem structure (functionality boundaries)
 *
 * The architecture graph (`nodes`/`edges`) is the documented boundary
 * contract: nodes are functionality boundaries, edges are `dependency` /
 * `ownership` relationships between boundaries. It is always computed in
 * memory — never read from or written to disk.
 *
 * The knowledge-graph index (`items`/`links`) is the machine-only
 * extension: typed nodes (boundary, agents, file, tests, skill, standard)
 * with minimal metadata (id, type, parent, hash, flags, provenance) and
 * typed edges (governs, owns, requires, tested_by). It is an INDEX of
 * relationships, not a knowledge store — no prose, no descriptions, no
 * duplicated content ever enters nodes or edges. Human-readable content
 * lives in AGENTS.md / SKILL.md / .acc-memory.md and is read from the
 * filesystem on demand (see graphSlice / `acc slice`).
 *
 * The graph is queried, not read: graphSlice() answers "what owns this",
 * "what governs this", "what does this depend on", "what depends on
 * this", "what tests this", "what skills/standards apply", "what is the
 * impact".
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

/** Closed set of knowledge-graph node types. */
const NODE_TYPES = ['boundary', 'agents', 'file', 'test', 'skill', 'standard'];

/** Closed set of edge kinds (architecture + knowledge-graph index). */
const EDGE_KINDS = ['dependency', 'ownership', 'governs', 'owns', 'requires', 'tested_by'];

const TEST_DIR_SEGMENTS = new Set(['tests', 'test', '__tests__', '__test__']);
const SKILL_PATH = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/i;
const SKILL_PATH_ACC = /^\.acc\/config\/skills\/([^/]+)\/SKILL\.md$/i;
const STANDARD_PATH = /^\.acc\/config\/standards\/([^/]+)\.md$/i;

/**
 * Build the graph for a project root.
 * Returns {
 *   root, boundaries, cycles,
 *   nodes:  boundary nodes (documented architecture contract),
 *   edges:  boundary-level edges (dependency | ownership),
 *   items:  all typed knowledge-graph nodes (boundary, agents, file, tests, skill, standard),
 *   links:  typed index edges (governs, owns, requires, tested_by),
 *   warnings
 * }
 */
function buildGraph(root, config) {
  const ignore = config.ignore || [];

  // 1. Collect functionality boundaries: directories containing AGENTS.md.
  const files = walkFiles(root, root, ignore, []);
  const boundaryDirs = new Set();
  const contracts = {}; // relDir -> { text, parsed, source: relPath }
  const contractTexts = {}; // relDir -> raw text (for requires detection + hashing)

  for (const rel of files) {
    if (path.posix.basename(rel).toLowerCase() !== 'agents.md') continue;
    const dir = dirOf(rel);
    const abs = path.join(root, rel);
    const text = fs.readFileSync(abs, 'utf8');
    boundaryDirs.add(dir);
    contractTexts[dir] = text;
    contracts[dir] = { text, parsed: agents.parse(text), source: rel };
  }

  // Root is always a node.
  boundaryDirs.add('');

  const parentOf = (dir) => {
    if (dir === '') return null;
    let d = dir;
    for (;;) {
      d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '';
      if (boundaryDirs.has(d)) return d;
      if (d === '') return '';
    }
  };

  // 2. Boundary nodes (documented contract) — metadata stays minimal:
  //    id/type/parent/hash/flags + the documented fields. No prose.
  const nodes = [];
  for (const dir of [...boundaryDirs].sort(cmp)) {
    const c = contracts[dir];
    nodes.push({
      id: dir === '' ? '' : dir,
      path: dir === '' ? '.' : dir,
      name: dir === '' ? 'root' : path.posix.basename(dir),
      type: 'boundary',
      parent: parentOf(dir),
      hash: c ? hashContent(c.text) : null,
      has_local_contract: !!c,
      owners: c ? c.parsed.owners : [],
      flags: { has_local_contract: !!c },
      provenance: {
        kind: 'declared',
        source: c ? c.source : 'filesystem structure',
      },
    });
  }

  // 3. Read source files once: content hash + discovered edge scan.
  const sourceContents = {}; // rel -> text
  for (const rel of files) {
    if (!SOURCE_EXTS.has(path.posix.extname(rel))) continue;
    try {
      sourceContents[rel] = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      /* unreadable — skip */
    }
  }

  // 4. Typed index items (every node carries type/parent/hash/flags).
  const items = [];

  // 4a. Boundary nodes are typed items too (BOUNDARY is a node type).
  for (const n of nodes) items.push(n);

  // 4b. agents nodes — one per AGENTS.md contract.
  for (const dir of [...boundaryDirs].sort(cmp)) {
    const c = contracts[dir];
    if (!c) continue;
    items.push({
      id: c.source,
      type: 'agents',
      parent: dir,
      hash: hashContent(c.text),
      flags: {},
      provenance: { kind: 'declared', source: c.source },
    });
  }

  // 4c. files and tests.
  for (const rel of Object.keys(sourceContents).sort(cmp)) {
    const isTest = isTestPath(rel);
    const boundary = nearestBoundary(dirOf(rel), boundaryDirs);
    if (boundary === null) continue;
    items.push({
      id: rel,
      type: isTest ? 'test' : 'file',
      parent: boundary,
      hash: hashContent(sourceContents[rel]),
      flags: isTest ? { is_test: true } : {},
      provenance: { kind: 'discovered', source: 'filesystem structure' },
    });
  }

  // 4d. skill nodes — standard .agents/skills/ and ACC-managed .acc/config/skills/.
  for (const rel of files) {
    const m = rel.match(SKILL_PATH) || rel.match(SKILL_PATH_ACC);
    if (!m) continue;
    items.push({
      id: rel,
      type: 'skill',
      parent: null,
      name: m[1],
      hash: hashContent(fs.readFileSync(path.join(root, rel), 'utf8')),
      flags: {},
      provenance: { kind: 'declared', source: rel },
    });
  }

  // 4e. standard nodes — .acc/config/standards/<name>.md.
  for (const rel of files) {
    const m = rel.match(STANDARD_PATH);
    if (!m) continue;
    items.push({
      id: rel,
      type: 'standard',
      parent: null,
      name: m[1],
      hash: hashContent(fs.readFileSync(path.join(root, rel), 'utf8')),
      flags: {},
      provenance: { kind: 'declared', source: rel },
    });
  }

  items.sort((a, b) => cmp(a.id, b.id));

  // 5. Architecture edges (existing contract): dependency + ownership.
  function resolveBoundary(rel) {
    const clean = rel.replace(/\/+$/, '');
    if (boundaryDirs.has(clean)) return clean;
    let dir = clean;
    while (dir.includes('/')) {
      dir = dir.slice(0, dir.lastIndexOf('/'));
      if (boundaryDirs.has(dir)) return dir;
    }
    return boundaryDirs.has('') ? '' : null;
  }

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

  // 6. Discovered edges: source files referencing other boundaries by path.
  // A discovered edge that agrees with a declared one collapses into the
  // declared edge (declared facts win) — but the code backing is tracked
  // so drift detection can tell "declared AND implemented" from
  // "declared but no code references it" (documentation ahead of code).
  const codeBacked = new Set(); // `${from}\u0000${to}` pairs with a real reference
  for (const rel of Object.keys(sourceContents)) {
    const fromDir = nearestBoundary(dirOf(rel), boundaryDirs);
    if (fromDir === null) continue;
    const content = sourceContents[rel];
    for (const dir of boundaryDirs) {
      if (dir === fromDir || dir === '') continue;
      const re = new RegExp("(?<![.\\w'\"`])(?<!package\\.json )(?<!npm )" + escapeRe(dir) + "\\b(?![\\]|:])");
      if (re.test(content)) {
        codeBacked.add(`${fromDir}\u0000${dir}`);
        addEdge(fromDir, dir, 'dependency', {
          kind: 'discovered',
          source: `discovered reference in ${rel}`,
          detail: 'source reference',
        });
      }
    }
  }
  // Track which declared dependency edges have real code backing — a
  // direct reference to the declared target, or to any of its
  // sub-boundaries (declaring a dep on a parent covers its children).
  // Kept OUT of the edges themselves: edges carry only from/to/kind/
  // provenance (the graph is an index with minimal metadata). Exposed as
  // `codeBacked` pairs so drift detection can tell "declared AND
  // implemented" from "declared but no code references it".
  const codeBackedPairs = [];
  for (const e of edges) {
    if (e.kind !== 'dependency' || e.provenance.kind !== 'declared') continue;
    let backed = codeBacked.has(`${e.from}\u0000${e.to}`);
    if (!backed) {
      for (const key of codeBacked) {
        const sep = key.indexOf('\u0000');
        const from = key.slice(0, sep);
        const to = key.slice(sep + 1);
        if (from === e.from && to.startsWith(e.to + '/')) {
          backed = true;
          break;
        }
      }
    }
    if (backed) codeBackedPairs.push({ from: e.from, to: e.to });
  }
  codeBackedPairs.sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));

  // 7. Typed index links: governs / owns / requires / tested_by.
  const links = [];
  const seenLinks = new Set();
  function addLink(from, to, kind, provenance) {
    const key = `${from}\u0000${to}\u0000${kind}`;
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    links.push({ from, to, kind, provenance });
  }

  // governs: AGENTS.md → its boundary.
  for (const n of items) {
    if (n.type !== 'agents') continue;
    addLink(n.id, n.parent, 'governs', { kind: 'declared', source: n.id });
  }

  // owns: boundary → file/tests.
  for (const n of items) {
    if (n.type !== 'file' && n.type !== 'test') continue;
    addLink(n.parent, n.id, 'owns', { kind: 'discovered', source: 'filesystem structure' });
  }

  // requires: boundary → skill / standard referenced in its contract.
  const skillsByName = new Map(items.filter((n) => n.type === 'skill').map((n) => [n.name, n]));
  const standardsByName = new Map(items.filter((n) => n.type === 'standard').map((n) => [n.name, n]));
  for (const dir of boundaryDirs) {
    const c = contracts[dir];
    if (!c) continue;
    for (const [skillName, skill] of skillsByName) {
      if (wordIn(skillName, c.text)) {
        addLink(dir, skill.id, 'requires', { kind: 'declared', source: c.source, detail: 'Skill reference' });
      }
    }
    for (const [stdName, std] of standardsByName) {
      const pathRef = `.acc/config/standards/${stdName}`;
      if (c.text.includes(pathRef) || wordIn(stdName, c.text)) {
        addLink(dir, std.id, 'requires', { kind: 'declared', source: c.source, detail: 'Standard reference' });
      }
    }
  }

  // tested_by: file → tests (spec naming within the same boundary).
  const testItems = items.filter((n) => n.type === 'test');
  const fileItems = items.filter((n) => n.type === 'file');
  for (const t of testItems) {
    const tStem = testStem(t.id);
    for (const f of fileItems) {
      if (f.parent !== t.parent) continue;
      const fStem = fileStem(f.id);
      if (tStem === fStem) {
        addLink(f.id, t.id, 'tested_by', { kind: 'discovered', source: t.id, detail: 'test naming' });
      }
    }
  }

  // 8. Sort deterministically: from, to, kind, provenance order.
  const provOrder = { declared: 0, discovered: 1, inferred: 2, memory: 3 };
  const edgeCmp = (a, b) => {
    return (
      cmp(a.from, b.from) ||
      cmp(a.to, b.to) ||
      cmp(a.kind, b.kind) ||
      (provOrder[a.provenance.kind] || 0) - (provOrder[b.provenance.kind] || 0)
    );
  };
  edges.sort(edgeCmp);
  links.sort(edgeCmp);

  // 9. Detect cycles in declared dependencies.
  const declaredOnly = edges.filter((e) => e.kind === 'dependency' && e.provenance.kind === 'declared');
  const adj = {};
  for (const e of declaredOnly) {
    (adj[e.from] = adj[e.from] || []).push(e.to);
  }
  const cycles = findCycles(adj, boundaryDirs);

  return { root, nodes, edges, boundaries: [...boundaryDirs].sort(cmp), cycles, items, links, codeBacked: codeBackedPairs };
}

/**
 * Compact, queryable slice of the knowledge-graph index for a target
 * path. The slice is the "context router" output — the minimum the AI
 * needs, with an expansion budget (impact counts), never the whole repo.
 * Returns { scope, governed_by, owns, depends_on, dependents,
 *           tested_by, requires, impact }.
 */
function graphSlice(graph, target) {
  const clean = target.replace(/\/+$/, '');
  const cleanIsRoot = clean === '.' || clean === '';

  // Resolve the target to its owning scope boundary.
  let scope;
  let targetItem = null;
  if (cleanIsRoot) {
    scope = '';
  } else if (graph.nodes.some((n) => n.id === clean)) {
    scope = clean;
  } else {
    targetItem = graph.items.find((n) => n.id === clean) || null;
    if (targetItem) {
      scope = targetItem.parent === null || targetItem.parent === undefined ? '' : targetItem.parent;
    } else {
      // Directory without a contract: walk up to the nearest boundary.
      let d = clean;
      for (;;) {
        if (graph.nodes.some((n) => n.id === d)) { scope = d; break; }
        if (d === '') { scope = ''; break; }
        d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '';
      }
    }
  }

  // governed_by: contract chain root → scope (nearest file wins).
  const governedBy = [];
  const parts = scope === '' ? [] : scope.split('/');
  for (let i = 0; i <= parts.length; i++) {
    const dir = parts.slice(0, i).join('/');
    const b = graph.nodes.find((n) => n.id === dir || (dir === '' && n.id === ''));
    if (b && b.has_local_contract) {
      governedBy.push(b.id === '' ? 'AGENTS.md' : `${b.id}/AGENTS.md`);
    }
  }

  // owns: files and tests belonging to the scope boundary.
  const ownsFiles = [];
  const ownsTests = [];
  for (const n of graph.items) {
    if (n.parent !== scope) continue;
    if (n.type === 'file') ownsFiles.push(n.id);
    else if (n.type === 'test') ownsTests.push(n.id);
  }

  // depends_on / dependents (architecture edges).
  const dependsOn = graph.edges
    .filter((e) => e.from === scope && e.kind === 'dependency')
    .map((e) => ({ to: e.to === '' ? '.' : e.to, provenance_kind: e.provenance.kind }))
    .sort((a, b) => cmp(a.to, b.to));
  const dependents = graph.edges
    .filter((e) => e.to === scope && e.kind === 'dependency')
    .map((e) => ({ from: e.from === '' ? '.' : e.from, provenance_kind: e.provenance.kind }))
    .sort((a, b) => cmp(a.from, b.from));

  // tested_by: for a file target, the tests that cover it; for a
  // boundary, the tests it owns.
  let testedBy = [];
  if (targetItem && (targetItem.type === 'file' || targetItem.type === 'test')) {
    testedBy = graph.links
      .filter((l) => l.kind === 'tested_by' && l.from === targetItem.id)
      .map((l) => l.to);
  } else {
    testedBy = ownsTests.slice();
  }

  // requires: skills + standards linked from the scope contract.
  const skills = [];
  const standards = [];
  for (const l of graph.links) {
    if (l.kind !== 'requires' || l.from !== scope) continue;
    const t = graph.items.find((n) => n.id === l.to);
    if (!t) continue;
    if (t.type === 'skill') skills.push(t.name);
    else if (t.type === 'standard') standards.push(t.name);
  }

  // impact: scope + transitive dependents closure.
  const closure = [scope];
  const queue = [scope];
  const seen = new Set([scope]);
  while (queue.length) {
    const cur = queue.shift();
    for (const e of graph.edges) {
      if (e.to === cur && e.kind === 'dependency' && !seen.has(e.from)) {
        seen.add(e.from);
        closure.push(e.from);
        queue.push(e.from);
      }
    }
  }
  const closureSet = new Set(closure);
  let impactFiles = 0;
  let impactTests = 0;
  let impactContracts = 0;
  for (const n of graph.nodes) {
    if (closureSet.has(n.id) && n.has_local_contract) impactContracts++;
  }
  for (const n of graph.items) {
    if (!closureSet.has(n.parent)) continue;
    if (n.type === 'file') impactFiles++;
    else if (n.type === 'test') impactTests++;
  }

  return {
    scope: scope === '' ? '.' : scope,
    governed_by: governedBy,
    owns: { files: ownsFiles, tests: ownsTests },
    depends_on: dependsOn,
    dependents,
    tested_by: testedBy,
    requires: { skills: skills.sort(cmp), standards: standards.sort(cmp) },
    impact: { files: impactFiles, boundaries: closure.length, tests: impactTests, contracts: impactContracts },
  };
}

/** FNV-1a 32-bit content hash — cheap, deterministic, change-detection ready. */
function hashContent(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'h' + h.toString(16).padStart(8, '0');
}

/** Test files: directories (`tests/`, `test/`, `__tests__/`) or spec naming. */
function isTestPath(rel) {
  const segments = rel.split('/');
  if (segments.slice(0, -1).some((s) => TEST_DIR_SEGMENTS.has(s))) return true;
  return /(^|[-_.])(test|spec)([._-]|$)/i.test(fileStem(rel));
}

/** Basename without the last extension, e.g. 'token_test.rs' → 'token_test'. */
function fileStem(rel) {
  const base = path.posix.basename(rel);
  return base.replace(/\.[^.]+$/, '');
}

/** Stem of a `test` filename minus its marker, e.g. 'token_test.rs' → 'token'. */
function testStem(rel) {
  return fileStem(rel).replace(/[-_.]?(test|spec)$/i, '');
}

/** Word-boundary presence check (used for skill/standard references). */
function wordIn(word, text) {
  const re = new RegExp('(^|[^\\w])' + escapeRe(word) + '($|[^\\w])');
  return re.test(text);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const seen = new Set();
  return cycles.filter((c) => {
    const key = c.join('>');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { buildGraph, graphSlice, hashContent, SOURCE_EXTS, NODE_TYPES, EDGE_KINDS };
