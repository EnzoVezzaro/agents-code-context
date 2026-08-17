'use strict';

/**
 * Tests for the CLI-managed AI provider setup:
 *   - lib/envfile.js — the .env reader/writer (keys never in git).
 *   - acc ai add / remove / default — the select provider → key → model
 *     flow, storing the key in .env and the provider in the CLI-managed
 *     .acc/config/ai.yaml (loaded on top of config.yaml).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseEnv, loadEnv, writeEnv, removeEnvKeys } = require('../lib/core/envfile');
const { load } = require('../lib/core/config');

function makeRepo(configYaml) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-envfile-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  if (configYaml !== undefined) {
    fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, '.acc', 'config', 'config.yaml'), configYaml);
  }
  return root;
}

test('parseEnv: keys, export prefix, quotes, comments preserved', () => {
  const entries = parseEnv([
    '# comment',
    '',
    'PLAIN=value',
    'export EXPORTED=x',
    'QUOTED="hello world"',
    "SINGLE='a b'",
    'NUMBER=42',
    'INLINE=# not a comment',
    'NOEQUALS line without equals',
  ].join('\n'));
  const byKey = Object.fromEntries(entries.filter((e) => e.key).map((e) => [e.key, e.value]));
  assert.equal(byKey.PLAIN, 'value');
  assert.equal(byKey.EXPORTED, 'x');
  assert.equal(byKey.QUOTED, 'hello world');
  assert.equal(byKey.SINGLE, 'a b');
  assert.equal(byKey.NUMBER, '42');
  assert.equal(byKey.INLINE, '# not a comment', 'hash inside a value is not a comment');
  assert.ok(entries.some((e) => e.raw === 'NOEQUALS line without equals'), 'lines without = preserved as-is');
  assert.ok(entries.some((e) => e.raw === '# comment'), 'comments preserved on write');
  assert.ok(entries.some((e) => e.raw === ''), 'blank lines preserved on write');
});

test('loadEnv: never overrides an already-set environment variable', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, '.env'), 'ACC_TEST_ALREADY=from-file\nACC_TEST_NEW=value2\n');
  process.env.ACC_TEST_ALREADY = 'from-shell';
  try {
    const r = loadEnv(root);
    assert.equal(r.loaded, true);
    assert.equal(process.env.ACC_TEST_ALREADY, 'from-shell', 'shell export wins');
    assert.equal(process.env.ACC_TEST_NEW, 'value2', 'new keys loaded');
    assert.ok(r.vars >= 1);
  } finally {
    delete process.env.ACC_TEST_ALREADY;
    delete process.env.ACC_TEST_NEW;
  }
});

test('writeEnv: upserts keys, preserves unrelated lines', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, '.env'), '# header\nKEEP=1\n');
  const { changed } = writeEnv(root, { KEEP: '2', NEW: 'hello world' });
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.ok(text.includes('# header'), 'comment preserved');
  assert.ok(text.includes('KEEP=2'), 'existing key updated');
  assert.ok(text.includes('NEW=hello world'), 'new key appended');
  assert.deepEqual(changed.sort(), ['KEEP', 'NEW']);
});

test('removeEnvKeys: deletes only the requested keys', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, '.env'), 'A=1\nB=2\nC=3\n');
  const { removed } = removeEnvKeys(root, ['B']);
  assert.deepEqual(removed, ['B']);
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.ok(text.includes('A=1'));
  assert.ok(!text.includes('B='));
  assert.ok(text.includes('C=3'));
});

test('config load merges the CLI-managed ai.yaml on top of config.yaml', () => {
  const root = makeRepo('ai:\n  enabled: false\n  providers: []\n');
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'ai.yaml'),
    ['ai:', '  enabled: true', '  default: openrouter', '  providers:', '    - id: openrouter', '      provider: openai', '      model: x', '      api_key_env: ACC_OPENROUTER_KEY', '      base_url: https://openrouter.ai/api/v1'].join('\n'),
  );
  const { config } = load(root);
  assert.equal(config.ai.enabled, true, 'CLI-managed ai.yaml enables AI');
  assert.equal(config.ai.default, 'openrouter');
  assert.equal(config.ai.providers.length, 1);
  assert.equal(config.ai.providers[0].id, 'openrouter');
  assert.equal(config.ai.providers[0].api_key_env, 'ACC_OPENROUTER_KEY');
});

test('config load: .env keys are available via api_key_env (no config edit needed)', () => {
  const root = makeRepo('ai:\n  enabled: true\n  providers:\n    - id: openrouter\n      provider: openai\n      model: x\n      api_key_env: ACC_MY_TEST_KEY\n');
  fs.writeFileSync(path.join(root, '.env'), 'ACC_MY_TEST_KEY=sk-test-from-env\n');
  load(root); // loads .env into process.env
  try {
    assert.equal(process.env.ACC_MY_TEST_KEY, 'sk-test-from-env');
  } finally {
    delete process.env.ACC_MY_TEST_KEY;
  }
});
