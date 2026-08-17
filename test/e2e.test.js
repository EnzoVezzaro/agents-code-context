'use strict';

/**
 * End-to-end: the full ACC lifecycle on a fresh repository, exercised
 * through the real CLI binary (no network).
 *
 *   init → build → fill → discover --apply → graph/slice/context →
 *   check → memory → ai → engine (deterministic scan + sync).
 */

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ACC = path.join(__dirname, '..', 'bin', 'acc.js');

function run(args, cwd, env) {
  const r = spawnSync(process.execPath, [ACC, ...args], {
    cwd,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function json(args, cwd) {
  const r = run(args, cwd);
  assert.equal(r.status, 0, `${args.join(' ')} failed: ${r.stderr}\n${r.stdout}`);
  return JSON.parse(r.stdout);
}

test('full ACC lifecycle works end to end', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-e2e-'));

  // --- init ---
  fs.mkdirSync(path.join(root, 'lib', 'util'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'util', 'index.js'), 'export const util = 1;\n');
  const init = run(['init', '.', '--no-scan'], root);
  assert.equal(init.status, 0);
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'config.yaml')));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'agents')));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'workflows')));
  assert.ok(fs.existsSync(path.join(root, '.acc', 'config', 'standards')));
  assert.ok(fs.existsSync(path.join(root, '.acc-memory.md')));

  // --- build --yes ---
  const build = run(['build', '--yes'], root);
  assert.equal(build.status, 0);
  assert.ok(fs.existsSync(path.join(root, 'lib', 'util', 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(root, 'lib', 'util', '.acc-memory.md')));

  // --- fill ---
  const fill = json(['fill', '--json'], root);
  const utilFile = fill.result.files.find((f) => f.file === 'lib/util/AGENTS.md');
  assert.ok(utilFile);
  assert.equal(utilFile.status, 'draft');
  assert.ok(utilFile.placeholders.some((p) => p.section === 'Purpose'));

  // --- discover --apply ---
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'database'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), '# auth\n\n## Purpose\n\nAuth.\n\n## Dependencies\n\n- src/database\n');
  fs.writeFileSync(path.join(root, 'src', 'database', 'AGENTS.md'), '# database\n\n## Purpose\n\nDb.\n');
  fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// references src/database and src/logging\n');
  fs.mkdirSync(path.join(root, 'src', 'logging'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'logging', 'AGENTS.md'), '# logging\n');
  const disc = json(['discover', '--apply', '--kind', 'missing-contract,missing-dependency,orphan-code', '--json'], root);
  assert.ok(disc.result.applied_count >= 1, JSON.stringify(disc.result.suggestions));

  // --- graph / slice / context ---
  const graph = json(['graph', '--json'], root);
  assert.ok(graph.result.nodes.some((n) => n.id === 'src/auth'));
  const slice = json(['slice', 'src/auth', '--json'], root);
  assert.equal(slice.result.scope, 'src/auth');
  assert.ok(slice.result.depends_on.some((d) => d.to === 'src/database'));
  const ctx = json(['context', 'src/auth', '--json'], root);
  assert.equal(ctx.result.sections.contract.source, 'src/auth/AGENTS.md');

  // --- check (deterministic) ---
  const c1 = run(['check', '--json'], root);
  const c2 = run(['check', '--json'], root);
  assert.equal(c1.stdout, c2.stdout);
  const check = JSON.parse(c1.stdout);
  assert.ok(Array.isArray(check.result.diagnostics));

  // --- memory round-trip ---
  assert.equal(run(['memory', 'add', 'src/auth', 'token is non-reentrant'], root).status, 0);
  const shown = run(['memory', 'show', 'src/auth'], root);
  assert.ok(shown.stdout.includes('token is non-reentrant'));

  // --- ai (offline listing, disabled) ---
  const ai = json(['ai', '--json'], root);
  assert.equal(ai.result.enabled, false);

  // --- engine: deterministic scan + dry-run sync (AI disabled) ---
  // A NEW discovered reference (created after discover --apply) must
  // surface as a dependency gap.
  fs.mkdirSync(path.join(root, 'src', 'analytics'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'analytics', 'AGENTS.md'), '# analytics\n');
  fs.writeFileSync(path.join(root, 'src', 'auth', 'session.rs'), '// references src/analytics\n');
  const eng = json(['engine', '--json'], root);
  assert.equal(eng.result.scan.stats.boundaries >= 5, true);
  assert.ok(eng.result.scan.diagnostics_summary.total >= 1);
  assert.equal(eng.result.sync.applied, false);
  assert.equal(eng.result.ai.enabled, false);
  assert.ok(eng.result.scan.dependency_gaps.some((g) => g.from === 'src/auth' && g.to === 'src/analytics'));
  // The drift report is written to the project root on every run.
  assert.ok(fs.existsSync(path.join(root, 'ACC_WARN.md')), 'ACC_WARN.md written by engine');
  const warnText = fs.readFileSync(path.join(root, 'ACC_WARN.md'), 'utf8');
  assert.ok(warnText.includes('src/auth → src/analytics'), 'dependency gap surfaced in ACC_WARN.md');
  assert.ok(warnText.includes('Docs behind code'), 'drift-behind section present');
  assert.ok(warnText.includes('Docs ahead of code'), 'drift-ahead section present');

  // --- engine --apply: sync keeps the project in sync (deterministic) ---
  const engApply = json(['engine', '--apply', '--json'], root);
  assert.equal(engApply.result.sync.applied, true);
  const authContract = fs.readFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), 'utf8');
  assert.ok(authContract.includes('- src/analytics'), 'engine --apply declared the discovered dependency');
  // engine --apply is deterministic: identical output + identical trees
  // on two fresh copies.
  const mk2 = () => {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-e2e-'));
    fs.mkdirSync(path.join(r, 'src', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(r, 'src', 'database'), { recursive: true });
    fs.mkdirSync(path.join(r, 'src', 'logging'), { recursive: true });
    fs.writeFileSync(path.join(r, 'AGENTS.md'), '# app\n');
    fs.writeFileSync(path.join(r, 'src', 'auth', 'AGENTS.md'), '# auth\n\n## Dependencies\n\n- src/database\n');
    fs.writeFileSync(path.join(r, 'src', 'database', 'AGENTS.md'), '# database\n');
    fs.writeFileSync(path.join(r, 'src', 'logging', 'AGENTS.md'), '# logging\n');
    fs.writeFileSync(path.join(r, 'src', 'auth', 'token.rs'), '// references src/logging\n');
    return r;
  };
  const r2a = mk2();
  const r2b = mk2();
  const e1 = run(['engine', '--apply', '--json'], r2a);
  const e2 = run(['engine', '--apply', '--json'], r2b);
  // Compare `result` (relative content); the envelope `root` is the
  // absolute temp path and legitimately differs between copies.
  assert.equal(
    JSON.stringify(JSON.parse(e1.stdout).result),
    JSON.stringify(JSON.parse(e2.stdout).result),
    'engine --apply result is identical on fresh copies',
  );
  assert.equal(
    fs.readFileSync(path.join(r2a, 'src', 'auth', 'AGENTS.md'), 'utf8'),
    fs.readFileSync(path.join(r2b, 'src', 'auth', 'AGENTS.md'), 'utf8'),
    'engine --apply produces identical contracts on fresh copies',
  );
  // Idempotent within a repo: a second --apply reports nothing to apply.
  const again = json(['engine', '--apply', '--json'], r2a);
  assert.equal(again.result.sync.suggestions_applied, 0);
  const contractOnce = fs.readFileSync(path.join(r2a, 'src', 'auth', 'AGENTS.md'), 'utf8');
  assert.equal((contractOnce.match(/- src\/logging/g) || []).length, 1, 'dependency declared exactly once');
});
