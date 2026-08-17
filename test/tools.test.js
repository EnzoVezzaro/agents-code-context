'use strict';

/**
 * Tool separation tests — enforce the architectural invariant:
 *
 *   CLI tier  = deterministic, offline, zero-intelligence, no API key.
 *   Engine tier = intelligence; deterministic scan always, AI phase needs
 *                 ai.enabled + provider API key.
 *
 * Every command registered in bin/acc.js MUST appear in the `acc tools`
 * manifest with the correct tier, so external agents and developers get
 * an accurate, machine-readable capability surface.
 */

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ACC = path.join(__dirname, '..', 'bin', 'acc.js');
const toolsModule = require('../lib/commands/tools');

// Registered commands that are deliberately OUTSIDE the ACC capability
// surface. battle launches the standalone ABA benchmark (a separate
// product with its own repo/package) — it is still listed in the
// manifest, but under its own `launcher` tier, never as a CLI or engine
// capability.
const OUT_OF_SCOPE = new Set();

/** The command registry from bin/acc.js (mirrors commandModules + RESERVED). */
function registeredCommands() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'acc.js'), 'utf8');
  const mods = src.match(/^\s{2}(\w+): require\('\.\.\/lib\/commands\/[^']+'\)/gm) || [];
  const names = mods.map((m) => m.match(/^\s{2}(\w+):/)[1]);
  const reserved = src.match(/RESERVED = \{([\s\S]*?)\};/)[1];
  const reservedNames = [...reserved.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
  return { names, reserved: reservedNames };
}

test('manifest: every registered command appears in acc tools with a tier', () => {
  const { names } = registeredCommands();
  const manifest = toolsModule.run({ positionals: [], values: {}, unknown: [], errors: [] }, {
    root: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-')),
    config: { ignore: [] },
    opts: { json: true },
  });
  const manifestNames = new Set(manifest.result.commands.map((c) => c.name));
  for (const name of names) {
    if (OUT_OF_SCOPE.has(name)) continue; // external launcher, not in the ACC surface
    assert.ok(manifestNames.has(name), `command '${name}' missing from acc tools manifest`);
  }
  for (const name of OUT_OF_SCOPE) {
    assert.ok(!manifestNames.has(name), `out-of-scope launcher '${name}' must NOT be advertised as an ACC capability`);
  }
  // Reserved commands (future work) must NOT be presented as available.
  const { reserved } = registeredCommands();
  for (const name of reserved) {
    assert.ok(!manifestNames.has(name), `reserved command '${name}' must not be listed as available`);
  }
});

test('manifest: every command declares tier, determinism, and API-key requirement', () => {
  for (const c of toolsModule.CORE_COMMANDS || []) void c;
  for (const c of toolsModule.run({ positionals: [], values: {}, unknown: [], errors: [] }, {
    root: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-')),
    config: { ignore: [] },
    opts: { json: true },
  }).result.commands) {
    assert.ok(['cli', 'engine', 'launcher'].includes(c.tier), `${c.name}: tier is cli|engine|launcher`);
    assert.equal(typeof c.deterministic, 'boolean', `${c.name}: deterministic is boolean`);
    assert.equal(typeof c.requires_api_key, 'boolean', `${c.name}: requires_api_key is boolean`);
    assert.ok(Array.isArray(c.capabilities) && c.capabilities.length > 0, `${c.name}: capabilities present`);
  }
});

test('separation: only the engine tier may require an API key', () => {
  const manifest = toolsModule.run({ positionals: [], values: {}, unknown: [], errors: [] }, {
    root: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-')),
    config: { ignore: [] },
    opts: { json: true },
  }).result;
  for (const c of manifest.commands) {
    if (c.tier === 'cli') {
      assert.equal(c.requires_api_key, false, `CLI command '${c.name}' must not require an API key`);
      assert.equal(c.deterministic, true, `CLI command '${c.name}' must be deterministic`);
    } else if (c.tier === 'launcher') {
      assert.equal(c.requires_api_key, false, `launcher '${c.name}' needs no API key`);
      assert.equal(c.deterministic, false, `launcher '${c.name}' spawns an external process`);
    } else {
      // Engine tier: commands that RUN the AI phase need a key
      // (engine, review); ai is the offline control command and does not.
      if (c.name === 'ai') {
        assert.equal(c.requires_api_key, false, 'ai lists providers offline — no key needed');
        assert.equal(c.deterministic, true, 'ai is a deterministic offline listing');
      } else {
        assert.equal(c.requires_api_key, true, `engine command '${c.name}' requires an API key for the AI phase`);
      }
    }
  }
  assert.ok(manifest.tiers.cli.commands.includes('graph'));
  assert.ok(manifest.tiers.cli.commands.includes('context'));
  // battle is exposed under its own launcher tier, never as a CLI or
  // engine capability.
  assert.deepEqual(manifest.tiers.launcher.commands, ['battle'], 'launcher tier lists only battle');
});

test('separation: CLI commands never touch the network or load AI providers', async () => {
  const { names } = registeredCommands();
  const cliNames = new Set(toolsModule.run({ positionals: [], values: {}, unknown: [], errors: [] }, {
    root: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-')),
    config: { ignore: [] },
    opts: { json: true },
  }).result.commands.filter((c) => c.tier === 'cli').map((c) => c.name));

  // Every CLI command module must NOT require the AI SDK or make network calls.
  for (const name of names) {
    if (!cliNames.has(name)) continue;
    const file = path.join(__dirname, '..', 'lib', 'commands', `${name}.js`);
    if (!fs.existsSync(file)) continue; // relations.js module
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/require\(['"]ai['"]\)|@ai-sdk\//.test(src), `CLI command '${name}' must not load the AI SDK`);
    assert.ok(!/fetch\(|https?:\/\//.test(src), `CLI command '${name}' must not make network calls`);
  }
});

test('edge cases: every CLI command rejects bad args with exit 2 (usage error)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-edge-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  const cases = [
    ['graph', '--bogus'],
    ['slice'], // missing path
    ['context', 'a', 'b'], // too many paths
    ['check', '--severity', 'bogus'],
    ['engine', '--nope'],
    ['tools', '--category', 'bogus'],
    ['search'], // missing query
    ['memory', 'badsub'],
    ['dependencies'], // missing path
    ['discover', '--kind', 'nonsense'],
    ['build', 'a', 'b'], // too many
    ['battle'], // missing project
  ];
  for (const args of cases) {
    const r = spawnSync(process.execPath, [ACC, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 2, `acc ${args.join(' ')} → exit 2 (usage), got ${r.status}: ${r.stderr}`);
    assert.ok((r.stderr || r.stdout).length > 0, `acc ${args.join(' ')} → an error message`);
  }
});

test('edge cases: CLI commands succeed on an empty/edge repository', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-edge-'));
  // No AGENTS.md, no config — every deterministic read command must
  // complete (exit 0) with valid output.
  const ok = [
    ['check', '--json'],
    ['graph', '--json'],
    ['context', '.', '--json'],
    ['tools', '--json'],
    ['discover', '--json'],
    ['search', 'x', '--json'],
  ];
  for (const args of ok) {
    const r = spawnSync(process.execPath, [ACC, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, `acc ${args.join(' ')} on empty repo → exit 0, got ${r.status}: ${r.stderr}`);
    JSON.parse(r.stdout); // valid JSON envelope
  }
});

test('edge cases: engine without API key degrades with a clean error, never a crash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-edge-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'config.yaml'),
    ['ai:', '  enabled: true', '  providers:', '    - id: x', '      provider: openai', '      model: gpt-4o', '      api_key_env: MISSING_KEY'].join('\n'),
  );
  const r = spawnSync(process.execPath, [ACC, 'engine', '--force', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, 'engine never crashes on a missing key');
  const out = JSON.parse(r.stdout);
  assert.ok(out.result.ai.errors.some((e) => e.includes('MISSING_KEY')), 'missing key reported as error, not thrown');
  assert.equal(out.result.ai.enabled, true);
  assert.equal(out.result.ai.skipped, false);
  // The deterministic scan still ran and produced the drift report.
  assert.ok(out.result.scan.stats.boundaries >= 1);
  assert.ok(fs.existsSync(path.join(root, 'ACC_WARN.md')));
});

test('intelligence: engine tier manifest lists ai, engine, and review with correct contracts', () => {
  const manifest = toolsModule.run({ positionals: [], values: {}, unknown: [], errors: [] }, {
    root: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-')),
    config: { ignore: [] },
    opts: { json: true },
  }).result;
  assert.deepEqual(
    manifest.tiers.engine.commands,
    ['ai', 'engine', 'review'],
    'engine tier = ai (control), engine (sync), review (on-demand scoring)',
  );
  const byName = Object.fromEntries(manifest.commands.map((c) => [c.name, c]));
  assert.equal(byName.engine.requires_api_key, true);
  assert.equal(byName.review.requires_api_key, true);
  assert.equal(byName.review.deterministic, false);
  assert.ok(byName.review.capabilities.includes('compliance_score'));
  assert.equal(byName.ai.requires_api_key, false, 'ai is the offline control command');
  assert.equal(byName.ai.deterministic, true);
});

test('intelligence: acc ai runs offline, no API key, byte-identical output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'config.yaml'),
    ['ai:', '  enabled: true', '  providers:', '    - id: main', '      provider: openai', '      model: gpt-4o', '      api_key_env: NEVER_SET_KEY'].join('\n'),
  );
  delete process.env.NEVER_SET_KEY;
  const a = spawnSync(process.execPath, [ACC, 'ai', '--json'], { cwd: root, encoding: 'utf8' });
  const b = spawnSync(process.execPath, [ACC, 'ai', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout, b.stdout, 'acc ai is byte-identical across runs');
  const out = JSON.parse(a.stdout);
  assert.equal(out.result.enabled, true);
  assert.equal(out.result.providers.length, 1);
  assert.equal(out.result.providers[0].api_key_present, false, 'reports missing key without any network call');
});

test('intelligence: acc review degrades cleanly without an API key (scan still runs)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), '# auth\n\n## Dependencies\n\n- src/database\n');
  fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// uses src/database\n');
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'config.yaml'),
    ['ai:', '  enabled: true', '  providers:', '    - id: main', '      provider: openai', '      model: gpt-4o', '      api_key_env: MISSING_REVIEW_KEY'].join('\n'),
  );
  delete process.env.MISSING_REVIEW_KEY;
  const r = spawnSync(process.execPath, [ACC, 'review', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, 'review never crashes on a missing key');
  const out = JSON.parse(r.stdout);
  assert.equal(out.result.ai.enabled, true);
  assert.ok(out.result.ai.errors.some((e) => e.includes('MISSING_REVIEW_KEY')), 'missing key reported as error, not thrown');
  assert.equal(out.result.score, null, 'no score without AI');
  // The deterministic scan still ran.
  assert.ok(out.result.diagnostics.total >= 0);
  assert.ok(Array.isArray(out.result.dependency_gaps));
  assert.ok(!fs.existsSync(path.join(root, 'ACC_WARN.md')), 'review is read-only — never writes the drift report');
});

test('manifest: acc tools --json output is deterministic and tiered', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-'));
  const a = spawnSync(process.execPath, [ACC, 'tools', '--json'], { cwd: root, encoding: 'utf8' });
  const b = spawnSync(process.execPath, [ACC, 'tools', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout, b.stdout, 'acc tools --json is byte-identical');
  const parsed = JSON.parse(a.stdout);
  assert.ok(parsed.result.tiers.cli.commands.length >= 14, 'CLI tier lists the deterministic commands');
  assert.deepEqual(parsed.result.tiers.engine.commands, ['ai', 'engine', 'review'], 'engine tier lists the intelligence subsystem');
  assert.ok(!('external' in parsed.result.tiers), 'no external tier in the manifest');
  assert.ok(parsed.result.commands.every((c) => ['cli', 'engine', 'launcher'].includes(c.tier)));
  const battle = parsed.result.commands.find((c) => c.name === 'battle');
  assert.ok(battle, 'battle is listed in the manifest');
  assert.equal(battle.tier, 'launcher', 'battle is a launcher, not a CLI/engine capability');
  assert.deepEqual(parsed.result.tiers.launcher.commands, ['battle']);
});
