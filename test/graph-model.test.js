'use strict';

/**
 * The graph philosophy (see the context-graph design):
 *
 *   - The graph is an INDEX of relationships, not a knowledge store.
 *     Nodes and edges never carry prose, descriptions, documentation,
 *     or knowledge — those live in AGENTS.md / SKILL.md / .acc-memory.md
 *     and are read from the filesystem on demand.
 *   - Node metadata is minimal: id, type, parent, hash, flags (+ the
 *     documented provenance tag). No opaque IDs — id is the canonical
 *     POSIX path.
 *   - Edges are minimal: from, to, kind (+ provenance). Nothing else.
 *   - The graph is derived, deterministic, and ephemeral (in-memory).
 *   - The graph is queried, not read: slice() answers "what owns this",
 *     "what governs this", "what does this depend on", "what depends on
 *     this", "what tests this", "what skills/standards apply", "what is
 *     the impact".
 *
 * These tests lock that contract so the graph never drifts back into a
 * repository-duplicating knowledge base.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildGraph, graphSlice, NODE_TYPES, EDGE_KINDS } = require('../lib/core/graph');
const { load } = require('../lib/core/config');

/** Prose-carrying keys that MUST never appear on graph nodes or edges. */
const PROSE_KEYS = ['purpose', 'description', 'contents', 'documentation', 'knowledge', 'instructions'];

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-graph-model-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };

  write('AGENTS.md', '# app\n\n## Purpose\n\nRoot app.\n');
  write('src/AGENTS.md', '# src\n\n## Purpose\n\nSource tree.\n');
  write(
    'src/auth/AGENTS.md',
    [
      '# auth',
      '## Purpose',
      'Authentication.',
      '## Ownership',
      'Owner: auth-team',
      '## Dependencies',
      '- src/database',
      '## Skills',
      '- oauth',
      '## Standards',
      'See .acc/config/standards/idempotency',
    ].join('\n'),
  );
  write('src/auth/token.rs', '// token implementation\n');
  write('src/auth/token_test.rs', '// tests for token.rs\n');
  write('src/auth/session_test.ts', '// tests for session (no session.rs — naming only)\n');
  write(
    'src/database/AGENTS.md',
    '# database\n\n## Purpose\n\nPersistence.\n',
  );
  write(
    'src/app/AGENTS.md',
    '# app\n\n## Purpose\n\nApp layer.\n\n## Dependencies\n\n- src/auth\n',
  );
  write('src/app/service.rs', '// uses src/auth\n');
  write('.agents/skills/oauth/SKILL.md', '---\nname: oauth\n---\n\nHow to integrate OAuth.\n');
  write('.acc/config/standards/idempotency.md', '# Idempotency standard\n\nWrite idempotent handlers.\n');
  return root;
}

function buildFixture() {
  const root = makeFixture();
  const { config } = load(root);
  return buildGraph(root, config);
}

test('the graph is an index, not a knowledge store', () => {
  const graph = buildFixture();
  for (const n of graph.nodes) {
    for (const k of PROSE_KEYS) {
      assert.ok(!(k in n), `node ${n.id} must not carry prose key '${k}'`);
    }
    assert.ok(!('text' in n) && !('raw' in n), `node ${n.id} must not carry raw content`);
  }
  for (const n of graph.items) {
    for (const k of PROSE_KEYS) {
      assert.ok(!(k in n), `item ${n.id} must not carry prose key '${k}'`);
    }
  }
  for (const e of graph.edges) {
    assert.deepEqual(Object.keys(e).sort(), ['from', 'kind', 'provenance', 'to'], 'edges carry only from/to/kind/provenance');
  }
  for (const l of graph.links) {
    assert.deepEqual(Object.keys(l).sort(), ['from', 'kind', 'provenance', 'to'], 'links carry only from/to/kind/provenance');
  }
});

test('every node carries minimal metadata: id, type, parent, hash, flags, provenance', () => {
  const graph = buildFixture();
  for (const n of graph.nodes) {
    assert.ok(typeof n.id === 'string', 'id is the canonical path');
    assert.equal(n.type, 'boundary', `node ${n.id} is a boundary`);
    assert.ok('parent' in n, `node ${n.id} has a parent`);
    assert.ok('hash' in n, `node ${n.id} has a content hash`);
    assert.ok('flags' in n, `node ${n.id} has flags`);
    assert.ok(n.provenance && typeof n.provenance.kind === 'string', `node ${n.id} carries provenance`);
  }
  for (const n of graph.items) {
    assert.ok(NODE_TYPES.includes(n.type), `item ${n.id} has a known type (${n.type})`);
    // Canonical id: POSIX path; '' is reserved for the root boundary.
    assert.ok(typeof n.id === 'string' && (n.id === '' || n.id.length > 0), `item ${n.id} has a canonical id`);
    assert.ok('parent' in n && 'hash' in n && 'flags' in n, `item ${n.id} carries minimal metadata`);
    assert.ok(n.provenance && n.provenance.kind, `item ${n.id} carries provenance`);
  }
});

test('node types: boundary, agents, file, test, skill, standard are derived', () => {
  const graph = buildFixture();
  const byType = {};
  for (const n of graph.items) (byType[n.type] = byType[n.type] || []).push(n.id);

  assert.ok(byType.boundary.includes(''), 'root boundary');
  assert.ok(byType.boundary.includes('src/auth'), 'src/auth boundary');
  assert.ok(byType.agents.includes('AGENTS.md'), 'root agents node');
  assert.ok(byType.agents.includes('src/auth/AGENTS.md'), 'src/auth agents node');
  assert.ok(byType.file.includes('src/auth/token.rs'), 'source file node');
  assert.ok(byType.test.includes('src/auth/token_test.rs'), 'test node (naming convention)');
  assert.ok(byType.test.includes('src/auth/session_test.ts'), 'test node (.test convention)');
  assert.ok(byType.skill.includes('.agents/skills/oauth/SKILL.md'), 'skill node');
  assert.ok(byType.standard.includes('.acc/config/standards/idempotency.md'), 'standard node');

  // Only boundaries appear in the documented `nodes` contract.
  for (const n of graph.nodes) assert.equal(n.type, 'boundary');
});

test('boundary nodes resolve parent and inherited-contract flags', () => {
  const graph = buildFixture();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  assert.equal(byId.get('').parent, null);
  assert.equal(byId.get('src').parent, '');
  assert.equal(byId.get('src/auth').parent, 'src');
  assert.equal(byId.get('src/auth').flags.has_local_contract, true);
});

test('hash is content-derived and deterministic', () => {
  const graph = buildFixture();
  const authFile = graph.items.find((n) => n.id === 'src/auth/token.rs');
  assert.ok(authFile.hash, 'file nodes carry a content hash');

  const again = buildFixture();
  const authFile2 = again.items.find((n) => n.id === 'src/auth/token.rs');
  assert.equal(authFile2.hash, authFile.hash, 'same content → same hash');

  const root2 = makeFixture();
  fs.writeFileSync(path.join(root2, 'src/auth/token.rs'), '// changed\n');
  const { config } = load(root2);
  const changed = buildGraph(root2, config);
  const authFile3 = changed.items.find((n) => n.id === 'src/auth/token.rs');
  assert.notEqual(authFile3.hash, authFile.hash, 'changed content → different hash');
});

test('edge kinds: governs, owns, requires, tested_by are derived', () => {
  const graph = buildFixture();
  const kind = (k) => graph.links.filter((l) => l.kind === k);

  // governs: AGENTS.md → its boundary.
  const governs = kind('governs');
  assert.ok(governs.some((l) => l.from === 'src/auth/AGENTS.md' && l.to === 'src/auth'));
  assert.ok(governs.some((l) => l.from === 'AGENTS.md' && l.to === ''));
  for (const l of governs) assert.equal(l.provenance.kind, 'declared');

  // owns: boundary → file/test.
  const owns = kind('owns');
  assert.ok(owns.some((l) => l.from === 'src/auth' && l.to === 'src/auth/token.rs'));
  assert.ok(owns.some((l) => l.from === 'src/auth' && l.to === 'src/auth/token_test.rs'));
  for (const l of owns) assert.equal(l.provenance.kind, 'discovered');

  // requires: boundary → skill / standard (referenced from the contract).
  const requires = kind('requires');
  assert.ok(requires.some((l) => l.from === 'src/auth' && l.to === '.agents/skills/oauth/SKILL.md'));
  assert.ok(requires.some((l) => l.from === 'src/auth' && l.to === '.acc/config/standards/idempotency.md'));
  for (const l of requires) assert.equal(l.provenance.kind, 'declared');

  // tested_by: file → test (test naming within the same boundary).
  const testedBy = kind('tested_by');
  assert.ok(testedBy.some((l) => l.from === 'src/auth/token.rs' && l.to === 'src/auth/token_test.rs'));
});

test('declared boundary edges (dependency/ownership) remain the architecture contract', () => {
  const graph = buildFixture();
  // src/auth → src/database declared; src/app → src/auth declared.
  assert.ok(graph.edges.some((e) => e.from === 'src/auth' && e.to === 'src/database' && e.kind === 'dependency' && e.provenance.kind === 'declared'));
  assert.ok(graph.edges.some((e) => e.from === 'src/app' && e.to === 'src/auth' && e.kind === 'dependency'));
});

test('slice answers "what governs this" (nearest contract chain)', () => {
  const graph = buildFixture();
  const slice = graphSlice(graph, 'src/auth');
  assert.deepEqual(slice.governed_by, ['AGENTS.md', 'src/AGENTS.md', 'src/auth/AGENTS.md']);
});

test('slice answers "what owns this"', () => {
  const graph = buildFixture();
  const slice = graphSlice(graph, 'src/auth');
  assert.deepEqual(slice.owns.files.sort(), ['src/auth/token.rs']);
  assert.deepEqual(slice.owns.tests.sort(), ['src/auth/session_test.ts', 'src/auth/token_test.rs']);
});

test('slice answers "what does this depend on" and "what depends on this"', () => {
  const graph = buildFixture();
  const slice = graphSlice(graph, 'src/auth');
  assert.deepEqual(slice.depends_on, [{ to: 'src/database', provenance_kind: 'declared' }]);
  assert.deepEqual(slice.dependents, [{ from: 'src/app', provenance_kind: 'declared' }]);
});

test('slice answers "what tests this" for a boundary and for a file', () => {
  const graph = buildFixture();
  const boundarySlice = graphSlice(graph, 'src/auth');
  assert.deepEqual(boundarySlice.tested_by.sort(), ['src/auth/session_test.ts', 'src/auth/token_test.rs']);

  const fileSlice = graphSlice(graph, 'src/auth/token.rs');
  assert.equal(fileSlice.scope, 'src/auth');
  assert.deepEqual(fileSlice.tested_by, ['src/auth/token_test.rs']);
});

test('slice answers "what skills and standards apply"', () => {
  const graph = buildFixture();
  const slice = graphSlice(graph, 'src/auth');
  assert.deepEqual(slice.requires.skills, ['oauth']);
  assert.deepEqual(slice.requires.standards, ['idempotency']);
});

test('slice reports the impact budget (files, boundaries, tests, contracts)', () => {
  const graph = buildFixture();
  const slice = graphSlice(graph, 'src/auth');
  // Closure: src/auth + its dependent src/app.
  assert.equal(slice.impact.files, 2, 'token.rs + service.rs');
  assert.equal(slice.impact.boundaries, 2, 'src/auth + src/app');
  assert.equal(slice.impact.tests, 2, 'token_test.rs + session_test.ts');
  assert.equal(slice.impact.contracts, 2, 'src/auth + src/app have local contracts');
});

test('slice resolves file targets and unknown dirs to their owning boundary', () => {
  const graph = buildFixture();
  assert.equal(graphSlice(graph, 'src/auth/token.rs').scope, 'src/auth');
  assert.equal(graphSlice(graph, 'src/auth/token_test.rs').scope, 'src/auth');
  // A directory without a contract inherits from the nearest boundary.
  fs.mkdirSync(path.join(graph.root, 'src', 'auth', 'sub'));
  assert.equal(graphSlice(graph, 'src/auth/sub').scope, 'src/auth');
  assert.equal(graphSlice(graph, '.').scope, '.');
});

test('the full typed index is deterministic across runs', () => {
  const a = buildFixture();
  const b = buildFixture();
  assert.equal(JSON.stringify(a.items), JSON.stringify(b.items));
  assert.equal(JSON.stringify(a.links), JSON.stringify(b.links));
  assert.equal(JSON.stringify(graphSlice(a, 'src/auth')), JSON.stringify(graphSlice(b, 'src/auth')));
});

test('edge and node kind sets are exported and closed', () => {
  assert.deepEqual(NODE_TYPES, ['boundary', 'agents', 'file', 'test', 'skill', 'standard']);
  assert.deepEqual(EDGE_KINDS, ['dependency', 'ownership', 'governs', 'owns', 'requires', 'tested_by']);
});
