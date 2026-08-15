'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ACC = path.join(__dirname, '..', 'bin', 'acc.js');

function run(args, cwd) {
  return execFileSync(process.execPath, [ACC, ...args], { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-e2e-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Purpose\n\nDemo app.\n');
  return root;
}

test('acc --version prints a version', () => {
  const out = run(['--version'], process.cwd());
  assert.match(out, /^acc \d+\.\d+\.\d+/);
});

test('acc init scaffolds .acc/config and prints a template when no AGENTS.md', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-'));
  const out = run(['init'], root);
  assert.ok(out.includes('Created .acc/config/config.yaml'));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'config.yaml')));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'agents')));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'workflows')));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'standards')));
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.acc-memory.md'));
});

test('acc check is deterministic across runs', () => {
  const root = makeRepo();
  const a = run(['check', '--json'], root);
  const b = run(['check', '--json'], root);
  assert.equal(a, b);
  const parsed = JSON.parse(a);
  assert.equal(parsed.command, 'check');
  assert.equal(parsed.schema_version, 1);
  assert.ok(Array.isArray(parsed.result.diagnostics));
});

test('acc graph emits nodes and edges', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Dependencies\n\n- src/database\n',
  );
  fs.mkdirSync(path.join(root, 'src', 'database'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'database', 'AGENTS.md'), '# database\n');
  fs.writeFileSync(path.join(root, 'src', 'auth', 'mod.rs'), '// references src/database\n');

  const out = run(['graph'], root);
  assert.ok(out.includes('src/auth'));
  assert.ok(out.includes('src/database'));

  const jsonOut = JSON.parse(run(['graph', '--json'], root));
  assert.equal(jsonOut.result.nodes.length >= 3, true);
  assert.ok(jsonOut.result.edges.some((e) => e.from === 'src/auth' && e.to === 'src/database'));
});

test('acc context emits provenance-tagged sections', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Purpose\n\nAuth.\n\n## Dependencies\n\n- src/database\n',
  );
  fs.mkdirSync(path.join(root, 'src', 'database'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'database', 'AGENTS.md'), '# database\n');

  const out = run(['context', 'src/auth'], root);
  assert.ok(out.includes('## Hierarchy'));
  assert.ok(out.includes('## Contract'));
  assert.ok(out.includes('Source: src/auth/AGENTS.md'));

  const jsonOut = JSON.parse(run(['context', 'src/auth', '--json'], root));
  assert.ok(jsonOut.result.sections.contract.source === 'src/auth/AGENTS.md');
});

test('acc memory add/show/clear round-trips', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), '# auth\n');

  run(['memory', 'add', 'src/auth', 'token validation is non-reentrant'], root);
  const shown = run(['memory', 'show', 'src/auth'], root);
  assert.ok(shown.includes('token validation is non-reentrant'));

  run(['memory', 'clear', 'src/auth', '--force'], root);
  const cleared = run(['memory', 'show', 'src/auth'], root);
  assert.ok(cleared.includes('No memory yet'));
});

test('acc document generates a template (dry-run)', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'metrics'), { recursive: true });
  const out = run(['document', 'src/metrics'], root);
  assert.ok(out.includes('## Purpose'));
  assert.ok(out.includes('## Dependencies'));
  assert.equal(fs.existsSync(path.join(root, 'src', 'metrics', 'AGENTS.md')), false);

  run(['document', 'src/metrics', '--apply'], root);
  assert.equal(fs.existsSync(path.join(root, 'src', 'metrics', 'AGENTS.md')), true);
});

test('acc inspect reports owners and memory', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Ownership\n\nOwner: auth-team\n',
  );
  const out = run(['inspect', 'src/auth'], root);
  assert.ok(out.includes('Owners: [auth-team]'));
});
