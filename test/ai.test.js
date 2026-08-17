'use strict';

/**
 * AI configuration layer (lib/ai.js) — AI SDK v5.
 *
 * Contract under test:
 *   - AI is OFF by default: core ACC never loads or requires AI code.
 *   - Config supports ONE OR MORE providers under `ai.providers`.
 *   - Provider packages are loaded lazily (only when a model is
 *     requested), never at config/graph/scan time.
 *   - API keys come from environment variables, never from the config
 *     file, and are checked without a network call.
 *   - Model instantiation is offline: building a model never contacts
 *     a provider.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('../lib/core/config');
const { providersOf, getModel } = require('../lib/core/ai');

function makeRepo(configYaml) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-ai-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n');
  if (configYaml !== undefined) {
    fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, '.acc', 'config', 'config.yaml'), configYaml);
  }
  return root;
}

test('AI is disabled by default (offline-first)', () => {
  const root = makeRepo(undefined);
  const { config } = load(root);
  assert.equal(config.ai.enabled, false);
  assert.deepEqual(config.ai.providers, []);
  assert.deepEqual(providersOf(config), []);
  const got = getModel(config);
  assert.ok(got.error && got.error.includes('disabled'));
});

test('empty providers list (all commented) never nukes the default array', () => {
  // The example config.yaml ships with `ai:` enabled but every provider
  // commented out — YAML parses the bare `providers:` key as null.
  // The loader must normalize it back to [] (same protection as `ignore`).
  const root = makeRepo(
    [
      'ai:',
      '  enabled: false',
      '  # default: main',
      '  providers:',
      '    # - id: main',
      '    #   provider: openai',
      '    #   model: gpt-4o',
    ].join('\n'),
  );
  const { config, configValid } = load(root);
  assert.equal(configValid, true);
  assert.ok(Array.isArray(config.ai.providers), 'providers must stay an array');
  assert.deepEqual(config.ai.providers, []);
  assert.deepEqual(providersOf(config), []);
  const got = getModel(config);
  assert.ok(got.error && got.error.includes('disabled'));
});

test('one or more providers are parsed from config', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  default: main',
      '  providers:',
      '    - id: main',
      '      provider: openai',
      '      model: gpt-4o',
      '      api_key_env: OPENAI_API_KEY',
      '    - id: fallback',
      '      provider: anthropic',
      '      model: claude-sonnet-4-5',
      '      api_key_env: ANTHROPIC_API_KEY',
    ].join('\n'),
  );
  const { config } = load(root);
  const providers = providersOf(config);
  assert.equal(providers.length, 2);
  assert.equal(providers[0].id, 'main');
  assert.equal(providers[0].package, '@ai-sdk/openai');
  assert.equal(providers[0].model, 'gpt-4o');
  assert.equal(providers[0].api_key_env, 'OPENAI_API_KEY');
  assert.equal(providers[1].provider, 'anthropic');
  assert.equal(providers[1].package, '@ai-sdk/anthropic');
});

test('malformed providers are flagged, never thrown', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      '    - provider: openai',
      '      model: gpt-4o',
      '    - id: bad',
      '    - id: no-model',
      '      provider: openai',
      '    - id: weird',
      '      provider: unknown-thing',
      '      model: x',
    ].join('\n'),
  );
  const { config } = load(root);
  const providers = providersOf(config);
  assert.ok(providers[0].errors.includes('missing id'));
  assert.ok(providers[1].errors.includes('missing model'));
  assert.ok(providers[2].errors.includes('missing model'));
  assert.ok(providers[3].errors.some((e) => e.includes("unknown provider 'unknown-thing'")));
});

test('custom provider package names are supported', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      '    - id: custom',
      '      provider: "@ai-sdk/groq"',
      '      model: llama-3.3-70b',
    ].join('\n'),
  );
  const { config } = load(root);
  const [p] = providersOf(config);
  assert.equal(p.package, '@ai-sdk/groq');
  // Not installed → getModel reports it without throwing.
  const got = getModel(config, 'custom');
  assert.ok(got.error && got.error.includes("'@ai-sdk/groq' is not installed"));
});

test('getModel returns an AI SDK v5 model when enabled and key is present', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  default: main',
      '  providers:',
      '    - id: main',
      '      provider: openai',
      '      model: gpt-4o-mini',
      '      api_key_env: ACC_TEST_OPENAI_KEY',
    ].join('\n'),
  );
  process.env.ACC_TEST_OPENAI_KEY = 'test-key';
  try {
    const { config } = load(root);
    const got = getModel(config);
    assert.ok(!got.error, JSON.stringify(got));
    assert.ok(got.model);
    assert.equal(got.model.modelId, 'gpt-4o-mini');
    assert.equal(got.meta.id, 'main');
  } finally {
    delete process.env.ACC_TEST_OPENAI_KEY;
  }
});

test('getModel resolves the default and named providers', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      '    - id: a',
      '      provider: anthropic',
      '      model: claude-3-5-sonnet',
      '      api_key_env: ACC_TEST_ANTHROPIC_KEY',
      '    - id: b',
      '      provider: google',
      '      model: gemini-1.5-pro',
      '      api_key_env: ACC_TEST_GOOGLE_KEY',
    ].join('\n'),
  );
  process.env.ACC_TEST_ANTHROPIC_KEY = 'k1';
  process.env.ACC_TEST_GOOGLE_KEY = 'k2';
  try {
    const { config } = load(root);
    // No default → first provider wins.
    const first = getModel(config);
    assert.equal(first.meta.id, 'a');
    // Named resolution.
    const named = getModel(config, 'b');
    assert.equal(named.meta.provider, 'google');
    assert.equal(named.model.modelId, 'gemini-1.5-pro');
    // Unknown id → error.
    assert.ok(getModel(config, 'nope').error.includes("no AI provider configured with id 'nope'"));
  } finally {
    delete process.env.ACC_TEST_ANTHROPIC_KEY;
    delete process.env.ACC_TEST_GOOGLE_KEY;
  }
});

test('missing API key is reported without a network call', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      '    - id: main',
      '      provider: openai',
      '      model: gpt-4o',
      '      api_key_env: ACC_TEST_NEVER_SET',
    ].join('\n'),
  );
  delete process.env.ACC_TEST_NEVER_SET;
  const { config } = load(root);
  const got = getModel(config);
  assert.ok(got.error && got.error.includes('ACC_TEST_NEVER_SET'));
});

test('config file never contains the key itself — only the env var name', () => {
  const root = makeRepo(
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      '    - id: main',
      '      provider: openai',
      '      model: gpt-4o',
      '      api_key_env: OPENAI_API_KEY',
    ].join('\n'),
  );
  const raw = fs.readFileSync(path.join(root, '.acc', 'config', 'config.yaml'), 'utf8');
  assert.ok(!raw.includes('sk-'), 'the config file must never store a key value');
});
