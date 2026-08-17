'use strict';

/**
 * Engine unit tests. The AI phase is exercised with an injected fake
 * model/generateText — no network, deterministic. The live providers
 * (NVIDIA / Gemini / OpenRouter) are covered separately in
 * test/engine.live.test.js, gated on env keys.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runEngine, parseAiJson } = require('../lib/core/engine');
const { load } = require('../lib/core/config');

function makeRepo(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-engine-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };
  write('AGENTS.md', '# app\n\n## Purpose\n\nDemo.\n');
  write('src/auth/AGENTS.md', '# auth\n\n## Purpose\n\nAuthentication.\n\n## Dependencies\n\n- src/database\n');
  write('src/auth/token.rs', '// uses src/database and src/logging\n');
  write('src/auth/token_test.rs', '// tests\n');
  write('src/database/AGENTS.md', '# database\n\n## Purpose\n\nPersistence.\n');
  write('src/logging/AGENTS.md', '# logging\n\n## Purpose\n\nLogging.\n');
  if (extra.ai) {
    write('.acc/config/config.yaml', extra.ai);
  }
  return root;
}

function fakeGenerate(jsonOrNull) {
  return async () => ({ text: jsonOrNull });
}

const AI_CONFIG = [
  'ai:',
  '  enabled: true',
  '  providers:',
  '    - id: test',
  '      provider: openai',
  '      model: gpt-4o',
  '      api_key_env: ACC_ENGINE_TEST_KEY',
].join('\n');

function loadWithAi(root) {
  return load(root);
}

test('deterministic scan: stats, diagnostics, slices, dependency gaps', async () => {
  const root = makeRepo();
  const { config, configPresent, configValid, configError } = load(root);
  const out = await runEngine({ root, config, configPresent, configValid, configError });

  assert.equal(out.scan.stats.boundaries, 4); // root, src/auth, src/database, src/logging
  assert.equal(out.scan.stats.files, 1);
  assert.equal(out.scan.stats.tests, 1);
  assert.equal(out.scan.stats.edges_declared, 1); // auth → database
  assert.equal(out.scan.stats.edges_discovered, 1); // auth → logging
  assert.equal(out.scan.stats.cycles, 0);

  // src/auth → src/logging discovered but not declared → gap.
  assert.deepEqual(out.scan.dependency_gaps, [{ from: 'src/auth', to: 'src/logging', source: 'discovered reference in src/auth/token.rs' }]);

  const scopes = out.scan.slices.map((s) => s.scope);
  assert.ok(scopes.includes('.'));
  assert.ok(scopes.includes('src/auth'));
  assert.ok(out.scan.slices.find((s) => s.scope === 'src/auth').depends_on.some((d) => d.to === 'src/database'));

  assert.ok(out.scan.diagnostics_summary.total >= 1);
  // AI disabled → no AI phase, deterministic-only.
  assert.equal(out.ai.enabled, false);
  assert.equal(out.sync.applied, false);
});

test('sync dry-run reports the plan without writing', async () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'metrics', 'metrics.go'), 'package metrics\n');
  const { config, configPresent, configValid, configError } = load(root);
  const out = await runEngine({ root, config, configPresent, configValid, configError });

  assert.equal(out.sync.applied, false);
  assert.ok(out.sync.contracts_missing.includes('src/metrics'));
  assert.equal(fs.existsSync(path.join(root, 'src', 'metrics', 'AGENTS.md')), false);
  // Suggestions include declaring the discovered dependency.
  assert.ok(out.sync.suggestions >= 1);
});

test('sync --apply creates missing contracts and declares discovered deps (additive)', async () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'metrics', 'metrics.go'), 'package metrics\n');
  const { config, configPresent, configValid, configError } = load(root);
  const out = await runEngine({ root, config, configPresent, configValid, configError, apply: true });

  assert.equal(out.sync.applied, true);
  assert.ok(out.sync.contracts_created.includes('src/metrics'));
  assert.equal(fs.existsSync(path.join(root, 'src', 'metrics', 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'src', 'metrics', '.acc-memory.md')), true);
  // Declared the discovered dependency in src/auth/AGENTS.md (additive).
  const auth = fs.readFileSync(path.join(root, 'src', 'auth', 'AGENTS.md'), 'utf8');
  assert.ok(auth.includes('- src/logging'), 'discovered dependency declared');
  assert.ok(auth.includes('## Dependencies'), 'contract structure preserved');
});

test('AI phase: knowledge and drift parsed from the model response', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeRepo({ ai: AI_CONFIG });
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const fake = fakeGenerate(
      JSON.stringify({
        drift: [{ fact: 'Auth no longer depends on database', evidence: 'no database imports remain' }],
        knowledge: ['token is non-reentrant', 'clock skew tolerance is 30s'],
        skill_gaps: ['oauth'],
        standard_gaps: [],
      }),
    );
    const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });

    assert.equal(out.ai.enabled, true);
    assert.equal(out.ai.provider.id, 'test');
    assert.equal(out.ai.errors.length, 0);
    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.ok(auth);
    assert.deepEqual(auth.knowledge, ['token is non-reentrant', 'clock skew tolerance is 30s']);
    assert.equal(auth.drift.length, 1);
    assert.deepEqual(auth.skill_gaps, ['oauth']);
    // No --apply → memory not written.
    assert.equal(fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI phase --apply writes knowledge to .acc-memory.md (gitignored, safe)', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeRepo({ ai: AI_CONFIG });
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const fake = fakeGenerate(JSON.stringify({ drift: [], knowledge: ['token is non-reentrant'], skill_gaps: [], standard_gaps: [] }));
    const out = await runEngine({ root, config, configPresent, configValid, configError, apply: true, generateText: fake });

    assert.equal(out.ai.applied, true);
    const mem = fs.readFileSync(path.join(root, 'src', 'auth', '.acc-memory.md'), 'utf8');
    assert.ok(mem.includes('token is non-reentrant'));
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI phase: unparseable response and missing key are reported, never thrown', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    // Unparseable response.
    const root = makeRepo({ ai: AI_CONFIG });
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('sure, here are some thoughts...') });
    assert.ok(out.ai.errors.some((e) => e.includes('unparseable')), JSON.stringify(out.ai.errors));

    // Missing API key.
    delete process.env.ACC_ENGINE_TEST_KEY;
    const root2 = makeRepo({ ai: AI_CONFIG });
    const c2 = loadWithAi(root2);
    const out2 = await runEngine({ root: root2, config: c2.config, configPresent: c2.configPresent, configValid: c2.configValid, configError: c2.configError, generateText: fakeGenerate('{}') });
    assert.ok(out2.ai.errors.some((e) => e.includes('ACC_ENGINE_TEST_KEY')), JSON.stringify(out2.ai.errors));
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI phase: disabled by default and without providers', async () => {
  const root = makeRepo();
  const { config, configPresent, configValid, configError } = load(root);
  const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
  assert.equal(out.ai.enabled, false);
  assert.deepEqual(out.ai.results, []);
});

function fakeGit(root, hashes) {
  // Minimal .git as plain files: HEAD → refs/heads/main, ref file, and
  // a logs/HEAD reflog with one entry per hash.
  const gitDir = path.join(root, '.git');
  fs.mkdirSync(path.join(gitDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(gitDir, 'refs', 'heads'), { recursive: true });
  fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
  fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), hashes[hashes.length - 1] + '\n');
  const lines = [];
  let prev = '0000000000000000000000000000000000000000';
  for (const h of hashes) {
    lines.push(`${prev} ${h} Tester <t@x.com> 1720000000 +0000\tcommit\n`);
    prev = h;
  }
  fs.writeFileSync(path.join(gitDir, 'logs', 'HEAD'), lines.join(''));
}

test('parseAiJson strips markdown fences and tolerates prose', () => {
  assert.deepEqual(parseAiJson('```json\n{"knowledge":["a"]}\n```'), { knowledge: ['a'] });
  assert.deepEqual(parseAiJson('Here you go:\n{"knowledge":["a"],"drift":[]}\n-- done'), { knowledge: ['a'], drift: [] });
  assert.equal(parseAiJson('no json here'), null);
  assert.equal(parseAiJson('{broken'), null);
});

test('trigger: defaults to commits/3 and waits for the threshold', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  // Fake git with 2 commits (below the default threshold of 3).
  fakeGit(root, ['aaaa111111111111111111111111111111111111', 'bbbb222222222222222222222222222222222222']);
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(out.trigger.mode, 'commits');
    assert.equal(out.trigger.threshold, 3);
    assert.equal(out.trigger.current, 2);
    assert.equal(out.trigger.triggered, false);
    assert.equal(out.ai.enabled, true);
    assert.equal(out.ai.skipped, true, 'AI is skipped below the threshold');
    assert.equal(out.ai.results.length, 0);
    // No baseline persisted while waiting.
    assert.equal(fs.existsSync(path.join(root, '.acc', 'state', 'engine.json')), false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('trigger: runs the AI at 3 commits and resets the baseline', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  fakeGit(root, ['aaaa111111111111111111111111111111111111', 'bbbb222222222222222222222222222222222222', 'cccc333333333333333333333333333333333333']);
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(out.trigger.current, 3);
    assert.equal(out.trigger.triggered, true);
    assert.equal(out.ai.skipped, false);
    // Baseline persisted → next run counts 0 commits.
    const state = JSON.parse(fs.readFileSync(path.join(root, '.acc', 'state', 'engine.json'), 'utf8'));
    assert.equal(state.trigger.last_commit, 'cccc333333333333333333333333333333333333');
    const again = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(again.trigger.current, 0);
    assert.equal(again.trigger.triggered, false);
    assert.equal(again.ai.skipped, true);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('trigger: changes mode counts changed files against the snapshot', async () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.acc', 'config', 'config.yaml'),
    ['ai:', '  enabled: true', '  providers:', '    - id: test', '      provider: openai', '      model: gpt-4o', '      api_key_env: ACC_ENGINE_TEST_KEY', 'engine:', '  trigger:', '    mode: changes', '    threshold: 2'].join('\n'),
  );
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    // First run: no baseline → triggered, snapshot recorded.
    const first = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(first.trigger.mode, 'changes');
    assert.equal(first.trigger.triggered, true);
    assert.equal(first.ai.skipped, false);

    // One file changed → still below threshold 2.
    fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// changed once\n');
    const second = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(second.trigger.current, 1);
    assert.equal(second.trigger.triggered, false);
    assert.equal(second.ai.skipped, true);

    // Two files changed → threshold reached, AI runs, snapshot resets.
    fs.writeFileSync(path.join(root, 'src', 'auth', 'token_test.rs'), '// changed twice\n');
    const third = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(third.trigger.current, 2);
    assert.equal(third.trigger.triggered, true);
    assert.equal(third.ai.skipped, false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('trigger: --force and always bypass the threshold', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  fakeGit(root, ['aaaa111111111111111111111111111111111111']);
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const forced = await runEngine({ root, config, configPresent, configValid, configError, force: true, generateText: fakeGenerate('{}') });
    assert.equal(forced.trigger.triggered, true);
    assert.equal(forced.ai.skipped, false);

    fs.writeFileSync(
      path.join(root, '.acc', 'config', 'config.yaml'),
      ['ai:', '  enabled: true', '  providers:', '    - id: test', '      provider: openai', '      model: gpt-4o', '      api_key_env: ACC_ENGINE_TEST_KEY', 'engine:', '  trigger:', '    mode: always'].join('\n'),
    );
    const c2 = loadWithAi(root);
    const always = await runEngine({ root: root, config: c2.config, configPresent: c2.configPresent, configValid: c2.configValid, configError: c2.configError, generateText: fakeGenerate('{}') });
    assert.equal(always.trigger.triggered, true);
    assert.equal(always.ai.skipped, false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('trigger: no git repository falls back to triggered (never skips work)', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(out.trigger.triggered, true);
    assert.ok(out.trigger.reason.includes('no git history'));
    assert.equal(out.ai.skipped, false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('engine scan is deterministic across runs (AI disabled)', async () => {
  const root = makeRepo();
  const { config, configPresent, configValid, configError } = load(root);
  const a = await runEngine({ root, config, configPresent, configValid, configError });
  const b = await runEngine({ root, config, configPresent, configValid, configError });
  assert.equal(JSON.stringify(a.scan), JSON.stringify(b.scan));
  assert.equal(JSON.stringify(a.sync), JSON.stringify(b.sync));
});

const CHANGES_CONFIG = [
  'ai:',
  '  enabled: true',
  '  providers:',
  '    - id: test',
  '      provider: openai',
  '      model: gpt-4o',
  '      api_key_env: ACC_ENGINE_TEST_KEY',
  'engine:',
  '  trigger:',
  '    mode: changes',
  '    threshold: 3',
].join('\n');

test('trigger exposes changed files for the AI to evaluate', async () => {
  const root = makeRepo({ ai: CHANGES_CONFIG });
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    // First run: no baseline → initial baseline recorded, all files listed.
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const first = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(first.trigger.triggered, true);
    assert.ok(first.trigger.changedFiles.includes('src/auth/token.rs'), 'initial run lists all files');

    // Second run: nothing changed → AI waits, changed list empty.
    const again = await runEngine({ root, config, configPresent, configValid, configError, generateText: fakeGenerate('{}') });
    assert.equal(again.ai.skipped, true, 'trigger waits after baseline');
    assert.deepEqual(again.trigger.changedFiles, [], 'no changed files');

    // Change one file → it is the only changed file.
    fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// changed: uses src/logging only\n');
    const forced = await runEngine({ root, config, configPresent, configValid, configError, force: true, generateText: fakeGenerate('{}') });
    assert.deepEqual(forced.trigger.changedFiles, ['src/auth/token.rs'], 'only the changed file listed');
    assert.deepEqual(forced.ai.changed_files, ['src/auth/token.rs'], 'AI phase receives it');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI prompt includes the changed source code (code-aware evaluation)', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// NEW: token now calls src/database::direct\n');
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  const prompts = [];
  const fake = async ({ prompt }) => {
    prompts.push(prompt);
    return { text: JSON.stringify({ drift: [], knowledge: [], skill_gaps: [], standard_gaps: [] }) };
  };
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    await runEngine({ root, config, configPresent, configValid, configError, force: true, generateText: fake });
    assert.ok(prompts.length > 0, 'prompts built');
    const authPrompt = prompts.find((p) => p.includes('Boundary: src/auth'));
    assert.ok(authPrompt, 'src/auth prompt built');
    assert.ok(authPrompt.includes('src/auth/token.rs'), 'changed file path in prompt');
    assert.ok(authPrompt.includes('NEW: token now calls src/database'), 'changed file content in prompt');
    assert.ok(authPrompt.includes('Changed code to evaluate'), 'code section labeled');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

/** A repo with a single contract boundary so supervisor call counts are exact. */
function makeSingleBoundaryRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-engine-sup-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };
  write('AGENTS.md', '# app\n\n## Purpose\n\nDemo.\n');
  write('src/auth/AGENTS.md', '# auth\n\n## Purpose\n\nAuthentication.\n');
  write('src/auth/token.rs', '// uses src/database\n');
  write('.acc/config/config.yaml', AI_CONFIG);
  return root;
}

test('supervisor: score >= threshold approves and writes; below threshold iterates and rejects', async () => {
  const root = makeSingleBoundaryRepo();
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  const supCount = new Map(); // boundary dir → supervisor calls
  const fake = async ({ prompt }) => {
    if (prompt.includes('ACC supervisor')) {
      const m = prompt.match(/Boundary: (.+)/);
      const dir = m ? m[1].trim() : '?';
      const n = (supCount.get(dir) || 0) + 1;
      supCount.set(dir, n);
      const score = n === 1 ? 60 : 95;
      return { text: JSON.stringify({ score, issues: ['knowledge entries are generic — tie them to concrete code'] }) };
    }
    return { text: JSON.stringify({ drift: [], knowledge: ['token is non-reentrant'], skill_gaps: [], standard_gaps: [] }) };
  };
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({
      root, config, configPresent, configValid, configError,
      force: true, supervisor: true, apply: true, generateText: fake,
    });
    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.ok(auth, 'auth reviewed');
    assert.equal(auth.supervisor.enabled, true);
    assert.equal(auth.supervisor.approved, true, 'approved on second iteration');
    assert.equal(auth.supervisor.score, 95);
    assert.ok(auth.supervisor.iterations.length >= 2, 'iterated on supervisor feedback');
    // Approved → knowledge written.
    assert.ok(fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), 'knowledge written after approval');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('supervisor: never writes rejected proposals', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  const fake = async ({ prompt }) => {
    if (prompt.includes('ACC supervisor')) {
      return { text: JSON.stringify({ score: 40, issues: ['violates constraints'] }) };
    }
    return { text: JSON.stringify({ drift: [{ fact: 'x' }], knowledge: ['should not be written'], skill_gaps: [], standard_gaps: [] }) };
  };
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({
      root, config, configPresent, configValid, configError,
      force: true, supervisor: true, apply: true, generateText: fake,
    });
    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.equal(auth.supervisor.approved, false);
    assert.ok(!fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), 'rejected knowledge not written');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('supervisor: no supervisor flag means proposals are written without scoring', async () => {
  const root = makeRepo({ ai: AI_CONFIG });
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const out = await runEngine({
      root, config, configPresent, configValid, configError,
      force: true, apply: true, generateText: fakeGenerate(JSON.stringify({ drift: [], knowledge: ['plain entry'], skill_gaps: [], standard_gaps: [] })),
    });
    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.equal(auth.supervisor.enabled, false);
    assert.ok(fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), 'written without supervisor');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

const FALLBACK_CONFIG = [
  'ai:',
  '  enabled: true',
  '  providers:',
  '    - id: broken',
  '      provider: openai',
  '      model: gpt-4o',
  '      api_key_env: ACC_BROKEN_KEY',
  '    - id: good',
  '      provider: openai',
  '      model: gpt-4o',
  '      api_key_env: ACC_ENGINE_TEST_KEY',
].join('\n');

test('AI phase: falls back to the next provider when one is missing its key', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeRepo({ ai: FALLBACK_CONFIG });
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const fake = fakeGenerate(JSON.stringify({ drift: [], knowledge: ['from the good provider'], skill_gaps: [], standard_gaps: [] }));
    const out = await runEngine({ root, config, configPresent, configValid, configError, force: true, generateText: fake });

    assert.equal(out.ai.errors.length, 0, JSON.stringify(out.ai.errors));
    // The working provider was used, and the skipped one is reported.
    assert.equal(out.ai.provider.id, 'good');
    assert.ok(out.ai.provider_notes.some((n) => n.id === 'broken' && /ACC_BROKEN_KEY/.test(n.error)), JSON.stringify(out.ai.provider_notes));
    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.ok(auth.knowledge.includes('from the good provider'));
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI phase: retries a failing call and reports the recovered attempts', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeRepo({ ai: AI_CONFIG });
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    let calls = 0;
    const fake = async () => {
      calls++;
      if (calls <= 2) throw new Error('ECONNRESET: provider hiccup');
      return { text: JSON.stringify({ drift: [], knowledge: ['recovered after retries'], skill_gaps: [], standard_gaps: [] }) };
    };
    const out = await runEngine({ root, config, configPresent, configValid, configError, force: true, generateText: fake });

    assert.equal(out.ai.errors.length, 0, JSON.stringify(out.ai.errors));
    assert.ok(calls >= 3, `expected retries: ${calls} calls`);
    assert.ok(out.ai.retry_log.length >= 2, JSON.stringify(out.ai.retry_log));
    assert.ok(out.ai.retry_log.every((f) => f.provider === 'test' && /ECONNRESET/.test(f.error)), JSON.stringify(out.ai.retry_log));
    const auth = out.ai.results.find((r) => r.dir === 'src/auth');
    assert.ok(auth.knowledge.includes('recovered after retries'));
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI phase: every provider exhausted is reported as an error, never thrown', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeRepo({ ai: FALLBACK_CONFIG });
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    const fake = async () => { throw new Error('401 invalid api key'); };
    const out = await runEngine({ root, config, configPresent, configValid, configError, force: true, generateText: fake });

    // broken has no key (skipped at resolve), good exhausted → errors.
    assert.ok(out.ai.errors.length >= 1, JSON.stringify(out.ai.errors));
    assert.ok(out.ai.errors.some((e) => e.includes('401 invalid api key')), JSON.stringify(out.ai.errors));
    assert.ok(out.ai.retry_log.length >= 1, JSON.stringify(out.ai.retry_log));
    // Nothing was written and nothing threw.
    assert.equal(out.ai.results.length, 0);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('AI phase: engine.ai.retries: 0 means a single attempt, no retry log', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeSingleBoundaryRepo();
    fs.writeFileSync(
      path.join(root, '.acc', 'config', 'config.yaml'),
      [
        'ai:',
        '  enabled: true',
        '  providers:',
        '    - id: test',
        '      provider: openai',
        '      model: gpt-4o',
        '      api_key_env: ACC_ENGINE_TEST_KEY',
        'engine:',
        '  ai:',
        '    retries: 0',
      ].join('\n'),
    );
    const { config, configPresent, configValid, configError } = loadWithAi(root);
    let calls = 0;
    const fake = async () => {
      calls++;
      throw new Error('boom');
    };
    const out = await runEngine({ root, config, configPresent, configValid, configError, force: true, scope: 'src/auth', generateText: fake });
    // Scoped to src/auth → one boundary → one attempt with retries: 0.
    assert.equal(calls, 1, 'single attempt with retries: 0');
    assert.ok(out.ai.errors.length >= 1, JSON.stringify(out.ai.errors));
    assert.equal(out.ai.retry_log.length, 1, 'one failed attempt recorded');
    assert.equal(out.ai.retry_log[0].attempt, 1, 'no re-attempt happened');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});
