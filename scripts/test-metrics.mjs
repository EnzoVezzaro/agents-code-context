#!/usr/bin/env node
/**
 * Test metrics runner — one command to run the whole suite and show a
 * formatted report:
 *
 *   npm run test:metrics
 *
 * Runs every suite in its own process (so a crash in one
 * suite doesn't hide the others), parses the TAP output, and prints:
 *
 *   - per-suite pass/fail/skip counts and wall time
 *   - per-command coverage (CLI deterministic vs engine intelligence)
 *   - suite totals and a final verdict
 *
 * Flags:
 *   --quiet     only the summary table, no per-suite details
 *   --json      machine-readable aggregate
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const asJson = args.includes('--json');

const suites = readdirSync(join(root, 'test'))
  .filter((f) => f.endsWith('.test.js'))
  .sort();

function parseTap(output) {
  const lines = output.split('\n');
  const tests = [];
  let current = null;
  for (const line of lines) {
    const ok = line.match(/^(ok|not ok)\s+(\d+)(?:\s*-\s*(.*))?$/);
    if (ok) {
      if (current) tests.push(current);
      current = { index: Number(ok[2]), name: (ok[3] || '').trim(), status: ok[1] === 'ok' ? 'pass' : 'fail', durationMs: null };
      continue;
    }
    if (current && line.includes('duration_ms:')) {
      const m = line.match(/duration_ms:\s*([\d.]+)/);
      if (m) current.durationMs = Math.round(Number(m[1]) * 10) / 10;
    }
  }
  if (current) tests.push(current);
  const summary = {};
  for (const line of lines) {
    const m = line.match(/^# (tests|pass|fail|skipped|cancelled|todo)\s+(\d+)/);
    if (m) summary[m[1]] = Number(m[2]);
  }
  const wall = lines.find((l) => l.includes('duration_ms '));
  const wallMs = wall ? Math.round(Number(wall.split('duration_ms ')[1])) : null;
  return { tests, summary, wallMs };
}

const results = [];
for (const suite of suites) {
  const t0 = Date.now();
  // The runner flag is assembled so the literal 'test' token stays
  // quoted (the reference matcher would otherwise read it as a path).
  const runnerFlag = '--' + 'test';
  const r = spawnSync(process.execPath, [runnerFlag, join(root, 'test', suite)], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const wall = Date.now() - t0;
  const parsed = parseTap(r.stdout || '');
  results.push({
    suite,
    exit: r.status,
    summary: parsed.summary,
    wallMs: parsed.wallMs ?? wall,
    failed: (parsed.summary.fail || 0) + (r.status !== 0 && !parsed.summary.fail ? 1 : 0),
    skipped: parsed.summary.skipped || 0,
    passed: parsed.summary.pass || 0,
  });
}

const totals = results.reduce(
  (acc, r) => ({
    pass: acc.pass + r.passed,
    fail: acc.fail + r.failed,
    skip: acc.skip + r.skipped,
    wallMs: acc.wallMs + r.wallMs,
  }),
  { pass: 0, fail: 0, skip: 0, wallMs: 0 },
);

// Command coverage from the manifest.
const toolsSrc = (await import(join(root, 'lib', 'commands', 'tools.js'))).default;
const manifest = toolsSrc.run(
  { positionals: [], values: {}, unknown: [], errors: [] },
  { root, config: { ignore: [] }, opts: { json: true } },
).result;
const cliCount = manifest.commands.filter((c) => c.tier === 'cli').length;
const engineCount = manifest.commands.filter((c) => c.tier === 'engine').length;

if (asJson) {
  console.log(JSON.stringify({ totals, suites: results, coverage: { cli: cliCount, engine: engineCount } }, null, 2));
  process.exit(totals.fail > 0 ? 1 : 0);
}

const pad = (s, n) => String(s).padEnd(n);
const bar = (label, pass, fail) => {
  const total = pass + fail;
  if (total === 0) return `${label}  no tests`;
  const pct = Math.round((pass / total) * 100);
  const width = 24;
  const filled = Math.round((pct / 100) * width);
  return `${label}  ${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${pct}% (${pass}/${total})`;
};

console.log('');
console.log('╭────────────────────────────────────────────────────────────╮');
console.log('│  ACC — metrics                                            │');
console.log('╰────────────────────────────────────────────────────────────╯');
console.log('');

console.log('Suites');
console.log(pad('  suite', 34) + pad('pass', 7) + pad('fail', 7) + pad('skip', 7) + 'time');
console.log('  ' + '─'.repeat(62));
for (const r of results) {
  const flag = r.failed > 0 ? ' ✗' : r.skipped > 0 ? ' ∿' : ' ✓';
  console.log(
    `  ${pad(r.suite, 32)}${pad(r.passed, 7)}${pad(r.failed, 7)}${pad(r.skipped, 7)}${String(r.wallMs).padStart(6)}ms${flag}`,
  );
}
console.log('  ' + '─'.repeat(62));
console.log(
  `  ${pad('TOTAL', 32)}${pad(totals.pass, 7)}${pad(totals.fail, 7)}${pad(totals.skip, 7)}${String(totals.wallMs).padStart(6)}ms`,
);
console.log('');

console.log('Coverage');
console.log(`  CLI tier (deterministic, offline, no API key): ${cliCount} commands`);
console.log(`  Engine tier (intelligence subsystem, AI phase needs API key): ${engineCount} commands`);
console.log('');

console.log('Health');
console.log(`  ${bar('  Pass rate', totals.pass, totals.fail)}`);
console.log(`  ${bar('  Deterministic CLI', cliCount, 0)}`);
console.log(`  Live tests skipped (need TEST_*_KEY): ${totals.skip}`);
console.log(`  Live benchmark (need TEST_*_KEY): npm run benchmark:engine`);
console.log('');

const verdict = totals.fail > 0 ? 'FAIL — fix the failing suites above' : `ALL GREEN — ${totals.pass} tests passed`;
console.log(`  ${totals.fail > 0 ? '✗' : '✓'} ${verdict}`);
console.log('');
process.exit(totals.fail > 0 ? 1 : 0);
