'use strict';

/**
 * Real-situation simulation of the engine's daily loop.
 *
 * Mirrors exactly how the engine is used in a live repository:
 *
 *   1. The agent starts the engine (initial run → baseline recorded).
 *   2. The agent keeps coding — changing 5, 10, then 15 files at once.
 *   3. Change-count trigger: the engine detects the changes and only
 *      does work once the configured threshold is reached. Below it,
 *      nothing happens (AI skipped, no tokens burned).
 *   4. The agent commits to git (simulated by appending reflog entries):
 *      the engine reacts, counts the commits, and runs when the
 *      commit threshold is reached.
 *   5. Supervisor ON: every proposal is scored before writing — the
 *      engine keeps track of score + analysis per boundary across runs.
 *   6. Supervisor OFF: proposals are written without scoring.
 *
 * Deterministic — the AI phase uses an injected fake model, so the
 * whole simulation runs offline, in milliseconds.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runEngine } = require('../lib/core/engine');
const { load } = require('../lib/core/config');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const AI_CONFIG = [
  'ai:',
  '  enabled: true',
  '  providers:',
  '    - id: test',
  '      provider: openai',
  '      model: gpt-4o',
  '      api_key_env: ACC_ENGINE_TEST_KEY',
].join('\n');

/** A repo with several boundaries + source files, like a real project. */
function makeProject(extraConfig = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-sim-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };
  write('AGENTS.md', '# app\n\n## Purpose\n\nDemo project.\n');
  write('src/auth/AGENTS.md', '# auth\n\n## Purpose\n\nAuthentication.\n\n## Dependencies\n\n- src/database\n');
  write('src/auth/token.rs', '// token issuance\npub fn issue() {}\n');
  write('src/auth/session.rs', '// session handling\npub fn open() {}\n');
  write('src/auth/refresh.rs', '// refresh rotation\npub fn rotate() {}\n');
  write('src/auth/token_test.rs', '// tests\n');
  write('src/payments/AGENTS.md', '# payments\n\n## Purpose\n\nBilling.\n\n## Dependencies\n\n- src/database\n');
  write('src/payments/ledger.rs', '// ledger\npub fn charge() {}\n');
  write('src/payments/webhook.rs', '// webhooks\npub fn handle() {}\n');
  write('src/database/AGENTS.md', '# database\n\n## Purpose\n\nPersistence.\n');
  write('src/database/pool.rs', '// connection pool\npub fn pool() {}\n');
  write('src/database/query.rs', '// queries\npub fn run() {}\n');
  write('src/logging/AGENTS.md', '# logging\n\n## Purpose\n\nLogging.\n');
  write('src/logging/log.rs', '// logger\npub fn info() {}\n');
  write('.acc/config/config.yaml', AI_CONFIG + (extraConfig ? '\n' + extraConfig : ''));
  return root;
}

/** Simulate the agent committing: append a reflog entry + bump the ref. */
function makeGit(root) {
  const gitDir = path.join(root, '.git');
  fs.mkdirSync(path.join(gitDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(gitDir, 'refs', 'heads'), { recursive: true });
  fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
  fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), '0000000000000000000000000000000000000000\n');
  fs.writeFileSync(path.join(gitDir, 'logs', 'HEAD'), '');
}

const HASHES = [
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'cccccccccccccccccccccccccccccccccccccccc',
  'dddddddddddddddddddddddddddddddddddddddd',
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  'ffffffffffffffffffffffffffffffffffffffff',
  '1111111111111111111111111111111111111111',
  '2222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333',
];

let commitCount = 0;
function commit(root) {
  const prev = HASHES[Math.max(0, commitCount - 1)];
  const cur = HASHES[commitCount++];
  const log = path.join(root, '.git', 'logs', 'HEAD');
  fs.appendFileSync(log, `${prev || '0000000000000000000000000000000000000000'} ${cur} Tester <t@x.com> 1720000000 +0000\tcommit\n`);
  fs.writeFileSync(path.join(root, '.git', 'refs', 'heads', 'main'), cur + '\n');
  return cur;
}

/** Fake model: records prompts, returns empty proposals by default. */
function makeFakeModel({ knowledge = [], drift = [], score = 95, issues = [] } = {}) {
  const calls = { reviews: 0, supervisors: 0 };
  const fake = async ({ prompt }) => {
    if (prompt.includes('ACC supervisor')) {
      calls.supervisors++;
      return { text: JSON.stringify({ score, issues }) };
    }
    calls.reviews++;
    return { text: JSON.stringify({ drift, knowledge, skill_gaps: [], standard_gaps: [] }) };
  };
  return { fake, calls };
}

const CHANGES_5 = [
  'engine:',
  '  trigger:',
  '    mode: changes',
  '    threshold: 5',
].join('\n');

/* ------------------------------------------------------------------ */
/* 1. The daily loop: engine on, agent keeps working                   */
/* ------------------------------------------------------------------ */

test('simulation: engine runs, agent changes 5/10/15 files, change-count trigger gates the AI', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject(CHANGES_5);
    const { config, configPresent, configValid, configError } = load(root);
    const { fake, calls } = makeFakeModel({ knowledge: ['token rotation is bounded by clock skew'] });

    // 1. Agent starts the engine → initial run, baseline recorded.
    const initial = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(initial.trigger.mode, 'changes');
    assert.equal(initial.trigger.threshold, 5);
    assert.equal(initial.trigger.triggered, true, 'initial run triggers to record the baseline');
    assert.equal(initial.ai.skipped, false);
    const baselineCalls = calls.reviews;

    // 2. Agent keeps coding — nothing changed yet: nothing happens.
    const idle = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(idle.trigger.current, 0);
    assert.equal(idle.trigger.triggered, false, 'no changes → no work');
    assert.equal(idle.ai.skipped, true, 'AI waits');
    assert.equal(calls.reviews, baselineCalls, 'no tokens burned while idle');

    // 3. Agent changes 3 files at once — below the 5-file threshold.
    fs.writeFileSync(path.join(root, 'src', 'auth', 'token.rs'), '// v2: token + clock skew\npub fn issue() {}\n');
    fs.writeFileSync(path.join(root, 'src', 'auth', 'session.rs'), '// v2: sessions\npub fn open() {}\n');
    fs.writeFileSync(path.join(root, 'src', 'payments', 'ledger.rs'), '// v2: ledger\npub fn charge() {}\n');
    const partial = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(partial.trigger.current, 3);
    assert.equal(partial.trigger.triggered, false, 'below threshold → engine does nothing');
    assert.equal(partial.ai.skipped, true);
    assert.equal(calls.reviews, baselineCalls, 'AI untouched below the threshold');

    // 4. Agent changes 2 more (5 total) → threshold reached → engine works.
    fs.writeFileSync(path.join(root, 'src', 'auth', 'refresh.rs'), '// v2: rotation\npub fn rotate() {}\n');
    fs.writeFileSync(path.join(root, 'src', 'payments', 'webhook.rs'), '// v2: webhooks\npub fn handle() {}\n');
    const triggered = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(triggered.trigger.current, 5);
    assert.equal(triggered.trigger.triggered, true, '5 changed files → engine reacts');
    assert.equal(triggered.ai.skipped, false);
    assert.ok(calls.reviews > baselineCalls, 'AI evaluated the changes');
    // The changed files were given to the AI.
    assert.ok(triggered.ai.changed_files.includes('src/auth/token.rs'));
    assert.ok(triggered.ai.changed_files.includes('src/payments/webhook.rs'));

    // 5. Agent changes 10 files at once → all counted, threshold reached.
    for (let i = 0; i < 10; i++) {
      const dir = i % 2 ? 'src/payments' : 'src/auth';
      const name = `bulk_${i}.rs`;
      fs.writeFileSync(path.join(root, dir, name), `// bulk change ${i}\n`);
    }
    const bulk10 = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(bulk10.trigger.current, 10);
    assert.equal(bulk10.trigger.triggered, true);
    assert.equal(bulk10.ai.skipped, false);
    assert.ok(bulk10.ai.changed_files.length >= 10, 'all 10 changed files surfaced');

    // 6. Agent changes 15 files → same behavior at scale.
    for (let i = 0; i < 15; i++) {
      fs.writeFileSync(path.join(root, 'src', 'database', `bulkdb_${i}.rs`), `// bulk db ${i}\n`);
    }
    const bulk15 = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(bulk15.trigger.current, 15);
    assert.equal(bulk15.trigger.triggered, true);
    assert.equal(bulk15.ai.skipped, false);
    assert.ok(bulk15.ai.changed_files.length >= 15, 'all 15 changed files surfaced');

    // 7. Snapshot reset: with nothing new, the engine is quiet again.
    const quiet = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(quiet.trigger.triggered, false);
    assert.equal(quiet.ai.skipped, true);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

/* ------------------------------------------------------------------ */
/* 2. Git-commit trigger: engine reacts after the agent commits        */
/* ------------------------------------------------------------------ */

const COMMITS_3 = [
  'engine:',
  '  trigger:',
  '    mode: commits',
  '    threshold: 3',
].join('\n');

test('simulation: agent commits to git, engine reacts at the commit threshold', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject(COMMITS_3);
    makeGit(root);
    const { config, configPresent, configValid, configError } = load(root);
    const { fake, calls } = makeFakeModel({ knowledge: ['session expiry must be re-checked'] });

    // Initial run with an empty repo (0 commits) → triggered, baseline set.
    const initial = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(initial.trigger.mode, 'commits');
    assert.equal(initial.trigger.threshold, 3);
    assert.equal(initial.trigger.triggered, true, 'first run counts as triggered');
    const baselineCalls = calls.reviews;

    // Agent commits once → 1/3, engine waits.
    commit(root);
    const one = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(one.trigger.current, 1);
    assert.equal(one.trigger.triggered, false, '1 commit below threshold → nothing happens');
    assert.equal(one.ai.skipped, true);
    assert.equal(calls.reviews, baselineCalls);

    // Agent commits twice more → 3/3 → engine reacts and runs the AI.
    commit(root);
    commit(root);
    const three = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(three.trigger.current, 3);
    assert.equal(three.trigger.triggered, true, '3 commits → engine reacts');
    assert.equal(three.ai.skipped, false);
    assert.ok(calls.reviews > baselineCalls, 'AI ran after the commit threshold');

    // Baseline reset: the same 3 commits do not re-trigger.
    const again = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(again.trigger.current, 0);
    assert.equal(again.trigger.triggered, false, 'baseline reset after the run');

    // A single new commit stays below the threshold.
    commit(root);
    const oneMore = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(oneMore.trigger.current, 1);
    assert.equal(oneMore.trigger.triggered, false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('simulation: commits trigger even when no code changed (pure commit counting)', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject(COMMITS_3);
    makeGit(root);
    const { config, configPresent, configValid, configError } = load(root);
    const { fake } = makeFakeModel();
    await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });

    // Three commits with NO file changes: the engine still reacts,
    // because the commit-count mode counts commits, not files.
    commit(root);
    commit(root);
    commit(root);
    const out = await runEngine({ root, config, configPresent, configValid, configError, generateText: fake });
    assert.equal(out.trigger.triggered, true);
    assert.equal(out.ai.skipped, false);
    assert.equal(out.trigger.reason, 'reached 3/3 commits');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

/* ------------------------------------------------------------------ */
/* 3. Supervisor ON: performance tracked (score + analysis)            */
/* ------------------------------------------------------------------ */

test('simulation: supervisor ON scores every boundary and keeps score/analysis per run', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject(CHANGES_5);
    const { config, configPresent, configValid, configError } = load(root);
    const { fake, calls } = makeFakeModel({
      knowledge: ['webhook payloads must be idempotent'],
      score: 92,
      issues: [],
    });

    // First triggered run with the supervisor (--apply: write approved).
    const first = await runEngine({
      root, config, configPresent, configValid, configError,
      supervisor: true, force: true, apply: true, generateText: fake,
    });
    assert.equal(first.ai.supervisor.enabled, true);
    assert.equal(first.ai.supervisor.threshold, 85, 'default threshold from config');
    assert.ok(calls.supervisors >= 1, 'supervisor was consulted');

    // Every boundary got a score + analysis (iterations with issues).
    for (const r of first.ai.results) {
      assert.equal(r.supervisor.enabled, true);
      assert.equal(r.supervisor.approved, true, `${r.dir} approved`);
      assert.equal(r.supervisor.score, 92);
      assert.ok(r.supervisor.iterations.length >= 1, `${r.dir} has iteration analysis`);
      const it = r.supervisor.iterations[0];
      assert.ok('score' in it && 'issues' in it && 'changes' in it, 'iteration records score + analysis');
      assert.equal(it.score, 92);
    }

    // Supervisor scored ABOVE the threshold → knowledge is written.
    assert.ok(fs.existsSync(path.join(root, 'src', 'payments', '.acc-memory.md')), 'approved knowledge written');

    // A second run keeps tracking performance the same way.
    const second = await runEngine({
      root, config, configPresent, configValid, configError,
      supervisor: true, force: true, generateText: fake,
    });
    for (const r of second.ai.results) {
      assert.equal(r.supervisor.score, 92);
      assert.equal(r.supervisor.approved, true);
    }
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

test('simulation: supervisor ON rejects below-threshold proposals and keeps the analysis', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject(CHANGES_5);
    const { config, configPresent, configValid, configError } = load(root);
    // First review scores 45 (< 85) → rejected, feedback loop runs; the
    // re-reviewed proposal also scores 45 → final state: rejected.
    const { fake, calls } = makeFakeModel({
      knowledge: ['unsafe claim'],
      score: 45,
      issues: ['knowledge is generic — tie it to code', 'drift lacks evidence'],
    });

    const out = await runEngine({
      root, config, configPresent, configValid, configError,
      supervisor: true, force: true, apply: true, generateText: fake,
    });
    assert.ok(calls.supervisors >= 1);
    for (const r of out.ai.results) {
      assert.equal(r.supervisor.approved, false, `${r.dir} rejected below threshold`);
      assert.equal(r.supervisor.score, 45);
      assert.ok(r.supervisor.iterations.length >= 1, 'analysis recorded even when rejected');
      assert.ok(r.supervisor.issues.some((i) => i.includes('generic')), 'issues surfaced');
    }
    // Nothing below the threshold is ever written.
    assert.equal(fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), false, 'rejected knowledge not written');
    assert.equal(fs.existsSync(path.join(root, 'src', 'payments', '.acc-memory.md')), false);
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

/* ------------------------------------------------------------------ */
/* 4. Supervisor OFF: proposals written without scoring                */
/* ------------------------------------------------------------------ */

test('simulation: supervisor OFF writes proposals with no scoring, no extra calls', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject(CHANGES_5);
    const { config, configPresent, configValid, configError } = load(root);
    const { fake, calls } = makeFakeModel({ knowledge: ['bulk imports are re-exported at the facade'] });

    const out = await runEngine({
      root, config, configPresent, configValid, configError,
      force: true, apply: true, generateText: fake,
    });
    assert.equal(out.ai.supervisor.enabled, false);
    assert.equal(calls.supervisors, 0, 'no supervisor calls when disabled');
    assert.ok(calls.reviews >= 1, 'review phase ran');
    for (const r of out.ai.results) {
      assert.equal(r.supervisor.enabled, false);
    }
    // Without the supervisor gate, knowledge is written directly.
    assert.ok(fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), 'knowledge written without supervisor');
    assert.ok(fs.existsSync(path.join(root, 'src', 'payments', '.acc-memory.md')));
    const mem = fs.readFileSync(path.join(root, 'src', 'auth', '.acc-memory.md'), 'utf8');
    assert.ok(mem.includes('bulk imports are re-exported'), 'entry persisted');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});

/* ------------------------------------------------------------------ */
/* 5. Supervisor threshold is configurable                             */
/* ------------------------------------------------------------------ */

test('simulation: supervisor threshold comes from config and gates approval', async () => {
  process.env.ACC_ENGINE_TEST_KEY = 'test-key';
  try {
    const root = makeProject([
      'engine:',
      '  trigger:',
      '    mode: changes',
      '    threshold: 1',
      '  supervisor:',
      '    threshold: 50',
      '    max_iterations: 1',
    ].join('\n'));
    const { config, configPresent, configValid, configError } = load(root);
    const { fake } = makeFakeModel({ knowledge: ['ok'], score: 55, issues: [] });

    const out = await runEngine({
      root, config, configPresent, configValid, configError,
      supervisor: true, force: true, apply: true, generateText: fake,
    });
    assert.equal(out.ai.supervisor.threshold, 50, 'configured threshold used');
    for (const r of out.ai.results) {
      assert.equal(r.supervisor.approved, true, '55 >= 50 → approved');
      assert.equal(r.supervisor.score, 55);
    }
    assert.ok(fs.existsSync(path.join(root, 'src', 'auth', '.acc-memory.md')), 'approved at configured threshold');
  } finally {
    delete process.env.ACC_ENGINE_TEST_KEY;
  }
});
