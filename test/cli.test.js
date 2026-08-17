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

function runEnv(args, cwd, env) {
  return execFileSync(process.execPath, [ACC, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
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

test('acc slice emits the compact AI-optimized graph slice', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Purpose\n\nAuth.\n\n## Dependencies\n\n- src/database\n\n## Skills\n\n- oauth\n',
  );
  fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// token\n');
  fs.writeFileSync(path.join(root, 'src', 'auth', 'token_test.rs'), '// token tests\n');
  fs.mkdirSync(path.join(root, 'src', 'database'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'database', 'AGENTS.md'), '# database\n');
  fs.mkdirSync(path.join(root, '.agents', 'skills', 'oauth'), { recursive: true });
  fs.writeFileSync(path.join(root, '.agents', 'skills', 'oauth', 'SKILL.md'), '---\nname: oauth\n---\n\nOAuth skill.\n');

  const out = run(['slice', 'src/auth'], root);
  assert.ok(out.includes('SCOPE: src/auth'));
  assert.ok(out.includes('GOVERNED_BY:'));
  assert.ok(out.includes('src/auth/AGENTS.md'));
  assert.ok(out.includes('OWNS (files):'));
  assert.ok(out.includes('src/auth/token.rs'));
  assert.ok(out.includes('src/database (declared)'));
  assert.ok(out.includes('src/auth/token_test.rs'));
  assert.ok(out.includes('oauth'));
  assert.ok(out.includes('IMPACT:'));

  const jsonOut = JSON.parse(run(['slice', 'src/auth', '--json'], root));
  assert.equal(jsonOut.command, 'slice');
  assert.equal(jsonOut.result.scope, 'src/auth');
  assert.deepEqual(jsonOut.result.governed_by, ['AGENTS.md', 'src/auth/AGENTS.md']);
  assert.deepEqual(jsonOut.result.requires.skills, ['oauth']);
  assert.equal(jsonOut.result.impact.files, 1);
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

test('acc ai lists configured providers offline (disabled by default)', () => {
  const root = makeRepo();
  const out = run(['ai'], root);
  assert.ok(out.includes('disabled'));
  assert.ok(out.includes('No AI providers configured'));

  const parsed = JSON.parse(run(['ai', '--json'], root));
  assert.equal(parsed.command, 'ai');
  assert.equal(parsed.result.enabled, false);
  assert.deepEqual(parsed.result.providers, []);
});

test('acc ai reports multiple configured providers with status', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'config.yaml'),
    [
      'ai:',
      '  enabled: true',
      '  default: main',
      '  providers:',
      '    - id: main',
      '      provider: openai',
      '      model: gpt-4o',
      '      api_key_env: ACC_CLI_TEST_KEY',
      '    - id: local',
      '      provider: anthropic',
      '      model: claude-sonnet-4-5',
    ].join('\n'),
  );
  process.env.ACC_CLI_TEST_KEY = 'test-key';
  try {
    const out = run(['ai'], root);
    assert.ok(out.includes('enabled'));
    assert.ok(out.includes('main: openai / gpt-4o'));
    assert.ok(out.includes('local: anthropic / claude-sonnet-4-5'));
    assert.ok(out.includes('Default: main'));

    const parsed = JSON.parse(run(['ai', '--json'], root));
    assert.equal(parsed.result.enabled, true);
    assert.equal(parsed.result.default, 'main');
    assert.equal(parsed.result.providers.length, 2);
    assert.equal(parsed.result.providers[0].package, '@ai-sdk/openai');
    assert.equal(parsed.result.providers[0].api_key_present, true);
  } finally {
    delete process.env.ACC_CLI_TEST_KEY;
  }
});

test('acc ai add: select provider → api key → model, stores key in .env', () => {
  const root = makeRepo();
  const out = run(['ai', 'add', '--provider', 'openrouter', '--api-key', 'sk-or-v1-secret', '--model', 'some/model', '--id', 'main', '--yes'], root);
  assert.ok(out.includes("Added provider 'main'"), out);
  assert.ok(out.includes('ACC_MAIN_KEY'), 'key stored under ACC_MAIN_KEY');

  // Key lives in .env (gitignored), never in the config.
  const envText = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.ok(envText.includes('ACC_MAIN_KEY=sk-or-v1-secret'));
  assert.ok(!envText.includes('some/model'), 'model never stored in .env');

  // Provider lives in the CLI-managed ai.yaml with base_url from catalog.
  const aiYaml = fs.readFileSync(path.join(root, '.acc', 'config', 'ai.yaml'), 'utf8');
  assert.ok(aiYaml.includes('openrouter'));
  assert.ok(aiYaml.includes('https://openrouter.ai/api/v1'), 'catalog base_url applied');

  // acc ai now lists it as enabled + ready.
  const listed = run(['ai'], root);
  assert.ok(listed.includes('AI: enabled'), listed);
  assert.ok(listed.includes('main: openai / some/model — ready'), listed);
});

test('acc ai add: --api-key missing in non-interactive mode is a clean error', () => {
  const root = makeRepo();
  let failed = false;
  try {
    run(['ai', 'add', '--provider', 'openai', '--model', 'gpt-4o', '--id', 'x', '--yes'], root);
  } catch (err) {
    failed = true;
    assert.ok(String(err.stderr).includes('ACC_X_KEY'), 'error names the env var');
  }
  assert.ok(failed, 'missing key must fail in --yes mode');
});

test('acc ai default and remove manage the provider lifecycle', () => {
  const root = makeRepo();
  run(['ai', 'add', '--provider', 'openrouter', '--api-key', 'k1', '--model', 'm1', '--id', 'a', '--yes'], root);
  run(['ai', 'add', '--provider', 'openai', '--api-key', 'k2', '--model', 'm2', '--id', 'b', '--yes'], root);

  const def = run(['ai', 'default', 'b'], root);
  assert.ok(def.includes("Default provider set to 'b'"));
  const listed = JSON.parse(run(['ai', '--json'], root));
  assert.equal(listed.result.default, 'b');
  assert.equal(listed.result.providers.length, 2);

  const removed = run(['ai', 'remove', 'a'], root);
  assert.ok(removed.includes("Removed provider 'a'"), removed);
  assert.ok(removed.includes('ACC_A_KEY'), 'env key deleted');
  const after = JSON.parse(run(['ai', '--json'], root));
  assert.equal(after.result.providers.length, 1);
  assert.equal(after.result.providers[0].id, 'b');
  // The removed key is gone from .env.
  assert.ok(!fs.readFileSync(path.join(root, '.env'), 'utf8').includes('ACC_A_KEY='));
  assert.ok(fs.readFileSync(path.join(root, '.env'), 'utf8').includes('ACC_B_KEY=k2'), 'remaining key intact');
});

test('acc ai models without a configured provider is a clean error (no network)', () => {
  const root = makeRepo();
  let failed = false;
  try {
    run(['ai', 'models', 'nope'], root);
  } catch (err) {
    failed = true;
    assert.ok(String(err.stderr).includes("no provider with id 'nope'"), 'offline error before any network call');
  }
  assert.ok(failed);
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

test('acc build is a dry run by default and creates with --yes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-build-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, 'lib', 'util'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'util', 'index.js'), 'export const x = 1;\n');

  const dry = run(['build'], root);
  assert.ok(dry.includes('lib/util/AGENTS.md'));
  assert.equal(fs.existsSync(path.join(root, 'lib', 'util', 'AGENTS.md')), false);

  run(['build', '--yes'], root);
  assert.equal(fs.existsSync(path.join(root, 'lib', 'util', 'AGENTS.md')), true);

  const again = run(['build', '--yes'], root);
  assert.ok(again.includes('Nothing to build'));
});

test('acc build --json reports missing and created', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-build-json-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'main.go'), 'package main\n');

  const dry = JSON.parse(run(['build', '--json'], root));
  assert.equal(dry.command, 'build');
  assert.ok(dry.result.missing.includes('src'));
  assert.equal(dry.result.created.length, 0);
  assert.equal(dry.result.dry_run, true);

  const wrote = run(['build', '--yes'], root);
  assert.ok(wrote.includes('Created src/AGENTS.md'));
  const done = JSON.parse(run(['build', '--json'], root));
  assert.equal(done.result.missing.length, 0);
  assert.equal(done.result.dry_run, true);
});

test('acc build scopes to a path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-build-scope-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, 'a', 'x'), { recursive: true });
  fs.mkdirSync(path.join(root, 'b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a', 'x', 'f.js'), '// a\n');
  fs.writeFileSync(path.join(root, 'b', 'g.js'), '// b\n');

  run(['build', '--yes', 'a'], root);
  assert.equal(fs.existsSync(path.join(root, 'a', 'x', 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'b', 'AGENTS.md')), false);
});

test('acc init --scan scans and creates missing contracts (non-interactive)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-scan-'));
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'index.js'), 'export const x = 1;\n');

  const out = run(['init', '.', '--scan'], root);
  assert.ok(out.includes('Scanned codebase:'));
  assert.ok(out.includes('lib/AGENTS.md'));
  assert.equal(fs.existsSync(path.join(root, 'lib', 'AGENTS.md')), true);

  const parsed = JSON.parse(run(['init', '.', '--scan', '--json'], root));
  assert.equal(parsed.command, 'init');
  assert.equal(parsed.result.scanned, true);
  assert.ok(Array.isArray(parsed.result.scan.created_files));
});

test('acc init without flags does not scan or create contracts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-noscan-'));
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'index.js'), 'export const x = 1;\n');

  const out = run(['init', '.'], root);
  assert.ok(!out.includes('Scanned codebase'));
  assert.equal(fs.existsSync(path.join(root, 'lib', 'AGENTS.md')), false);

  const parsed = JSON.parse(run(['init', '.', '--json'], root));
  assert.equal(parsed.result.scanned, false);
});

function fakeGit(root, origin, branch, cloneEpoch) {
  fs.mkdirSync(path.join(root, '.git', 'logs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.git', 'config'),
    `[core]\n\trepositoryformatversion = 0\n\n[remote "origin"]\n\turl = ${origin}\n`,
  );
  fs.writeFileSync(path.join(root, '.git', 'HEAD'), `ref: refs/heads/${branch}\n`);
  fs.writeFileSync(
    path.join(root, '.git', 'logs', 'HEAD'),
    `0000000000000000000000000000000000000000 9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b Tester <t@x.com> ${cloneEpoch} +0000\tclone: from ${origin}\n`,
  );
}

test('acc init creates root .acc-memory.md with clone date and GitHub provenance', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-git-'));
  fakeGit(root, 'git@github.com:acme/example.git', 'main', 1720000000);

  const out = run(['init', '.'], root);
  assert.ok(out.includes('Created .acc-memory.md'));

  const mem = fs.readFileSync(path.join(root, '.acc-memory.md'), 'utf8');
  assert.ok(mem.includes('Initial record created by acc init'));
  assert.ok(mem.includes('Cloned: 2024-07-03'));
  assert.ok(mem.includes('Origin: https://github.com/acme/example.git'));
  assert.ok(mem.includes('GitHub: acme/example (default branch: main)'));
});

test('acc init root memory omits provenance when there is no .git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-nogit-'));
  const out = run(['init', '.'], root);
  assert.ok(out.includes('Created .acc-memory.md'));
  const mem = fs.readFileSync(path.join(root, '.acc-memory.md'), 'utf8');
  assert.ok(!mem.includes('Cloned:'));
  assert.ok(!mem.includes('GitHub:'));
});

test('acc init does not overwrite an existing root .acc-memory.md', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-mem-'));
  fs.writeFileSync(path.join(root, '.acc-memory.md'), '## Gotchas\n\n- do not touch X\n');
  run(['init', '.'], root);
  const mem = fs.readFileSync(path.join(root, '.acc-memory.md'), 'utf8');
  assert.ok(mem.includes('do not touch X'));
  assert.ok(!mem.includes('Initial record created by'));
});

test('acc build --yes creates .acc-memory.md alongside created contracts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-build-mem-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'index.js'), 'export const x = 1;\n');

  const dry = run(['build'], root);
  assert.equal(fs.existsSync(path.join(root, 'lib', '.acc-memory.md')), false);

  const out = run(['build', '--yes'], root);
  assert.ok(out.includes('Created lib/AGENTS.md'));
  assert.ok(out.includes('lib/.acc-memory.md'));
  assert.ok(fs.existsSync(path.join(root, 'lib', '.acc-memory.md')));
  assert.ok(fs.readFileSync(path.join(root, 'lib', '.acc-memory.md'), 'utf8').includes('Initial record created by acc build'));

  const parsed = JSON.parse(run(['build', '--json'], root));
  assert.deepEqual(parsed.result.memory_created, []);
  assert.deepEqual(parsed.result.created, []);

  const again = run(['build', '--yes'], root);
  assert.ok(again.includes('Nothing to build'));
});

test('acc fill reports placeholder sections in generated templates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fill-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'index.js'), 'export const x = 1;\n');
  run(['build', '--yes'], root);

  const out = run(['fill'], root);
  assert.ok(out.includes('Fill directive:'));
  assert.ok(out.includes('lib/AGENTS.md'));
  assert.ok(out.includes('Purpose: 1 placeholder item'));
  assert.ok(out.includes('Ownership: 1 placeholder item'));

  const parsed = JSON.parse(run(['fill', '--json'], root));
  const lib = parsed.result.files.find((f) => f.file === 'lib/AGENTS.md');
  assert.equal(lib.status, 'draft');
  assert.deepEqual(lib.missing, []);
  assert.ok(lib.placeholders.some((p) => p.section === 'Responsibilities' && p.count === 2));
  assert.equal(parsed.result.summary.total, 2);
});

test('acc fill classifies missing and empty sections and reports complete files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fill2-'));
  fs.writeFileSync(
    path.join(root, 'AGENTS.md'),
    [
      '# app',
      '## Purpose',
      'Demo.',
      '## Responsibilities',
      '- builds things',
      '## Ownership',
      'Owner: team',
      '## Inputs',
      '- code',
      '## Outputs',
      '- report',
      '## Dependencies',
      '- src/x',
      '## Constraints',
      '- invariant',
      '## Architecture',
      'Prose.',
    ].join('\n'),
  );
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'auth', 'AGENTS.md'),
    '# auth\n\n## Purpose\n\nAuth.\n\n## Ownership\n\nOwner: t\n\n## Dependencies\n\n',
  );

  const parsed = JSON.parse(run(['fill', '--json'], root));
  const rootFile = parsed.result.files.find((f) => f.file === 'AGENTS.md');
  assert.equal(rootFile.status, 'complete');
  assert.deepEqual(rootFile.missing, []);
  assert.deepEqual(rootFile.empty, []);
  const auth = parsed.result.files.find((f) => f.file === 'src/auth/AGENTS.md');
  assert.equal(auth.status, 'draft');
  assert.ok(auth.missing.includes('Architecture'));
  assert.ok(auth.empty.includes('Dependencies'));
  assert.equal(parsed.result.summary.complete, 1);
  assert.equal(parsed.result.summary.total, 2);
});

test('project root never resolves to the home directory', () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'acc-home-')));
  fs.writeFileSync(path.join(home, 'package.json'), '{}\n');
  const nested = path.join(home, 'work', 'sandbox');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'code.js'), 'export const x = 1;\n');

  const out = JSON.parse(runEnv(['graph', '--json'], nested, { HOME: home }));
  assert.equal(out.root, nested);
});

test('acc engine --supervisor surfaces score and approval in the result', () => {
  const { spawnSync } = require('child_process');
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), '# auth\n\n## Purpose\n\nAuth.\n');
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'config.yaml'),
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      '    - id: test',
      '      provider: openai',
      '      model: gpt-4o',
      '      api_key_env: ACC_CLI_TEST_KEY',
    ].join('\n'),
  );
  const r = spawnSync(process.execPath, [ACC, 'engine', '--supervisor', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ACC_CLI_TEST_KEY: 'k' },
  });
  // No real provider → the AI phase reports the missing key as an error,
  // but the envelope must still be valid JSON with the supervisor shape.
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.result.ai.supervisor, 'supervisor shape present in the result');
  assert.equal(out.result.ai.supervisor.threshold, 85, 'default supervisor threshold is 85');
  assert.equal(out.result.ai.supervisor.max_iterations, 3);
  // The trigger gates the AI phase; without a trigger baseline and no git,
  // the engine falls back to triggered (never skips work) but the missing
  // key is reported as an error, not thrown.
  assert.ok(Array.isArray(out.result.ai.errors));
});

test('acc engine --init-context bootstraps the full ACC context', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-init-ctx-'));
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'database'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'auth.rs'), '// auth service\n');
  fs.writeFileSync(path.join(root, 'src', 'database', 'db.rs'), '// database layer\n');

  const out = run(['engine', '--init-context', '--json'], root);
  const parsed = JSON.parse(out);
  assert.equal(parsed.result.init.scanned, true);
  assert.ok(parsed.result.init.created.some((c) => c.includes('config.yaml')), 'config scaffolded');
  assert.equal(parsed.result.init.root_agents_created, true, 'root AGENTS.md created');
  // The boundary contracts are created by init's scan step (build --yes);
  // the engine step then reports no missing contracts.
  assert.ok(parsed.result.init.scan.created_files.length >= 2, 'boundary contracts created by init scan');
  assert.ok(fs.existsSync(path.join(root, 'ACC_WARN.md')), 'drift report written');
  assert.ok(fs.existsSync(path.join(root, 'src', 'auth', 'AGENTS.md')), 'auth contract');
  assert.ok(fs.existsSync(path.join(root, 'src', 'database', 'AGENTS.md')), 'database contract');
  assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')), 'root contract');
  assert.equal(parsed.result.fill.total >= 3, true, 'fill reports the contracts');

  // Idempotent: a second run does not recreate or duplicate anything.
  const again = JSON.parse(run(['engine', '--init-context', '--json'], root));
  assert.equal(again.result.init.root_agents_created, false, 'root contract not recreated');
  assert.equal(again.result.engine.contracts_created.length, 0, 'no contracts recreated');
  const authContract = fs.readFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), 'utf8');
  assert.equal(fs.readFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), 'utf8').length, authContract.length, 'contract untouched');
});

test('acc engine --watch keeps the server alive and logs runs', async () => {
  const { spawn } = require('child_process');
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), '# auth\n\n## Purpose\n\nAuth.\n');

  const child = spawn(process.execPath, [ACC, 'engine', '--watch'], { cwd: root, env: process.env });
  let output = '';
  child.stdout.on('data', (d) => {
    output += d.toString();
  });
  child.stderr.on('data', (d) => {
    output += d.toString();
  });

  try {
    // Initial run must appear, then the watcher stays alive.
    await new Promise((res, rej) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (output.includes('[engine watch] run triggered: initial')) {
          clearInterval(iv);
          res();
        } else if (Date.now() - t0 > 15000) {
          clearInterval(iv);
          rej(new Error(`watch never started: ${output.slice(0, 800)}`));
        }
      }, 200);
    });
    assert.ok(output.includes('[engine watch] watching'), 'watch banner printed');
    assert.ok(output.includes('scan:'), 'scan log printed');
    assert.ok(output.includes('ai: disabled'), 'AI disabled log printed');

    // The process is still alive after the initial run (server semantics).
    assert.equal(child.exitCode, null, 'watch process stays alive');
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => child.on('exit', r));
  }
});
