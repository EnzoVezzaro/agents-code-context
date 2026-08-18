'use strict';

/**
 * LIVE end-to-end: the engine AI phase against real providers through
 * the AI SDK v5. Requires env keys — skipped when absent so `npm test`
 * stays offline by default:
 *
 *   ACC_NVIDIA_KEY=nvapi-... ACC_GEMINI_KEY=AQ... ACC_OPENROUTER_KEY=sk-or-v1-...
 *
 * Providers are OpenAI-compatible endpoints (NVIDIA NIM, OpenRouter)
 * via @ai-sdk/openai with a base_url, plus Gemini via @ai-sdk/google.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runEngine } = require('../lib/core/engine');
const { load } = require('../lib/core/config');
const { loadEnv } = require('../lib/core/envfile');
// Load the repo's .env (gitignored) so `npm test` picks up the live
// provider keys without exporting them by hand.
loadEnv(path.join(__dirname, '..'));

const PROVIDERS = [
  {
    id: 'nvidia',
    provider: 'openai',
    model: process.env.TEST_NVIDIA_MODEL || 'nvidia/nemotron-3-nano-30b-a3b',
    base_url: 'https://integrate.api.nvidia.com/v1',
    api_key_env: 'ACC_NVIDIA_KEY',
  },
  {
    id: 'gemini',
    provider: 'google',
    model: process.env.TEST_GEMINI_MODEL || 'gemini-3.6-flash',
    base_url: null,
    api_key_env: 'ACC_GEMINI_KEY',
  },
  {
    id: 'openrouter',
    provider: 'openai',
    // NVIDIA Nemotron 3 Nano 30B via OpenRouter's free tier (the
    // provided test key has no purchased credits).
    model: process.env.TEST_OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free',
    base_url: 'https://openrouter.ai/api/v1',
    api_key_env: 'ACC_OPENROUTER_KEY',
  },
];

function makeRepo(providers) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-engine-live-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };
  write('AGENTS.md', '# app\n\n## Purpose\n\nDemo app.\n');
  write(
    'src/auth/AGENTS.md',
    '# auth\n\n## Purpose\n\nAuthentication and session management.\n\n## Dependencies\n\n- src/database\n',
  );
  write('src/auth/token.rs', '// token implementation, uses src/database\n');
  write('src/auth/token_test.rs', '// tests for token.rs\n');
  write('src/database/AGENTS.md', '# database\n\n## Purpose\n\nPersistence.\n');
  write(
    '.acc/config/config.yaml',
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      ...providers.flatMap((p) => [
        `    - id: ${p.id}`,
        `      provider: ${p.provider}`,
        `      model: ${p.model}`,
        ...(p.base_url ? [`      base_url: ${p.base_url}`] : []),
        `      api_key_env: ${p.api_key_env}`,
      ]),
    ].join('\n'),
  );
  return root;
}

for (const p of PROVIDERS) {
  test(`live: acc engine with ${p.id} (${p.model}) keeps knowledge in sync`, { timeout: 90000 }, async (t) => {
    if (!process.env[p.api_key_env]) {
      t.skip(`no ${p.api_key_env} set — live test skipped`);
      return;
    }
    const root = makeRepo([p]);
    const { config, configPresent, configValid, configError } = load(root);
    // force: bypass the commit trigger — the live fixture has no git.
    const out = await runEngine({ root, config, configPresent, configValid, configError, modelId: p.id, apply: true, force: true });

    assert.equal(out.ai.enabled, true, JSON.stringify(out.ai.errors));
    // Provider-level rate limits / quota exhaustion are an external
    // condition, not an ACC bug — surface them as a skip with a clear
    // message so `npm test` does not fail because a free-tier key is
    // spent, while real failures still fail.
    if (out.ai.errors.length) {
      const joined = out.ai.errors.join(' | ');
      if (/rate limit|quota|free tier|free-models|insufficient_quota|429|resource_exhausted/i.test(joined)) {
        t.skip(`provider ${p.id} rate-limited/quota: ${joined.slice(0, 200)}`);
        return;
      }
    }
    assert.ok(out.ai.errors.length === 0, `AI errors for ${p.id}: ${out.ai.errors.join('; ')}`);
    assert.equal(out.ai.provider.id, p.id);
    assert.ok(out.ai.results.length >= 1, `expected at least one boundary result for ${p.id}`);

    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.ok(auth, 'src/auth reviewed');
    assert.ok(Array.isArray(auth.knowledge), 'knowledge is an array');
    assert.ok(Array.isArray(auth.drift), 'drift is an array');
    assert.ok(Array.isArray(auth.skill_gaps), 'skill_gaps is an array');

    // --apply wrote the durable knowledge to the gitignored memory file.
    if (auth.knowledge.length) {
      const mem = fs.readFileSync(path.join(root, 'src', 'auth', '.acc-memory.md'), 'utf8');
      assert.ok(mem.includes(auth.knowledge[0].slice(0, 40)), 'knowledge written to .acc-memory.md');
    }

    // The deterministic scan is still intact alongside the AI phase.
    assert.ok(out.scan.stats.boundaries >= 3);
    assert.ok(out.scan.diagnostics_summary.total >= 1);
  });
}
