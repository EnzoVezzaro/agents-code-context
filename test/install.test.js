'use strict';

/**
 * `acc install` — ACC as an installable agent skill.
 *
 * Contract under test:
 *   - writes a fixed, deterministic SKILL.md to .agents/skills/acc/ by
 *     default (the Agent Skills standard location, detected by the graph)
 *   - idempotent: never overwrites without --force
 *   - per-agent project-local targets (--agent) and explicit paths (--dir)
 *   - the skill is detected by the graph as a `skill` node and surfaces
 *     in `acc slice` requires.skills
 *   - the engine is positioned as the always-on AI engine in the manifest
 */

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ACC = path.join(__dirname, '..', 'bin', 'acc.js');
const toolsModule = require('../lib/commands/tools');

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-install-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  return root;
}

function run(args, root) {
  return spawnSync(process.execPath, [ACC, ...args], { cwd: root, encoding: 'utf8' });
}

test('install: writes the ACC skill to .agents/skills/acc/ (deterministic)', () => {
  const root = makeRepo();
  const a = run(['install'], root);
  assert.equal(a.status, 0, a.stderr);
  const target = path.join(root, '.agents', 'skills', 'acc', 'SKILL.md');
  assert.equal(fs.existsSync(target), true, 'SKILL.md written');
  const content = fs.readFileSync(target, 'utf8');
  assert.ok(content.startsWith('---\nname: acc'), 'skill frontmatter');
  assert.ok(content.includes('Engine ON'), 'engine-on contract in the skill');
  assert.ok(content.includes('Engine OFF'), 'engine-off contract in the skill');
  assert.ok(content.includes('acc tools'), 'points at the capability manifest');
  // A fresh root reports installed: true with the expected metadata.
  const root2 = makeRepo();
  const fresh = JSON.parse(run(['install', '--json'], root2).stdout);
  assert.equal(fresh.result.installed, true);
  assert.equal(fresh.result.file, '.agents/skills/acc/SKILL.md');
  assert.equal(fresh.result.agent, 'generic');
  // Byte-identical across repos (deterministic content).
  assert.equal(fs.readFileSync(path.join(root2, '.agents', 'skills', 'acc', 'SKILL.md'), 'utf8'), content);
});

test('install: copies the canonical skills/acc/ skill + references (single source)', () => {
  const root = makeRepo();
  const out = run(['install', '--json'], root);
  assert.equal(out.status, 0, out.stderr);
  const result = JSON.parse(out.stdout).result;
  assert.equal(result.installed, true);
  assert.ok(result.references.includes('references/engine-limits.md'), 'engine-limits reference copied');
  assert.ok(result.references.includes('references/over-feeding.md'), 'over-feeding reference copied');

  // The installed SKILL.md is byte-identical to the canonical one in the
  // repo (with the __ACC_VERSION__ placeholder resolved) — `npx skills`
  // and `acc install` distribute the same file.
  const canonical = fs
    .readFileSync(path.join(__dirname, '..', 'skills', 'acc', 'SKILL.md'), 'utf8')
    .replace(/__ACC_VERSION__/g, require('../package.json').version);
  const installed = fs.readFileSync(path.join(root, '.agents', 'skills', 'acc', 'SKILL.md'), 'utf8');
  assert.equal(installed, canonical, 'installed SKILL.md matches skills/acc/SKILL.md');

  const installedRef = fs.readFileSync(path.join(root, '.agents', 'skills', 'acc', 'references', 'engine-limits.md'), 'utf8');
  const canonicalRef = fs.readFileSync(path.join(__dirname, '..', 'skills', 'acc', 'references', 'engine-limits.md'), 'utf8');
  assert.equal(installedRef, canonicalRef, 'reference file matches the canonical one');
});

test('install: copies the optional role sub-agents (engine-OFF alternative)', () => {
  const root = makeRepo();
  const out = run(['install', '--json'], root);
  assert.equal(out.status, 0, out.stderr);
  const result = JSON.parse(out.stdout).result;
  for (const name of ['acc-supervisor', 'acc-documenter', 'acc-reviewer', 'acc-explorer', 'acc-checker', 'acc-filler', 'acc-initializer']) {
    assert.ok(result.agents.includes(`agents/${name}.md`), `${name} agent copied`);
    const installed = fs.readFileSync(path.join(root, '.agents', 'skills', 'acc', 'agents', `${name}.md`), 'utf8');
    const canonical = fs.readFileSync(path.join(__dirname, '..', 'skills', 'acc', 'agents', `${name}.md`), 'utf8');
    assert.equal(installed, canonical, `${name} matches the canonical agent`);
    assert.ok(installed.startsWith('---\nname: '), `${name} has agent frontmatter`);
  }
  assert.ok(fs.existsSync(path.join(root, '.agents', 'skills', 'acc', 'README.md')), 'README copied');
});

test('install: idempotent — never overwrites without --force', () => {
  const root = makeRepo();
  run(['install'], root);
  const target = path.join(root, '.agents', 'skills', 'acc', 'SKILL.md');
  fs.appendFileSync(target, '\n<!-- user note -->\n');
  const again = run(['install'], root);
  assert.equal(again.status, 0);
  assert.ok(again.stdout.includes('already installed'), 'reports already installed');
  assert.ok(fs.readFileSync(target, 'utf8').includes('user note'), 'existing skill untouched');
  const forced = run(['install', '--force'], root);
  assert.equal(forced.status, 0);
  assert.ok(!fs.readFileSync(target, 'utf8').includes('user note'), '--force overwrites');
});

test('install: --agent maps to well-known project-local dirs; --dir overrides', () => {
  const root = makeRepo();
  const claude = run(['install', '--agent', 'claude'], root);
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(fs.existsSync(path.join(root, '.claude', 'skills', 'acc', 'SKILL.md')), true);
  const dir = run(['install', '--dir', 'vendor/acc', '--json'], root);
  assert.equal(dir.status, 0, dir.stderr);
  const out = JSON.parse(dir.stdout);
  assert.equal(out.result.file, 'vendor/acc/SKILL.md');
  assert.equal(fs.existsSync(path.join(root, 'vendor', 'acc', 'SKILL.md')), true);
});

test('install: rejects unknown agents and conflicting flags (exit 2)', () => {
  const root = makeRepo();
  assert.equal(run(['install', '--agent', 'bogus'], root).status, 2);
  assert.equal(run(['install', '--agent', 'claude', '--dir', 'x'], root).status, 2);
  assert.equal(run(['install', 'extra'], root).status, 2);
  const err = run(['install', '--agent', 'bogus'], root);
  assert.ok(err.stderr.includes('unknown agent'), 'clear error message');
});

test('install: the installed skill is detected by the graph and the slice', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Skills\n\n- acc\n');
  run(['install'], root);
  const slice = JSON.parse(run(['slice', '.', '--json'], root).stdout);
  assert.ok(slice.result.requires.skills.includes('acc'), 'slice surfaces the acc skill');
});

test('manifest: install is a CLI command; engine is the always-on AI engine', () => {
  const manifest = toolsModule.run({ positionals: [], values: {}, unknown: [], errors: [] }, {
    root: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tools-')),
    config: { ignore: [] },
    opts: { json: true },
  }).result;
  const byName = Object.fromEntries(manifest.commands.map((c) => [c.name, c]));
  assert.equal(byName.install.tier, 'cli', 'install is deterministic CLI');
  assert.equal(byName.install.requires_api_key, false);
  assert.equal(byName.install.deterministic, true);
  assert.ok(byName.install.capabilities.includes('skill_deploy'));
  assert.ok(byName.engine.summary.toLowerCase().includes('always-on'), 'engine summary is always-on');
  assert.ok(byName.engine.capabilities.includes('watch_always_on'));
  assert.ok(manifest.tiers.cli.commands.includes('install'));
});
