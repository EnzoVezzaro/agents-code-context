'use strict';

/**
 * Comprehensive framework coverage: every command and every implemented
 * ACC0xx diagnostic, exercised end-to-end against the real CLI.
 *
 * Organized by command surface (dispatch, init, check + diagnostics,
 * graph, context, relations, impact, search, discover, document, build,
 * fill, memory, tools, battle) so gaps are visible at a glance.
 */
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

function runCatch(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [ACC, ...args], { cwd, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status == null ? 1 : err.status,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

function jsonRun(args, cwd) {
  return JSON.parse(run([...args, '--json'], cwd));
}

// Like jsonRun but tolerates non-zero exits (check exits 1 when errors
// are present — the JSON envelope is still on stdout).
function jsonRunCatch(args, cwd) {
  const r = runCatch([...args, '--json'], cwd);
  return { ...r, json: JSON.parse(r.stdout) };
}

function codes(diags) {
  return diags.map((d) => d.code);
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fw-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Purpose\n\nDemo app.\n');
  return root;
}

function makeBoundary(root, rel, text) {
  const dir = path.join(root, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), text);
  return dir;
}

let HAS_GIT = true;
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  HAS_GIT = false;
}

/* ------------------------------------------------------------------ *
 * Dispatch / global behavior
 * ------------------------------------------------------------------ */

test('unknown command exits 2 with a message on stderr', () => {
  const r = runCatch(['frobnicate'], makeRepo());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command 'frobnicate'/);
});

test('--help lists every implemented and reserved command', () => {
  const out = run(['--help'], process.cwd());
  for (const name of ['init', 'check', 'inspect', 'context', 'graph', 'dependencies', 'dependents', 'impact', 'search', 'discover', 'document', 'build', 'fill', 'memory', 'tools', 'battle']) {
    assert.ok(out.includes(`  ${name.padEnd(14)}`), `--help lists ${name}`);
  }
  for (const name of ['tool', 'shell', 'agents']) {
    assert.ok(out.includes(name), `--help lists reserved ${name}`);
  }
});

test('reserved commands (tool, shell, agents) exit 0 with an informative message', () => {
  for (const name of ['tool', 'shell', 'agents']) {
    const r = runCatch([name, 'test'], makeRepo());
    assert.equal(r.status, 0, `${name} is reserved, not an error`);
    assert.ok(r.stdout.includes('reserved'), `${name} mentions reserved`);
  }
});

test('unknown option exits 2', () => {
  const r = runCatch(['graph', '--bogus'], makeRepo());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option/);
});

test('--json error envelope carries command, kind and exit code (on stderr)', () => {
  const r = runCatch(['graph', '--bogus', '--json'], makeRepo());
  assert.equal(r.status, 2);
  const parsed = JSON.parse(r.stderr);
  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.error.kind, 'usage');
  assert.equal(parsed.error.exit_code, 2);
  assert.equal(parsed.schema_version, 1);
});

test('--root overrides the project root from any cwd', () => {
  const root = makeRepo();
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fw-cwd-'));
  const out = jsonRun(['graph', '--root', root], elsewhere);
  assert.equal(out.root, root);
});

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

test('acc init is idempotent: re-running exits 0 and reports existing files', () => {
  const root = makeRepo();
  run(['init', '.'], root);
  const r = runCatch(['init', '.'], root);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('Exists  .acc/config/config.yaml'));
  assert.ok(!r.stdout.includes('Created .acc/config/config.yaml'));
});

test('acc init --force regenerates the config scaffold', () => {
  const root = makeRepo();
  run(['init', '.'], root);
  const r = runCatch(['init', '.', '--force'], root);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('Created .acc/config/config.yaml'));
});

/* ------------------------------------------------------------------ *
 * check flags
 * ------------------------------------------------------------------ */

test('acc check --exit-zero forces exit 0 even with errors', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), Buffer.from([0xff, 0xfe])); // ACC001 error
  const r = runCatch(['check', '--exit-zero'], root);
  assert.equal(r.status, 0);
  const err = runCatch(['check'], root);
  assert.equal(err.status, 1);
});

test('acc check --severity warn filters out info diagnostics', () => {
  const root = makeRepo(); // ACC062 (info) present
  const out = jsonRun(['check', '--severity', 'warn'], root);
  assert.ok(out.result.diagnostics.every((d) => d.severity !== 'info'));
});

test('acc check --code filters to a specific code', () => {
  const root = makeRepo();
  const out = jsonRun(['check', '--code', 'ACC062'], root);
  assert.deepEqual(codes(out.result.diagnostics), ['ACC062']);
});

test('acc check --quiet suppresses terminal output', () => {
  const root = makeRepo();
  const r = runCatch(['check', '--quiet'], root);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

/* ------------------------------------------------------------------ *
 * Diagnostics — one test per implemented code
 * ------------------------------------------------------------------ */

test('ACC001 — malformed AGENTS.md (not valid UTF-8)', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), Buffer.from([0xff, 0xfe, 0x00]));
  const { json: out } = jsonRunCatch(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC001'));
  const d = out.result.diagnostics.find((x) => x.code === 'ACC001');
  assert.equal(d.severity, 'error');
  assert.equal(d.path, 'AGENTS.md');
});

test('ACC010 — declared dependency does not exist', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Dependencies\n\n- src/missing\n');
  const { json: out } = jsonRunCatch(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC010'));
});

test('ACC014 — circular declared dependency', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Dependencies\n\n- src/a\n');
  makeBoundary(root, 'src/a', '# a\n\n## Dependencies\n\n- src/b\n');
  makeBoundary(root, 'src/b', '# b\n\n## Dependencies\n\n- src/a\n');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC014'));
});

test('ACC022 — discovered dependency not declared', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n');
  makeBoundary(root, 'src/database', '# database\n');
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'mod.rs'), '// uses src/database\n');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC022'));
  const d = out.result.diagnostics.find((x) => x.code === 'ACC022');
  assert.ok(d.message.includes('src/database'));
});

test('ACC030 — duplicate ownership of the same boundary', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Ownership\n\nOwner: team-a\n');
  makeBoundary(root, 'src/x', '# x\n\n## Ownership\n\nOwner: team-b\n');
  const { json: out } = jsonRunCatch(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC030'));
});

test('ACC031 — dependency target with no declared owner', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Dependencies\n\n- src/x\n');
  makeBoundary(root, 'src/x', '# x\n');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC031'));
  const d = out.result.diagnostics.find((x) => x.code === 'ACC031');
  assert.equal(d.severity, 'warn');
  assert.ok(d.message.includes('src/x'));
});

test('ACC031 stays silent when the target declares an owner', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Dependencies\n\n- src/x\n');
  makeBoundary(root, 'src/x', '# x\n\n## Ownership\n\nOwner: x-team\n');
  const out = jsonRun(['check'], root);
  assert.ok(!codes(out.result.diagnostics).includes('ACC031'));
});

test('ACC040 — no language analyzer for an extension', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'data.xyz'), 'x\n');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC040'));
});

test('ACC050 — orphan .acc-memory.md under no contract', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src', 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'x', '.acc-memory.md'), '## 2026-08-16T10:00:00Z\n\nnote\n');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC050'));
  const d = out.result.diagnostics.find((x) => x.code === 'ACC050');
  assert.equal(d.path, 'src/x/.acc-memory.md');
});

test('ACC051 — empty .acc-memory.md', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, '.acc-memory.md'), '');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC051'));
});

test('ACC053 — committed .acc-memory.md', { skip: !HAS_GIT }, () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, '.acc-memory.md'), '## note\n\nx\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.acc-memory.md'], { cwd: root });
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC053'));
});

test('ACC060 — malformed .acc/config/config.yaml', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, '.acc', 'config', 'config.yaml'), 'this is not yaml\n');
  const { json: out } = jsonRunCatch(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC060'));
  assert.equal(out.result.diagnostics.find((x) => x.code === 'ACC060').severity, 'error');
});

test('ACC062 — config absent, defaults used', () => {
  const root = makeRepo();
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC062'));
});

test('ACC072 — orphaned code with no root contract', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fw-orphan-'));
  fs.mkdirSync(path.join(root, 'src', 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'x', 'main.js'), 'export const x = 1;\n');
  const out = jsonRun(['check'], root);
  assert.ok(codes(out.result.diagnostics).includes('ACC072'));
});

test('config ignore patterns keep files out of check', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, '.acc', 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, '.acc', 'config', 'config.yaml'), 'ignore:\n  - vendor/\n');
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
  fs.writeFileSync(path.join(root, 'vendor', 'data.xyz'), 'x\n');
  const out = jsonRun(['check'], root);
  assert.ok(!codes(out.result.diagnostics).includes('ACC040'));
});

/* ------------------------------------------------------------------ *
 * graph
 * ------------------------------------------------------------------ */

function makeGraphRepo() {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n\n## Dependencies\n\n- src/database\n');
  makeBoundary(root, 'src/database', '# database\n');
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'mod.rs'), '// references src/database\n');
  return root;
}

test('acc graph --json returns stable envelope and derived nodes/edges', () => {
  const root = makeGraphRepo();
  const out = jsonRun(['graph'], root);
  assert.equal(out.command, 'graph');
  assert.equal(out.schema_version, 1);
  assert.ok(out.result.nodes.some((n) => n.id === 'src/auth'));
  assert.ok(out.result.edges.some((e) => e.from === 'src/auth' && e.to === 'src/database' && e.kind === 'dependency'));
});

test('acc graph --nodes emits only nodes (no edges)', () => {
  const root = makeGraphRepo();
  const text = run(['graph', '--nodes'], root);
  assert.ok(text.includes('Nodes:'));
  assert.ok(!text.includes('Edges:'));
  const out = jsonRun(['graph', '--nodes'], root);
  assert.deepEqual(out.result.edges, []);
  assert.ok(out.result.nodes.length >= 3);
});

test('acc graph --format mermaid renders a graph LR diagram', () => {
  const root = makeGraphRepo();
  const out = run(['graph', '--format', 'mermaid'], root);
  assert.ok(out.includes('graph LR'));
  assert.ok(out.includes('-->'));
});

test('acc graph --format dot renders a digraph', () => {
  const root = makeGraphRepo();
  const out = run(['graph', '--format', 'dot'], root);
  assert.ok(out.includes('digraph acc {'));
  assert.ok(out.includes('"src/auth" -> "src/database"'));
});

test('acc graph rejects an invalid format (exit 2)', () => {
  const r = runCatch(['graph', '--format', 'xml'], makeRepo());
  assert.equal(r.status, 2);
});

test('acc graph scopes to a path', () => {
  const root = makeGraphRepo();
  const out = jsonRun(['graph', 'src/auth'], root);
  assert.equal(out.result.scope, 'src/auth');
  assert.ok(out.result.nodes.every((n) => n.id === 'src/auth' || n.id.startsWith('src/auth/')));
});

test('acc graph --max-depth limits the subgraph', () => {
  const root = makeRepo();
  makeBoundary(root, 'src', '# src\n');
  makeBoundary(root, 'src/a', '# a\n');
  const out = jsonRun(['graph', '--max-depth', '1'], root);
  const ids = out.result.nodes.map((n) => n.id);
  assert.ok(ids.includes('src'));
  assert.ok(!ids.includes('src/a'));
});

test('acc graph path must be a functionality boundary (exit 2)', () => {
  const r = runCatch(['graph', 'src/nope'], makeRepo());
  assert.equal(r.status, 2);
});

/* ------------------------------------------------------------------ *
 * context
 * ------------------------------------------------------------------ */

function makeContextRepo() {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n\n## Purpose\n\nAuth.\n\n## Dependencies\n\n- src/database\n\n## Constraints\n\n- must not depend on src/ui\n');
  makeBoundary(root, 'src/database', '# database\n\n## Dependencies\n\n- src/config\n');
  makeBoundary(root, 'src/config', '# config\n');
  return root;
}

test('acc context --depth 2 expands transitive contracts', () => {
  const root = makeContextRepo();
  const deep = jsonRun(['context', 'src/auth', '--depth', '2'], root);
  const deps = deep.result.sections.dependencies;
  assert.ok(deps.some((d) => d.to === 'src/config' && d.hop === 1));
  const shallow = jsonRun(['context', 'src/auth', '--depth', '0'], root);
  assert.ok(!shallow.result.sections.dependencies.some((d) => d.to === 'src/config'));
});

test('acc context emits inherited constraints from ancestor contracts', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Constraints\n\n- root rule\n');
  makeBoundary(root, 'src/auth', '# auth\n');
  const out = jsonRun(['context', 'src/auth', '--depth', '0'], root);
  assert.ok(out.result.sections.constraints.some((c) => c.text === 'root rule'));
  assert.equal(out.result.sections.constraints[0].provenance.kind, 'declared');
});

test('acc context --include filters sections', () => {
  const root = makeContextRepo();
  const out = run(['context', 'src/auth', '--include', 'dependencies'], root);
  assert.ok(!out.includes('## Hierarchy'));
  assert.ok(out.includes('## Dependencies'));
});

test('acc context --exclude removes sections', () => {
  const root = makeContextRepo();
  const out = run(['context', 'src/auth', '--exclude', 'implementations'], root);
  assert.ok(!out.includes('## Implementations'));
});

test('acc context --include memory shows contents; default shows existence only', () => {
  const root = makeContextRepo();
  fs.writeFileSync(path.join(root, 'src', 'auth', '.acc-memory.md'), '## 2026-08-16T10:00:00Z\n\ntoken cache is non-reentrant\n');
  const defaultOut = run(['context', 'src/auth', '--depth', '0'], root);
  assert.ok(defaultOut.includes('.acc-memory.md present at'));
  assert.ok(!defaultOut.includes('token cache is non-reentrant'));
  const withMem = run(['context', 'src/auth', '--depth', '0', '--include', 'memory'], root);
  assert.ok(withMem.includes('token cache is non-reentrant'));
});

test('acc context --max-bytes truncates with a marker', () => {
  const root = makeContextRepo();
  const out = run(['context', 'src/auth', '--max-bytes', '120'], root);
  assert.ok(out.includes('[truncated:'));
  const jsonOut = jsonRun(['context', 'src/auth', '--max-bytes', '120'], root);
  assert.equal(jsonOut.result.truncated, true);
  assert.ok(jsonOut.result.truncated_bytes_omitted > 0);
});

test('acc context rejects unknown section kinds (exit 2)', () => {
  const r = runCatch(['context', 'src/auth', '--include', 'bogus'], makeContextRepo());
  assert.equal(r.status, 2);
});

test('acc context rejects --include with --exclude (exit 2)', () => {
  const r = runCatch(['context', 'src/auth', '--include', 'dependencies', '--exclude', 'memory'], makeContextRepo());
  assert.equal(r.status, 2);
});

test('acc context rejects negative --depth and missing paths (exit 2)', () => {
  const root = makeContextRepo();
  assert.equal(runCatch(['context', 'src/auth', '--depth', '-1'], root).status, 2);
  assert.equal(runCatch(['context', 'src/nope'], root).status, 2);
});

test('acc context implementations section reports files and bytes', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'main.js'), 'export const x = 1;\n');
  const out = jsonRun(['context', 'src', '--depth', '0'], root);
  assert.ok(out.result.sections.implementations.files >= 1);
  assert.ok(out.result.sections.implementations.bytes > 0);
  assert.ok(Array.isArray(out.result.sections.implementations.languages));
});

/* ------------------------------------------------------------------ *
 * relations (dependencies / dependents)
 * ------------------------------------------------------------------ */

function makeRelRepo() {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n\n## Dependencies\n\n- src/database\n');
  makeBoundary(root, 'src/database', '# database\n\n## Dependencies\n\n- src/config\n');
  makeBoundary(root, 'src/config', '# config\n');
  // mod.rs references src/config too — discovered but NOT declared.
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'mod.rs'), '// uses src/database and src/config\n');
  return root;
}

test('acc dependencies lists declared and discovered edges', () => {
  const root = makeRelRepo();
  const out = jsonRun(['dependencies', 'src/auth'], root);
  const kinds = out.result.edges.map((e) => e.provenance.kind).sort();
  assert.ok(kinds.includes('declared'), `declared in ${kinds}`);
  assert.ok(kinds.includes('discovered'), `discovered in ${kinds}`);
  assert.ok(out.result.edges.every((e) => e.from === 'src/auth'));
  assert.ok(out.result.edges.some((e) => e.to === 'src/config' && e.provenance.kind === 'discovered'));
});

test('acc dependencies --transitive follows hops with hop counts', () => {
  const root = makeRelRepo();
  const out = jsonRun(['dependencies', 'src/auth', '--transitive'], root);
  const config = out.result.edges.find((e) => e.to === 'src/config' && e.provenance.kind === 'declared');
  assert.ok(config, 'declared transitive edge reaches src/config');
  assert.equal(config.hop, 1);
  // Direct (default) run has no hop > 0 rows.
  const direct = jsonRun(['dependencies', 'src/auth'], root);
  assert.ok(direct.result.edges.every((e) => e.hop === 0));
});

test('acc dependencies --declared filters to declared edges only', () => {
  const root = makeRelRepo();
  const out = jsonRun(['dependencies', 'src/auth', '--declared'], root);
  assert.ok(out.result.edges.length > 0);
  assert.ok(out.result.edges.every((e) => e.provenance.kind === 'declared'));
});

test('acc dependents traverses in the inverse direction', () => {
  const root = makeRelRepo();
  const out = jsonRun(['dependents', 'src/database'], root);
  assert.ok(out.result.edges.some((e) => e.from === 'src/auth' && e.to === 'src/database'));
});

test('acc dependencies rejects mutually exclusive flags (exit 2)', () => {
  const root = makeRelRepo();
  assert.equal(runCatch(['dependencies', 'src/auth', '--direct', '--transitive'], root).status, 2);
  assert.equal(runCatch(['dependencies', 'src/auth', '--declared', '--discovered'], root).status, 2);
});

test('acc dependencies rejects an unknown path (exit 2)', () => {
  assert.equal(runCatch(['dependencies', 'src/nope'], makeRelRepo()).status, 2);
});

/* ------------------------------------------------------------------ *
 * impact
 * ------------------------------------------------------------------ */

test('acc impact reports dependents, tests and constraints', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n');
  makeBoundary(root, 'src/app', '# app\n\n## Dependencies\n\n- src/auth\n\n## Constraints\n\n- audit auth calls\n');
  makeBoundary(root, 'tests/auth', '# auth tests\n\n## Dependencies\n\n- src/auth\n');
  const out = jsonRun(['impact', 'src/auth'], root);
  assert.ok(out.result.dependents.some((d) => d.path === 'src/app' && d.hop === 1));
  assert.ok(out.result.affected_tests.includes('tests/auth'));
  assert.ok(out.result.constraints.some((c) => c.text === 'audit auth calls'));
  const text = run(['impact', 'src/auth'], root);
  assert.ok(text.includes('[test]'));
});

test('acc impact --include tests limits the report', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n');
  makeBoundary(root, 'src/app', '# app\n\n## Dependencies\n\n- src/auth\n\n## Constraints\n\n- audit\n');
  const out = jsonRun(['impact', 'src/auth', '--include', 'tests'], root);
  assert.deepEqual(out.result.constraints, []);
});

/* ------------------------------------------------------------------ *
 * search
 * ------------------------------------------------------------------ */

test('acc search matches contracts, edges and code with provenance', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# app\n\n## Dependencies\n\n- src/database\n');
  makeBoundary(root, 'src/database', '# database\n');
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app', 'index.js'), '// talks to src/database\n');

  const contracts = jsonRun(['search', 'src/database', '--kind', 'contracts'], root);
  assert.ok(contracts.result.results.some((r) => r.kind === 'contract'));
  assert.equal(contracts.result.results.find((r) => r.kind === 'contract').provenance.kind, 'declared');

  const edges = jsonRun(['search', 'src/database', '--kind', 'edges'], root);
  assert.ok(edges.result.results.some((r) => r.kind === 'edge'));

  const code = jsonRun(['search', 'src/database', '--kind', 'code'], root);
  assert.ok(code.result.results.some((r) => r.kind === 'code'));
});

test('acc search --regex and --limit work together', () => {
  const root = makeRepo();
  const out = jsonRun(['search', '^# app', '--kind', 'contracts', '--regex', '--limit', '1'], root);
  assert.ok(out.result.results.length <= 1);
  assert.equal(out.result.results[0].kind, 'contract');
});

test('acc search rejects an invalid kind (exit 2)', () => {
  const r = runCatch(['search', 'x', '--kind', 'bogus'], makeRepo());
  assert.equal(r.status, 2);
});

test('acc search --path restricts scope', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/a', '# a\n');
  makeBoundary(root, 'src/b', '# b\n');
  const out = jsonRun(['search', 'b', '--kind', 'contracts', '--path', 'src/a'], root);
  assert.ok(out.result.results.every((r) => r.path.startsWith('src/a')));
});

/* ------------------------------------------------------------------ *
 * discover
 * ------------------------------------------------------------------ */

test('acc discover suggests missing contracts (dry-run, no writes)', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'lib', 'util'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'util', 'index.js'), 'export const x = 1;\n');
  const out = jsonRun(['discover'], root);
  assert.ok(out.result.suggestions.some((s) => s.kind === 'missing-contract' && s.code === 'ACC072'));
  assert.equal(fs.existsSync(path.join(root, 'lib', 'util', 'AGENTS.md')), false);
  assert.equal(out.result.applied_count, 0);
});

test('acc discover --apply creates missing contracts', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'lib', 'util'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'util', 'index.js'), 'export const x = 1;\n');
  const out = jsonRun(['discover', '--apply'], root);
  assert.ok(out.result.applied_count >= 1);
  assert.equal(fs.existsSync(path.join(root, 'lib', 'util', 'AGENTS.md')), true);
});

test('acc discover surfaces missing, stale and unknown-owner suggestions', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n\n## Dependencies\n\n- src/database\n');
  makeBoundary(root, 'src/database', '# database\n');
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'mod.rs'), '// references src/database\n');
  const out = jsonRun(['discover'], root);
  const kinds = out.result.suggestions.map((s) => s.kind);
  assert.ok(kinds.includes('stale-dependency'), `stale-dependency in ${kinds}`);
  assert.ok(kinds.includes('unknown-owner'), `unknown-owner in ${kinds}`);
});

test('acc discover --kind filters suggestion kinds', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'lib', 'util'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'util', 'index.js'), 'export const x = 1;\n');
  const out = jsonRun(['discover', '--kind', 'missing-contract'], root);
  assert.ok(out.result.suggestions.every((s) => s.kind === 'missing-contract'));
});

test('acc discover reports orphan-code when no root contract exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fw-disc-'));
  fs.mkdirSync(path.join(root, 'src', 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'x', 'main.js'), '// x\n');
  const out = jsonRun(['discover'], root);
  assert.ok(out.result.suggestions.some((s) => s.kind === 'orphan-code'));
});

/* ------------------------------------------------------------------ *
 * document
 * ------------------------------------------------------------------ */

test('acc document --from-discovery fills inferred dependencies', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n');
  makeBoundary(root, 'src/database', '# database\n');
  fs.mkdirSync(path.join(root, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'auth', 'mod.rs'), '// references src/database\n');
  const out = run(['document', 'src/auth', '--from-discovery'], root);
  assert.ok(out.includes('<!-- inferred:'));
  assert.ok(out.includes('src/database'));
});

test('acc document --apply refuses to overwrite without --force (exit 1)', () => {
  const root = makeRepo();
  const r = runCatch(['document', '.', '--apply'], root);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /already exists/);
});

test('acc document --apply --force overwrites', () => {
  const root = makeRepo();
  const r = runCatch(['document', '.', '--apply', '--force'], root);
  assert.equal(r.status, 0);
});

test('acc document rejects a missing directory (exit 2)', () => {
  const r = runCatch(['document', 'src/nope'], makeRepo());
  assert.equal(r.status, 2);
});

/* ------------------------------------------------------------------ *
 * fill
 * ------------------------------------------------------------------ */

test('acc fill scopes to a subtree', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n\n## Purpose\n\nAuth.\n');
  const out = jsonRun(['fill', 'src/auth'], root);
  assert.ok(out.result.files.every((f) => f.file.startsWith('src/auth/')));
});

/* ------------------------------------------------------------------ *
 * memory
 * ------------------------------------------------------------------ */

test('acc memory add/show/clear round-trip with --json', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n');

  const added = jsonRun(['memory', 'add', 'src/auth', 'note one'], root);
  assert.equal(added.result.action, 'added');
  assert.equal(added.result.path, 'src/auth');

  const shown = jsonRun(['memory', 'show', 'src/auth'], root);
  assert.equal(shown.result.exists, true);
  assert.ok(shown.result.contents.includes('note one'));

  const appended = jsonRun(['memory', 'add', 'src/auth', 'note two'], root);
  assert.equal(appended.result.action, 'added');

  const cleared = jsonRun(['memory', 'clear', 'src/auth', '--force'], root);
  assert.equal(cleared.result.action, 'cleared');

  const after = jsonRun(['memory', 'show', 'src/auth'], root);
  assert.equal(after.result.exists, true);
  assert.equal((after.result.contents || '').trim(), '');
});

test('acc memory clear refuses without --force (exit 1)', () => {
  const root = makeRepo();
  makeBoundary(root, 'src/auth', '# auth\n');
  run(['memory', 'add', 'src/auth', 'durable'], root);
  const r = runCatch(['memory', 'clear', 'src/auth'], root);
  assert.equal(r.status, 1);
});

test('acc memory rejects unknown subcommands (exit 2)', () => {
  const r = runCatch(['memory', 'frob', 'src/auth'], makeRepo());
  assert.equal(r.status, 2);
});

/* ------------------------------------------------------------------ *
 * tools
 * ------------------------------------------------------------------ */

test('acc tools lists core tools, detected tools and plugins', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'npm run build' } }));
  fs.mkdirSync(path.join(root, '.acc', 'config', 'tools', 'docker'), { recursive: true });

  const out = jsonRun(['tools'], root);
  const core = out.result.core.map((t) => t.name);
  assert.deepEqual(core, ['filesystem', 'search', 'context', 'graph', 'check', 'memory', 'inspect', 'impact']);
  assert.ok(out.result.detected.some((t) => t.name === 'build'));
  assert.ok(out.result.plugins.some((p) => p.name === 'docker'));

  const text = run(['tools'], root);
  assert.ok(text.includes('✓ filesystem'));
  assert.ok(text.includes('Plugins'));
});

test('acc tools rejects an invalid category (exit 2)', () => {
  const r = runCatch(['tools', '--category', 'bogus'], makeRepo());
  assert.equal(r.status, 2);
});

/* ------------------------------------------------------------------ *
 * battle (help only — never spawns in tests)
 * ------------------------------------------------------------------ */

test('acc battle --help prints usage without spawning', () => {
  const r = runCatch(['battle', '--help'], makeRepo());
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('Usage: acc battle'));
});

test('acc battle requires exactly one project path (exit 2)', () => {
  const r = runCatch(['battle'], makeRepo());
  assert.equal(r.status, 2);
});
