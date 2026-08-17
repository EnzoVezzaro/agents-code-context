'use strict';

/**
 * Config control-plane tests — every `.acc/config/config.yaml` knob is
 * wired into the commands that should honor it (deterministic and
 * intelligence tiers alike), so the whole ACC system is controllable
 * from the config folder:
 *
 *   - discover.default_kinds   → `acc discover` default kinds
 *   - memory.warn_bytes        → ACC054 in `acc check` + `acc memory add` warn
 *   - memory.timestamp_format  → `acc memory add` entry timestamps
 *   - forbidden_deps           → ACC024 / ACC025 / ACC065 in `acc check`
 *   - ownership.strict         → ACC030 fail-fast vs collect-all
 *   - context.default_include  → `acc context` default sections
 *   - tools.auto_discover / tools.plugins → `acc tools` listing
 */

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ACC = path.join(__dirname, '..', 'bin', 'acc.js');

function makeRepo(configYaml, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-cfg-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  if (configYaml) {
    fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, '.acc', 'config', 'config.yaml'), configYaml);
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function run(args, root) {
  return spawnSync(process.execPath, [ACC, ...args], { cwd: root, encoding: 'utf8' });
}

const CFG = (extra) => `schema_version: 1\n${extra}\n`;

test('discover.default_kinds: config narrows the default suggestion kinds', () => {
  const root = makeRepo(
    CFG('discover:\n  default_kinds:\n    - missing-dependency\n'),
    {
      'src/auth/AGENTS.md': '# auth\n\n## Dependencies\n\n- src/database\n',
      'src/auth/token.rs': '// uses src/database and src/queue\n',
      'src/database/AGENTS.md': '# database\n',
      'src/queue/AGENTS.md': '# queue\n',
      'src/extra/thing.rs': 'fn x() {}\n', // no contract → missing-contract kind
    },
  );
  // Default (no --kind): only missing-dependency suggestions appear
  // (auth → queue is discovered but not declared; src/extra stays out).
  const d = run(['discover', '--json'], root);
  assert.equal(d.status, 0, d.stderr);
  const kinds = new Set(JSON.parse(d.stdout).result.suggestions.map((s) => s.kind));
  assert.deepEqual([...kinds], ['missing-dependency']);
  // --kind still overrides the config.
  const o = run(['discover', '--kind', 'missing-contract', '--json'], root);
  assert.equal(o.status, 0, o.stderr);
  const okinds = new Set(JSON.parse(o.stdout).result.suggestions.map((s) => s.kind));
  assert.deepEqual([...okinds], ['missing-contract']);
});

test('memory.warn_bytes: acc check emits ACC054 over the threshold', () => {
  const big = 'x'.repeat(100);
  const root = makeRepo(CFG('memory:\n  warn_bytes: 50\n'), {
    'src/auth/AGENTS.md': '# auth\n',
    'src/auth/.acc-memory.md': big,
  });
  const r = run(['check', '--json'], root);
  assert.equal(r.status, 0, r.stderr);
  const codes = JSON.parse(r.stdout).result.diagnostics.map((x) => x.code);
  assert.ok(codes.includes('ACC054'), `expected ACC054, got ${codes.join(',')}`);
});

test('memory.warn_bytes: acc memory add warns when the file exceeds the threshold', () => {
  const root = makeRepo(CFG('memory:\n  warn_bytes: 5\n'));
  const r = run(['memory', 'add', '.', 'long entry text beyond five bytes', '--json'], root);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.result.warn && out.result.warn.includes('memory.warn_bytes'), 'add reports the threshold warning');
});

test('memory.timestamp_format: date entries use YYYY-MM-DD, rfc3339 the default', () => {
  const root = makeRepo(CFG('memory:\n  timestamp_format: date\n'));
  const r = run(['memory', 'add', '.', 'note'], root);
  assert.equal(r.status, 0, r.stderr);
  const content = fs.readFileSync(path.join(root, '.acc-memory.md'), 'utf8');
  assert.match(content, /^## \d{4}-\d{2}-\d{2}$/m, 'date format entry heading');
});

test('forbidden_deps: a matching edge emits ACC024', () => {
  const root = makeRepo(
    CFG('forbidden_deps:\n  - from: "src/auth"\n    to: "src/ui"\n'),
    {
      'src/auth/AGENTS.md': '# auth\n\n## Dependencies\n\n- src/database\n',
      'src/auth/token.rs': '// uses src/ui\n',
      'src/ui/AGENTS.md': '# ui\n',
      'src/database/AGENTS.md': '# database\n',
    },
  );
  const r = run(['check', '--json'], root);
  // ACC024 is an error → check fails with exit 1.
  assert.equal(r.status, 1, 'ACC024 is an error, so acc check exits 1');
  const diags = JSON.parse(r.stdout).result.diagnostics;
  const acc024 = diags.filter((x) => x.code === 'ACC024');
  assert.ok(acc024.length >= 1, `expected ACC024, got ${diags.map((x) => x.code).join(',')}`);
  assert.ok(acc024.some((x) => x.message.includes('src/auth') && x.message.includes('src/ui')));
});

test('forbidden_deps: an inert rule emits ACC025, a missing path ACC065', () => {
  const root = makeRepo(
    CFG('forbidden_deps:\n  - from: "src/auth"\n    to: "src/never"\n'),
    {
      'src/auth/AGENTS.md': '# auth\n',
      'src/auth/token.rs': '// standalone\n',
    },
  );
  const r = run(['check', '--json'], root);
  assert.equal(r.status, 0, r.stderr);
  const diags = JSON.parse(r.stdout).result.diagnostics;
  const codes = diags.map((x) => x.code);
  assert.ok(codes.includes('ACC065'), `expected ACC065 (unknown path), got ${codes.join(',')}`);
  assert.ok(!codes.includes('ACC025'), 'a rule with a missing path is ACC065, not inert');
  // Now with both paths existing but no matching edge → ACC025.
  const root2 = makeRepo(
    CFG('forbidden_deps:\n  - from: "src/auth"\n    to: "src/ui"\n'),
    {
      'src/auth/AGENTS.md': '# auth\n',
      'src/ui/AGENTS.md': '# ui\n',
    },
  );
  const r2 = run(['check', '--json'], root2);
  const codes2 = JSON.parse(r2.stdout).result.diagnostics.map((x) => x.code);
  assert.ok(codes2.includes('ACC025'), `expected ACC025 (inert rule), got ${codes2.join(',')}`);
});

test('ownership.strict: true fails fast (one ACC030), false collects all', () => {
  const mk = (strict) =>
    makeRepo(CFG(`ownership:\n  strict: ${strict}\n`), {
      'src/a/AGENTS.md': '# a\n\n## Ownership\n\nOwner: src/b\n',
      'src/b/AGENTS.md': '# b\n\n## Ownership\n\nOwner: src/a\n',
      // Root claims both too, forcing two independent conflicts.
      'AGENTS.md': '# app\n\n## Ownership\n\nOwner: src/a\n\nOwner: src/b\n',
    });
  const loose = JSON.parse(run(['check', '--json'], mk(false)).stdout).result.diagnostics.filter((x) => x.code === 'ACC030');
  const strict = JSON.parse(run(['check', '--json'], mk(true)).stdout).result.diagnostics.filter((x) => x.code === 'ACC030');
  assert.ok(loose.length > strict.length, `strict stops early (${strict.length} vs ${loose.length})`);
  assert.ok(loose.length >= 1, 'collect-all finds at least one conflict');
  assert.equal(strict.length, 1, 'fail-fast stops at the first conflict');
});

test('context.default_include: config narrows the default sections', () => {
  const root = makeRepo(CFG('context:\n  default_include:\n    - hierarchy\n'), {
    'src/auth/AGENTS.md': '# auth\n\n## Constraints\n\n- keep it simple\n',
  });
  const r = run(['context', 'src/auth', '--json'], root);
  assert.equal(r.status, 0, r.stderr);
  const sections = JSON.parse(r.stdout).result.sections;
  assert.deepEqual(Object.keys(sections), ['hierarchy']);
  // --include still overrides.
  const o = run(['context', 'src/auth', '--include', 'contract', '--json'], root);
  assert.deepEqual(Object.keys(JSON.parse(o.stdout).result.sections), ['contract']);
});

test('tools.auto_discover + plugins: config gates the acc tools listing', () => {
  const root = makeRepo(
    CFG('tools:\n  auto_discover: false\n  plugins:\n    enabled: true\n    directory: ".acc/config/tools"\n'),
  );
  fs.mkdirSync(path.join(root, '.acc', 'config', 'tools', 'docker'), { recursive: true });
  const r = run(['tools', '--json'], root);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout).result;
  assert.deepEqual(out.detected, [], 'auto_discover: false → no package.json scripts');
  assert.deepEqual(out.plugins.map((p) => p.name), ['docker'], 'plugins come from the configured directory');
  // Disabling plugins hides them.
  const root2 = makeRepo(CFG('tools:\n  plugins:\n    enabled: false\n'));
  fs.mkdirSync(path.join(root2, '.acc', 'config', 'tools', 'docker'), { recursive: true });
  const r2 = run(['tools', '--json'], root2);
  assert.deepEqual(JSON.parse(r2.stdout).result.plugins, [], 'plugins.enabled: false → none listed');
});
