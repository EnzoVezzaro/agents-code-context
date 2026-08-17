'use strict';

/**
 * Determinism battery.
 *
 * The CLI is consumed mostly by agents: same repository state + same
 * flags MUST produce byte-identical output across runs (see the
 * determinism guarantee in the epistemology + JSON-schema specs). This
 * suite runs every read-only command twice in fresh processes and
 * asserts byte-identical stdout, and checks write commands report
 * byte-identical results on fresh copies.
 *
 * Exceptions (documented in the spec):
 *   - `acc battle` spawns an external process — excluded.
 *   - `acc memory add` writes a timestamped entry — the FILE differs by
 *     design; the reported JSON/text result is still compared.
 *   - `acc ai` reflects the environment (api_key_present) — env is an
 *     input; runs use the same env.
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
  return r.stdout;
}

/** Rich fixture exercising every derivation path (contracts, files, tests, skills, standards, plugins, config, memory). */
function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-determinism-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };

  write('AGENTS.md', '# app\n\n## Purpose\n\nDemo app.\n');
  write(
    'src/auth/AGENTS.md',
    '# auth\n\n## Purpose\n\nAuthentication.\n\n## Ownership\n\nOwner: auth-team\n\n## Dependencies\n\n- src/database\n\n## Skills\n\n- oauth\n',
  );
  write('src/auth/token.rs', '// token\n');
  write('src/auth/token_test.rs', '// token tests\n');
  write('src/auth/session_test.ts', '// session tests (naming only)\n');
  write('src/database/AGENTS.md', '# database\n\n## Purpose\n\nPersistence.\n');
  write('src/app/AGENTS.md', '# app\n\n## Purpose\n\nApp layer.\n\n## Dependencies\n\n- src/auth\n');
  write('src/app/service.rs', '// uses src/auth\n');
  write('src/app/package.json', JSON.stringify({ name: 'app', scripts: { build: 'npm run build', test: 'vitest run' } }));
  write('src/logging/log.go', '// orphan-ish file under covered dir\n');
  write('tests/root_test.go', 'package tests\n');
  write('.agents/skills/oauth/SKILL.md', '---\nname: oauth\n---\n\nOAuth.\n');
  write('.acc/config/standards/idempotency.md', '# Idempotency\n');
  write(
    '.acc/config/config.yaml',
    [
      'ai:',
      '  enabled: true',
      '  default: main',
      '  providers:',
      '    - id: main',
      '      provider: openai',
      '      model: gpt-4o',
      '      api_key_env: ACC_DET_KEY',
      '    - id: local',
      '      provider: anthropic',
      '      model: claude-sonnet-4-5',
    ].join('\n'),
  );
  // Plugin dir (exercises the readdirSync sort path).
  write('.acc/config/tools/docker/plugin.yaml', 'name: docker\n');
  write('.acc/config/tools/k8s/plugin.yaml', 'name: k8s\n');
  write('src/auth/.acc-memory.md', '## 2026-08-01T00:00:00Z\n\n- token is non-reentrant\n');
  return root;
}

/** Read-only command battery: [args, env?]. */
const READ_ONLY = [
  [['--help']],
  [['--version']],
  [['graph']],
  [['graph', '--json']],
  [['graph', '--format', 'mermaid']],
  [['graph', '--format', 'dot']],
  [['graph', '--nodes']],
  [['graph', 'src/auth', '--json']],
  [['slice', 'src/auth']],
  [['slice', 'src/auth', '--json']],
  [['slice', 'src/auth/token.rs', '--json']],
  [['context', 'src/auth']],
  [['context', 'src/auth', '--json']],
  [['context', '.', '--depth', '1', '--json']],
  [['check']],
  [['check', '--json']],
  [['inspect', 'src/auth']],
  [['inspect', 'src/auth', '--json']],
  [['dependencies', 'src/auth']],
  [['dependencies', 'src/auth', '--transitive', '--json']],
  [['dependents', 'src/auth', '--json']],
  [['impact', 'src/auth']],
  [['impact', 'src/auth', '--json']],
  [['search', 'auth']],
  [['search', 'token', '--kind', 'code', '--json']],
  [['discover']],
  [['discover', '--json']],
  [['fill']],
  [['fill', '--json']],
  [['build']],
  [['build', '--from-discovery', '--json']],
  [['document', 'src/auth', '--from-discovery']],
  [['document', 'src/auth', '--json']],
  [['memory', 'show', 'src/auth']],
  [['memory', 'show', 'src/auth', '--json']],
  [['tools']],
  [['tools', '--json']],
  [['tools', '--category', 'plugins']],
  [['ai']],
  [['ai', '--json']],
];

for (const [args, env] of READ_ONLY) {
  const label = `acc ${args.join(' ')}`;
  test(`deterministic: ${label}`, () => {
    const root = makeFixture();
    const a = run(args, root, env);
    const b = run(args, root, env);
    assert.equal(a, b, `${label} must be byte-identical across runs`);
  });
}

test('deterministic: acc engine (AI disabled) is byte-identical', () => {
  // Engine fixture WITHOUT ai config → AI phase skipped, fully deterministic.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-det-engine-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };
  write('AGENTS.md', '# app\n');
  write('src/auth/AGENTS.md', '# auth\n\n## Dependencies\n\n- src/database\n');
  write('src/auth/token.rs', '// references src/logging\n');
  write('src/database/AGENTS.md', '# database\n');
  write('src/logging/AGENTS.md', '# logging\n');

  for (const args of [['engine'], ['engine', '--json'], ['engine', 'src/auth'], ['engine', 'src/auth', '--json']]) {
    const label = `acc ${args.join(' ')}`;
    const a = run(args, root);
    const b = run(args, root);
    assert.equal(a, b, `${label} must be byte-identical across runs`);
  }
});

test('deterministic: write commands report identical results on fresh copies', () => {
  // init (no .git → no clone-date line) — output + resulting tree.
  const r1 = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-det-init-'));
  const r2 = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-det-init-'));
  fs.writeFileSync(path.join(r1, 'AGENTS.md'), '# app\n');
  fs.writeFileSync(path.join(r2, 'AGENTS.md'), '# app\n');
  const o1 = run(['init', '.'], r1);
  const o2 = run(['init', '.'], r2);
  assert.equal(o1, o2, 'acc init output must be identical on fresh copies');

  // build --yes on the same fixture shape → identical output + identical trees.
  const mk = () => {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-det-build-'));
    fs.writeFileSync(path.join(r, 'AGENTS.md'), '# app\n');
    fs.mkdirSync(path.join(r, 'lib', 'util'), { recursive: true });
    fs.writeFileSync(path.join(r, 'lib', 'util', 'index.js'), 'export const x = 1;\n');
    return r;
  };
  const b1 = mk();
  const b2 = mk();
  const bo1 = run(['build', '--yes'], b1);
  const bo2 = run(['build', '--yes'], b2);
  assert.equal(bo1, bo2, 'acc build --yes output must be identical on fresh copies');
  assert.equal(
    fs.readFileSync(path.join(b1, 'lib', 'util', 'AGENTS.md'), 'utf8'),
    fs.readFileSync(path.join(b2, 'lib', 'util', 'AGENTS.md'), 'utf8'),
    'created AGENTS.md templates must be identical',
  );

  // memory add — reported result identical; file content exempt (timestamp).
  const m1 = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-det-mem-'));
  const m2 = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-det-mem-'));
  fs.writeFileSync(path.join(m1, 'AGENTS.md'), '# app\n');
  fs.writeFileSync(path.join(m2, 'AGENTS.md'), '# app\n');
  const mo1 = run(['memory', 'add', '.', 'durable note'], m1);
  const mo2 = run(['memory', 'add', '.', 'durable note'], m2);
  assert.equal(mo1, mo2, 'acc memory add reported output must be identical on fresh copies');
});

test('deterministic: JSON envelopes carry sorted keys', () => {
  const root = makeFixture();
  const out = JSON.parse(run(['graph', '--json'], root));
  const keys = Object.keys(out);
  assert.deepEqual(keys, [...keys].sort(), 'envelope keys are sorted');
  const nodeKeys = Object.keys(out.result.nodes[0]);
  assert.deepEqual(nodeKeys, [...nodeKeys].sort(), 'node keys are sorted');
});

test('deterministic: error output is identical too', () => {
  const root = makeFixture();
  const a = run(['slice', 'does-not-exist', '--json'], root);
  const b = run(['slice', 'does-not-exist', '--json'], root);
  assert.equal(a, b);
});
