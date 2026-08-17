'use strict';

/**
 * Stress tests — big repositories in isolated temp sandboxes.
 *
 * Generates enterprise-scale fixtures (hundreds/thousands of files,
 * many boundaries, tests, skills, standards) and verifies the
 * deterministic pipeline holds at scale:
 *
 *   - graph derivation is correct and deterministic
 *   - `acc graph` / `acc slice` / `acc context` / `acc check` complete
 *   - `acc engine` (AI disabled) scans a big repo deterministically
 *   - nested boundaries resolve parents and slices correctly
 *   - a generous wall-clock budget (CI machines vary; budgets are loose)
 *
 * All fixtures live in mkdtemp sandboxes and are disposed after the run.
 */

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ACC = path.join(__dirname, '..', 'bin', 'acc.js');
const { buildGraph } = require('../lib/core/graph');
const { load } = require('../lib/core/config');

function run(args, cwd) {
  const r = spawnSync(process.execPath, [ACC, ...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  assert.equal(r.status, 0, `${args.join(' ')} failed (${r.status}): ${r.stderr}\n${r.stdout.slice(0, 500)}`);
  return r.stdout;
}

/**
 * Generate a big repo:
 *  - `boundaries` functionality dirs (b000..), each with an AGENTS.md
 *  - each boundary declares a dependency on the previous one (chain)
 *  - `filesPerBoundary` source files; file 0 references the previous
 *    boundary (discovered edge), others reference a random sibling
 *  - test files (*_test.rs) under each boundary
 *  - skills + standards at the top level
 */
function makeBigRepo(root, { boundaries = 40, filesPerBoundary = 20, nestLevels = 0 } = {}) {
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };

  const id = (i) => `b${String(i).padStart(3, '0')}`;
  write('AGENTS.md', '# big\n\n## Purpose\n\nStress fixture.\n');

  const dirOf = (i) => {
    // nestLevels>0 nests boundaries under shared/core/.../bXXX
    let dir = id(i);
    for (let l = 1; l <= nestLevels; l++) dir = `shared/l${l}/${dir}`;
    return dir;
  };

  for (let i = 0; i < boundaries; i++) {
    const dir = dirOf(i);
    const prev = i > 0 ? dirOf(i - 1) : null;
    write(
      `${dir}/AGENTS.md`,
      `# ${id(i)}\n\n## Purpose\n\nBoundary ${i}.\n\n## Ownership\n\nOwner: team-${i}\n\n## Dependencies\n\n${prev ? `- ${prev}\n` : '- (none)\n'}`,
    );
    for (let f = 0; f < filesPerBoundary; f++) {
      // Cross-boundary references → discovered edges.
      const refs = f === 0 && prev ? prev : i > 1 ? dirOf((i + f) % boundaries) : prev;
      write(`${dir}/file${f}.rs`, `// module ${id(i)} file${f} references ${refs}\nfn f${f}() {}\n`);
      if (f % 3 === 0) write(`${dir}/file${f}_test.rs`, `// tests for file${f}\n`);
    }
  }

  write('.agents/skills/skill-a/SKILL.md', '---\nname: skill-a\n---\n\nSkill A.\n');
  write('.agents/skills/skill-b/SKILL.md', '---\nname: skill-b\n---\n\nSkill B.\n');
  write('.acc/config/standards/std-a.md', '# Std A\n');
  write('.acc/config/standards/std-b.md', '# Std B\n');
  return root;
}

test('stress: 1000+ files derive a correct, deterministic graph', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-stress-graph-'));
  makeBigRepo(root, { boundaries: 40, filesPerBoundary: 20 }); // 40 + 40*20 + ~27 tests ≈ 860 files
  const { config } = load(root);
  const t0 = Date.now();
  const a = buildGraph(root, config);
  const b = buildGraph(root, config);
  const ms = Date.now() - t0;

  assert.equal(a.nodes.length, 41, 'root + 40 boundaries');
  assert.ok(a.items.length >= 800, `typed index has ${a.items.length} items`);
  const types = {};
  for (const n of a.items) types[n.type] = (types[n.type] || 0) + 1;
  assert.ok(types.file >= 700, `files: ${types.file}`);
  assert.ok(types.test >= 10, `tests: ${types.test}`);
  assert.equal(types.skill, 2);
  assert.equal(types.standard, 2);
  assert.ok(a.edges.length >= 40, `edges: ${a.edges.length}`);

  assert.equal(JSON.stringify(a.items), JSON.stringify(b.items), 'typed index deterministic at scale');
  assert.equal(JSON.stringify(a.links), JSON.stringify(b.links), 'links deterministic at scale');
  assert.ok(ms < 15000, `derivation within budget (${ms}ms)`);
  console.log(`  graph derivation: ${a.items.length} items, ${a.edges.length} edges, ${a.links.length} links in ${ms}ms`);
});

test('stress: CLI graph/slice/context/check complete on a big repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-stress-cli-'));
  makeBigRepo(root, { boundaries: 30, filesPerBoundary: 15 }); // ~500 files

  const graphOut = run(['graph', '--json'], root);
  const graph = JSON.parse(graphOut);
  assert.equal(graph.result.nodes.length, 31);
  assert.ok(graph.result.edges.length >= 30);

  const slice = JSON.parse(run(['slice', 'b005', '--json'], root));
  assert.equal(slice.result.scope, 'b005');
  assert.ok(slice.result.owns.files.length >= 15, `owns ${slice.result.owns.files.length} files`);

  const ctx = run(['context', 'b005', '--max-bytes', '8192'], root);
  assert.ok(ctx.includes('## Hierarchy'));
  assert.ok(ctx.includes('b005'));

  const check = JSON.parse(run(['check', '--json'], root));
  assert.ok(Array.isArray(check.result.diagnostics));
  assert.ok(check.result.summary.total >= 1);
  console.log(`  CLI on ~500 files: graph ${graph.result.nodes.length} nodes, check ${check.result.summary.total} diagnostics`);
});

test('stress: acc engine scan (AI disabled) is deterministic on a big repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-stress-engine-'));
  makeBigRepo(root, { boundaries: 25, filesPerBoundary: 20 }); // ~550 files

  const a = run(['engine', '--json'], root);
  const b = run(['engine', '--json'], root);
  assert.equal(a, b, 'engine scan byte-identical at scale');

  const parsed = JSON.parse(a);
  assert.ok(parsed.result.scan.stats.boundaries >= 25);
  assert.ok(parsed.result.scan.stats.files >= 400);
  assert.equal(parsed.result.ai.enabled, false);
  console.log(`  engine scan: ${parsed.result.scan.stats.boundaries} boundaries, ${parsed.result.scan.stats.files} files`);
});

test('stress: deeply nested boundaries resolve parents and slices', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-stress-nested-'));
  // A real chain of nested boundaries: every level has its own AGENTS.md.
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };
  write('AGENTS.md', '# app\n\n## Purpose\n\nRoot.\n');
  const levels = ['shared', 'shared/core', 'shared/core/api', 'shared/core/api/v1'];
  levels.forEach((d, i) => {
    write(`${d}/AGENTS.md`, `# ${path.posix.basename(d)}\n\n## Purpose\n\nLevel ${i}.\n`);
  });
  for (let f = 0; f < 5; f++) write(`shared/core/api/v1/endpoint${f}.rs`, `fn endpoint${f}() {}\n`);
  write('shared/core/api/v1/endpoint0_test.rs', '// test\n');
  const { config } = load(root);
  const graph = buildGraph(root, config);
  const { graphSlice } = require('../lib/core/graph');

  const deepest = graph.nodes.find((n) => n.id === 'shared/core/api/v1');
  assert.ok(deepest, 'deepest boundary present');
  assert.equal(deepest.parent, 'shared/core/api', 'parent is the boundary directly above');
  assert.ok(graph.nodes.some((n) => n.id === deepest.parent), 'parent node exists');

  const slice = graphSlice(graph, deepest.id);
  assert.equal(slice.scope, 'shared/core/api/v1');
  assert.ok(slice.owns.files.length >= 5);
  assert.ok(slice.owns.tests.length >= 1);
  // root + shared + core + api + v1 (root → scope ordering)
  assert.ok(slice.governed_by.length >= 5, `governed_by chain: ${slice.governed_by.length} (root + 4 levels)`);
  assert.equal(slice.governed_by[0], 'AGENTS.md', 'root contract first');
  assert.equal(slice.governed_by[slice.governed_by.length - 1], 'shared/core/api/v1/AGENTS.md', 'local contract last');
});

test('stress: one big flat repo end to end via the real CLI', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-stress-big-'));
  makeBigRepo(root, { boundaries: 50, filesPerBoundary: 20 }); // 50 + 1000 files + ~340 tests ≈ 1400 files
  const t0 = Date.now();
  const out = run(['engine', '--json'], root);
  const ms = Date.now() - t0;
  const parsed = JSON.parse(out);
  assert.ok(parsed.result.scan.stats.boundaries >= 50);
  assert.ok(parsed.result.scan.stats.files >= 900);
  assert.ok(ms < 20000, `engine scan of ~1400 files within budget (${ms}ms)`);
  console.log(`  engine scan of ~1400 files completed in ${ms}ms`);
});
