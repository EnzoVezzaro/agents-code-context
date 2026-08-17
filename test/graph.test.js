'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildGraph } = require('../lib/core/graph');
const { load } = require('../lib/core/config');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-graph-'));
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'database'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'AGENTS.md'),
    '# root\n\n## Purpose\n\nProject root.\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'AGENTS.md'),
    '# src\n\n## Purpose\n\nSource tree.\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Purpose\n\nAuthentication.\n\n## Ownership\n\nOwner: auth-team\n\n## Dependencies\n\n- src/database\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'token.rs'),
    '// uses src/database and src/logging\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'database', 'AGENTS.md'),
    '# database\n\n## Purpose\n\nPersistence.\n\n## Ownership\n\nOwner: db-team\n',
  );
  fs.mkdirSync(path.join(root, 'src', 'logging'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'logging', 'AGENTS.md'),
    '# logging\n\n## Purpose\n\nLogging.\n',
  );
  return root;
}

test('derives functionality boundary nodes with provenance', () => {
  const root = makeFixture();
  const { config } = load(root);
  const graph = buildGraph(root, config);

  const ids = graph.nodes.map((n) => n.id);
  assert.ok(ids.includes(''));
  assert.ok(ids.includes('src'));
  assert.ok(ids.includes('src/auth'));
  assert.ok(ids.includes('src/database'));

  const auth = graph.nodes.find((n) => n.id === 'src/auth');
  assert.equal(auth.has_local_contract, true);
  assert.deepEqual(auth.owners, ['auth-team']);
  assert.equal(auth.provenance.kind, 'declared');
});

test('declared and discovered edges that agree collapse to one declared edge', () => {
  const root = makeFixture();
  const { config } = load(root);
  const graph = buildGraph(root, config);

  // Declared src/auth → src/database agrees with discovery: one edge, declared wins.
  const authToDb = graph.edges.filter((e) => e.from === 'src/auth' && e.to === 'src/database');
  assert.equal(authToDb.length, 1);
  assert.equal(authToDb[0].provenance.kind, 'declared');
});

test('undeclared discoveries surface as discovered edges', () => {
  const root = makeFixture();
  const { config } = load(root);
  const graph = buildGraph(root, config);

  // src/auth references src/logging in code but does not declare it.
  const authToLogging = graph.edges.find((e) => e.from === 'src/auth' && e.to === 'src/logging');
  assert.ok(authToLogging);
  assert.equal(authToLogging.provenance.kind, 'discovered');
});

test('edges are deterministically sorted', () => {
  const root = makeFixture();
  const { config } = load(root);
  const a = buildGraph(root, config);
  const b = buildGraph(root, config);
  assert.deepEqual(JSON.stringify(a.edges), JSON.stringify(b.edges));
});

test('npm-scripts field and object keys are not discovered references', () => {
  const root = makeFixture();
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'scripts', 'AGENTS.md'),
    '# scripts\n\n## Purpose\n\nDeveloper tooling.\n',
  );
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'pkg.cjs'),
    '// tools from package.json scripts\nconst pkg = JSON.stringify({ scripts: { build: \'npm run build\' } });\n',
  );
  const { config } = load(root);
  const graph = buildGraph(root, config);
  // Neither the npm `scripts` field nor an object key is a reference to
  // the scripts/ boundary.
  assert.ok(!graph.edges.some((e) => e.to === 'scripts' && e.provenance.kind === 'discovered'));
});

test('detects declared dependency cycles', () => {
  const root = makeFixture();
  fs.writeFileSync(
    path.join(root, 'src', 'database', 'AGENTS.md'),
    '# database\n\n## Dependencies\n\n- src/auth\n',
  );
  const { config } = load(root);
  const graph = buildGraph(root, config);
  assert.ok(graph.cycles.length >= 1);
});
