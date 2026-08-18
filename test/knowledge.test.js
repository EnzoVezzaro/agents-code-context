'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildGraph } = require('../lib/core/graph');
const { check } = require('../lib/core/diagnostics');
const { show: memoryShow, add: memoryAdd } = require('../lib/core/memory');
const { load } = require('../lib/core/config');

const CLI = path.join(__dirname, '..', 'bin', 'acc.js');

function countEntries(contents) {
  const matches = contents.match(/^## /gm);
  return matches ? matches.length : 0;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-graph-knowledge-'));
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'db'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'AGENTS.md'),
    '# root\n\n## Purpose\n\nProject root.\n\n## Dependencies\n\n- src/auth\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'AGENTS.md'),
    '# src\n\n## Purpose\n\nSource tree.\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Purpose\n\nAuthentication.\n\n## Ownership\n\nOwner: auth-team\n\n## Dependencies\n\n- src/db\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'index.ts'),
    'import { query } from "../db";\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'db', 'AGENTS.md'),
    '# db\n\n## Purpose\n\nDatabase.\n\n## Ownership\n\nOwner: db-team\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'db', 'index.ts'),
    'export function query() { return {}; }\n',
  );
  return root;
}

// ---- graph --json includes enriched nodes ----

test('acc graph --json includes diagnostics, memory, and edge counts per node', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.command, 'graph');
  assert.ok(parsed.result.summary);

  for (const node of parsed.result.nodes) {
    assert.ok(Array.isArray(node.diagnostics), `${node.id}: diagnostics is array`);
    assert.ok(typeof node.memory.exists === 'boolean', `${node.id}: memory.exists is boolean`);
    assert.ok(typeof node.memory.size === 'number', `${node.id}: memory.size is number`);
    assert.ok(typeof node.memory.entries === 'number', `${node.id}: memory.entries is number`);
    assert.ok(typeof node.edges.total === 'number', `${node.id}: edges.total is number`);
    assert.ok(typeof node.edges.inbound === 'number', `${node.id}: edges.inbound is number`);
    assert.ok(typeof node.edges.outbound === 'number', `${node.id}: edges.outbound is number`);
  }
});

test('acc graph --json summary includes diagnostics, memory, drift, engine state', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  const parsed = JSON.parse(out);
  const s = parsed.result.summary;
  assert.ok(typeof s.boundaries === 'number');
  assert.ok(typeof s.diagnostics.total === 'number');
  assert.ok(typeof s.diagnostics.errors === 'number');
  assert.ok(typeof s.diagnostics.warnings === 'number');
  assert.ok(typeof s.diagnostics.infos === 'number');
  assert.ok(typeof s.edges.total === 'number');
  assert.ok(typeof s.memory.with_memory === 'number');
  assert.ok(typeof s.memory.without_memory === 'number');
  assert.ok(typeof s.drift_report === 'boolean');
});

// ---- scoped graph includes enriched data ----

test('acc graph [scope] --json returns scoped nodes with diagnostics', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', 'src/auth', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.result.scope, 'src/auth');
  const authNode = parsed.result.nodes.find((n) => n.id === 'src/auth');
  assert.ok(authNode);
  assert.ok(Array.isArray(authNode.diagnostics));
  assert.ok(typeof authNode.memory.exists === 'boolean');
  assert.ok(typeof authNode.edges.total === 'number');
});

// ---- scoped graph text shows enriched output ----

test('acc graph [scope] text shows diagnostics and memory', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', 'src/auth', '--format', 'text'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.ok(out.includes('Summary:'));
  assert.ok(out.includes('Diagnostics:'));
  assert.ok(out.includes('Memory:'));
  assert.ok(out.includes('Nodes:'));
});

// ---- memory tracking in graph nodes ----

test('graph nodes track memory state per boundary', () => {
  const root = makeFixture();
  memoryAdd(root, 'src/auth', 'Auth knowledge.', { timestamp_format: 'date' });

  const out = execFileSync(process.execPath, [CLI, 'graph', 'src/auth', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  const parsed = JSON.parse(out);
  const authNode = parsed.result.nodes.find((n) => n.id === 'src/auth');
  assert.ok(authNode);
  assert.equal(authNode.memory.exists, true);
  assert.ok(authNode.memory.size > 0);
  assert.equal(authNode.memory.entries, 1);
});

// ---- countEntries helper ----

test('countEntries counts ## headers', () => {
  assert.equal(countEntries('## 2024-01-01\n\nEntry one.\n\n## 2024-01-02\n\nEntry two.\n'), 2);
  assert.equal(countEntries('No entries here.\n'), 0);
  assert.equal(countEntries(''), 0);
});

// ---- unscoped graph includes summary ----

test('acc graph (unscoped) text includes summary with diagnostics count', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', '--format', 'text'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.ok(out.includes('Summary:'));
  assert.ok(out.includes('boundary'));
  assert.ok(out.includes('edge'));
  assert.ok(out.includes('Diagnostics:'));
  assert.ok(out.includes('Memory:'));
});

// ---- existing graph tests still pass (mermaid, dot, nodes-only) ----

test('acc graph --format mermaid still works', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', '--format', 'mermaid'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.ok(out.includes('graph LR'));
});

test('acc graph --format dot still works', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', '--format', 'dot'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.ok(out.includes('digraph acc'));
});

test('acc graph --nodes omits edges', () => {
  const root = makeFixture();
  const out = execFileSync(process.execPath, [CLI, 'graph', '--format', 'text', '--nodes'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.ok(out.includes('Nodes:'));
  assert.ok(!out.includes('Edges:'));
});

// ---- error cases still work ----

test('acc graph exits 2 for unknown scope', () => {
  const root = makeFixture();
  try {
    execFileSync(process.execPath, [CLI, 'graph', 'nonexistent'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.ok(err.status === 2);
  }
});

test('acc graph exits 2 for unknown option', () => {
  const root = makeFixture();
  try {
    execFileSync(process.execPath, [CLI, 'graph', '--bogus'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.ok(err.status === 2);
  }
});
