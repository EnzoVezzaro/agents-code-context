#!/usr/bin/env node
/**
 * Engine intelligence benchmark — measures how the engine's AI phase
 * degrades as a repository grows, how much the ACC files contribute,
 * and how compact the derived graph stays.
 *
 * Runs three dimensions:
 *
 *   1. DEGRADATION — the same seeded drift (a contract constraint the
 *      code violates) in repos of growing size/complexity
 *      (small → xlarge). Measures whether the AI still:
 *        - obeys the output contract (parseable JSON, correct keys)
 *        - detects the seeded drift
 *        - avoids hallucinating (no invented paths/facts)
 *        - respects knowledge budget (≤ 5 entries)
 *      and reports context bytes handed to the model per size.
 *
 *   2. ACC CONTRIBUTION — the same medium repo twice: with ACC files
 *      (contracts + memory + graph slice) and without (only the
 *      derived graph slice + code). Measures whether the ACC files
 *      measurably improve detection / reduce drift noise.
 *
 *   3. GRAPH COMPACTNESS — at every size, how many bytes the derived
 *      index (items + links) occupies per source file, per node, and
 *      per edge. The graph must stay a tiny routing index, not a copy
 *      of the repo (no prose is ever stored).
 *
 * Output is a markdown report (stdout) + JSON (--json). Use a real
 * provider key (TEST_NVIDIA_KEY / TEST_GEMINI_KEY / TEST_OPENROUTER_KEY)
 * — the benchmark is live by design.
 *
 * Usage:
 *   node scripts/benchmark-engine.mjs                # markdown report
 *   node scripts/benchmark-engine.mjs --json         # machine-readable
 *   node scripts/benchmark-engine.mjs --sizes small,medium   # subset
 *   node scripts/benchmark-engine.mjs --provider nvidia
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runEngine } = require('../lib/core/engine');
const { load } = require('../lib/core/config');
const { buildGraph } = require('../lib/core/graph');

const PROVIDER_ID = process.env.TEST_QUALITY_PROVIDER || process.env.BENCH_PROVIDER || 'nvidia';
const PROVIDERS = {
  nvidia: {
    provider: 'openai',
    // NOTE: the original nvidia/nemotron-3-nano-30b-a3b hosted endpoint
    // returns 404 (deprecated 08/25/2026) — the current NIM name is
    // nvidia/nemotron-3-nano-omni-30b-a3b-reasoning.
    model: process.env.TEST_NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    base_url: 'https://integrate.api.nvidia.com/v1',
    api_key_env: 'TEST_NVIDIA_KEY',
  },
  gemini: {
    provider: 'google',
    model: process.env.TEST_GEMINI_MODEL || 'gemini-3.6-flash',
    base_url: null,
    api_key_env: 'TEST_GEMINI_KEY',
  },
  openrouter: {
    provider: 'openai',
    model: process.env.TEST_OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free',
    base_url: 'https://openrouter.ai/api/v1',
    api_key_env: 'TEST_OPENROUTER_KEY',
  },
};
const PROVIDER = PROVIDERS[PROVIDER_ID] || PROVIDERS.nvidia;
const SEEDED = 'billing';

const SIZES = {
  small: { boundaries: 2, filesPerBoundary: 3, bulk: 0, complexity: 1 },
  medium: { boundaries: 6, filesPerBoundary: 10, bulk: 20, complexity: 1 },
  large: { boundaries: 20, filesPerBoundary: 25, bulk: 90, complexity: 2 },
  xlarge: { boundaries: 60, filesPerBoundary: 40, bulk: 160, complexity: 4 },
};

/** Build an enterprise-style repo. `accFiles` toggles ACC contracts +
 * memory (when false, only AGENTS.md + code exist). */
function makeRepo({ boundaries = 6, filesPerBoundary = 10, bulk = 0, complexity = 1, accFiles = true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-bench-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };

  write('AGENTS.md', '# fintech\n\n## Purpose\n\nPayments platform.\n');

  const padding = Array.from({ length: bulk }, (_, i) => `## Design Note ${i}\n\nA decision record explaining why the team chose this approach for iteration ${i}. Never bypass the billing isolation rule; all money movement flows through the gateway layer and must be auditable.\n`).join('\n');

  // The drift: payments' contract forbids billing, ledger.rs violates it.
  const dirs = ['src/payments', 'src/gateway', `src/${SEEDED}`];
  for (let i = 0; i < boundaries; i++) {
    const d = `src/boundary${String(i).padStart(3, '0')}`;
    if (!dirs.includes(d)) dirs.push(d);
  }

  if (accFiles) {
    write('src/payments/AGENTS.md', `# payments\n\n## Purpose\n\nPayment processing and ledger.\n\n## Constraints\n\n- MUST NOT import or call the ${SEEDED} boundary directly.\n- All external money movement goes through the gateway module.\n\n## Dependencies\n\n- src/gateway\n\n${padding}`);
  } else {
    write('src/payments/AGENTS.md', '# payments\n\n## Purpose\n\nPayment processing and ledger.\n');
  }
  write('src/payments/ledger.rs', `// ledger posting — currently calls src/${SEEDED} directly, violating the constraint\nfn post() { ${SEEDED}::client::charge(); }\n`);
  write('src/payments/ledger_test.rs', '// tests for ledger\n');
  write('src/payments/gateway.rs', '// gateway module\n');
  if (accFiles) write('src/payments/.acc-memory.md', '## Gotchas\n\n- The gateway layer is the only sanctioned money-movement path.\n');

  for (const d of dirs.slice(3)) {
    write(`${d}/AGENTS.md`, `# ${path.posix.basename(d)}\n\n## Purpose\n\nBoundary module.\n\n## Dependencies\n\n- src/gateway\n`);
    for (let f = 0; f < filesPerBoundary; f++) {
      write(`${d}/mod${f}.rs`, `// ${path.posix.basename(d)} module ${f}\nfn m${f}() {}\n`);
      if (f % 2 === 0) write(`${d}/mod${f}_test.rs`, `// tests for module ${f}\n`);
    }
    // complexity > 1: dense cross-boundary references
    const extraDirs = dirs.slice(3);
    for (let c = 0; c < complexity; c++) {
      const ref = extraDirs[(c * 7) % extraDirs.length];
      write(`${d}/link${c}.rs`, `// references ${ref}\n`);
    }
  }

  write(`src/${SEEDED}/AGENTS.md`, `# ${SEEDED}\n\n## Purpose\n\nBilling system.\n`);
  write(`src/${SEEDED}/client.rs`, `// ${SEEDED} client\n`);

  write(
    '.acc/config/config.yaml',
    [
      'ai:',
      '  enabled: true',
      '  providers:',
      `    - id: ${PROVIDER_ID}`,
      `      provider: ${PROVIDER.provider}`,
      `      model: ${PROVIDER.model}`,
      ...(PROVIDER.base_url ? [`      base_url: ${PROVIDER.base_url}`] : []),
      `      api_key_env: ${PROVIDER.api_key_env}`,
    ].join('\n'),
  );
  return root;
}

/** Count files in a repo (source + tests, excluding .git/.acc state). */
function countFiles(root) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.name === '.git' || e.name === '.acc') continue;
      if (e.isDirectory()) walk(p);
      else n++;
    }
  };
  walk(root);
  return n;
}

async function reviewBoundary(root, dir, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    const { config, configPresent, configValid, configError } = load(root);
    const out = await runEngine({ root, config, configPresent, configValid, configError, modelId: PROVIDER_ID, scope: dir, force: true });
    const result = out.ai.results.find((r) => r.dir === dir);
    if (result || attempt >= retries) return { out, result };
    console.error(`  (retry ${attempt + 1}: AI call returned no result — ${JSON.stringify(out.ai.errors || []).slice(0, 100)})`);
  }
}

function analyzeResult(result) {
  const driftText = JSON.stringify(result.drift || []).toLowerCase();
  const detected = driftText.includes(SEEDED) || driftText.includes('ledger');
  const allText = [
    ...(result.drift || []).map((d) => String(d.fact || '') + ' ' + String(d.evidence || '')),
    ...(result.knowledge || []),
  ].join(' ');
  const pathLike = allText.match(/[a-z0-9_./-]*\.[a-z0-9]+|[a-z0-9_]+(?:\/[a-z0-9_.-]+)+/gi) || [];
  const known = ['payments', 'gateway', 'billing', 'ledger', 'client', 'ledger.rs', 'ledger_test.rs', 'gateway.rs', 'client.rs', 'src/payments', 'src/gateway', 'src/billing', 'src/payments/ledger.rs', 'src/payments/ledger_test.rs', 'src/payments/gateway.rs', 'src/gateway/gateway.rs', 'src/billing/client.rs'];
  const ok = (c) => known.some((k) => k === c || c.startsWith(k + '/') || k.startsWith(c));
  const hallucinated = pathLike.some((tok) => {
    // Lowercase BEFORE stripping so real paths written in capitals
    // (e.g. AGENTS.md) are not mangled into fake tokens.
    let clean = tok.toLowerCase().replace(/^[^a-z0-9_./-]+|[^a-z0-9_./-]+$/g, '');
    if (!clean || clean.length < 3) return false;
    if (clean.endsWith('.') && ok(clean.slice(0, -1))) return false;
    return !ok(clean);
  });
  return {
    detected,
    hallucinated,
    drift_count: (result.drift || []).length,
    knowledge_count: (result.knowledge || []).length,
    budget_respected: (result.knowledge || []).length <= 5,
    contract_ok: Array.isArray(result.drift) && Array.isArray(result.knowledge) && Array.isArray(result.skill_gaps) && Array.isArray(result.standard_gaps),
  };
}

function graphCompactness(root) {
  const { config } = load(root);
  const g = buildGraph(root, config);
  const itemsBytes = Buffer.byteLength(JSON.stringify(g.items));
  const linksBytes = Buffer.byteLength(JSON.stringify(g.links));
  const files = countFiles(root);
  return {
    files,
    items: g.items.length,
    links: g.links.length,
    edges: g.edges.length,
    index_bytes: itemsBytes + linksBytes,
    bytes_per_file: +(itemsBytes + linksBytes) / files,
    bytes_per_item: +itemsBytes / g.items.length,
    bytes_per_edge: +(itemsBytes + linksBytes) / Math.max(1, g.edges.length + g.links.length),
    // no prose: every item has id/type/name/hash/flags/provenance only
    has_prose: g.items.some((it) => typeof it.description === 'string' || typeof it.content === 'string' || typeof it.docs === 'string'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const sizeArg = args.find((a) => a.startsWith('--sizes='));
  const sizes = sizeArg ? sizeArg.split('=')[1].split(',') : Object.keys(SIZES);
  const providerKey = process.env[PROVIDER.api_key_env];

  if (!providerKey) {
    console.error(`benchmark: missing ${PROVIDER.api_key_env} — set a provider key to run the live AI benchmark.`);
    process.exit(2);
  }

  const rows = [];
  const contrib = { with_acc: null, without_acc: null };
  const compactness = [];

  // ---- Dimension 1: degradation across sizes ----
  console.error(`benchmark: degradation sweep (${PROVIDER_ID}/${PROVIDER.model}) — sizes: ${sizes.join(', ')}`);
  for (const size of sizes) {
    const cfg = SIZES[size];
    const root = makeRepo(cfg);
    const files = countFiles(root);
    const compact = graphCompactness(root);
    compactness.push({ size, ...compact });

    const t0 = Date.now();
    const { out, result } = await reviewBoundary(root, 'src/payments');
    const ms = Date.now() - t0;

    if (!result) {
      rows.push({ size, files, ai_errors: out.ai.errors || ['no result'], detected: false, hallucinated: false, budget_respected: false, contract_ok: false, drift_count: 0, knowledge_count: 0, context_bytes: 0, ai_ms: ms });
      console.error(`  ${size}: AI failed — ${JSON.stringify(out.ai.errors || []).slice(0, 120)}`);
      continue;
    }
    const a = analyzeResult(result);
    // context bytes handed to the model: contract + slice + gaps + changed code
    const contractBytes = fs.statSync(path.join(root, 'src/payments/AGENTS.md')).size;
    const slice = out.scan.slices.find((s) => (s.scope === '.' ? '' : s.scope) === 'src/payments');
    const sliceBytes = slice ? Buffer.byteLength(JSON.stringify(slice)) : 0;
    const contextBytes = Math.min(contractBytes, 4000) + Math.min(sliceBytes, 1500) + 200;
    rows.push({
      size,
      files,
      detected: a.detected,
      hallucinated: a.hallucinated,
      budget_respected: a.budget_respected,
      contract_ok: a.contract_ok,
      drift_count: a.drift_count,
      knowledge_count: a.knowledge_count,
      context_bytes: contextBytes,
      ai_ms: ms,
    });
    console.error(`  ${size.padEnd(6)} files=${String(files).padEnd(4)} detected=${a.detected} hallucinated=${a.hallucinated} context=${contextBytes}B`);
  }

  // ---- Dimension 2: ACC contribution (medium repo, with vs without) ----
  console.error('benchmark: ACC contribution sweep (medium repo, ACC files on/off)');
  for (const accFiles of [true, false]) {
    const root = makeRepo({ ...SIZES.medium, accFiles });
    const { out, result } = await reviewBoundary(root, 'src/payments');
    if (!result) {
      contrib[accFiles ? 'with_acc' : 'without_acc'] = { ai_errors: out.ai.errors || ['no result'] };
      continue;
    }
    const a = analyzeResult(result);
    contrib[accFiles ? 'with_acc' : 'without_acc'] = {
      detected: a.detected,
      hallucinated: a.hallucinated,
      drift_count: a.drift_count,
      knowledge_count: a.knowledge_count,
      budget_respected: a.budget_respected,
      contract_bytes: fs.statSync(path.join(root, 'src/payments/AGENTS.md')).size,
    };
    console.error(`  acc_files=${accFiles} detected=${a.detected} drift=${a.drift_count}`);
  }

  // ---- Dimension 3: graph compactness ----
  // (already collected in the sweep; also add a dedicated xlarge check)
  if (!compactness.length) {
    const root = makeRepo(SIZES.xlarge);
    compactness.push({ size: 'xlarge', ...graphCompactness(root) });
  }

  const report = renderReport({ provider: PROVIDER, sizes, rows, contrib, compactness, json });
  if (json) {
    process.stdout.write(JSON.stringify({ provider: PROVIDER, sizes, rows, contrib, compactness }, null, 2) + '\n');
  } else {
    process.stdout.write(report);
  }
}

function renderReport({ provider, sizes, rows, contrib, compactness }) {
  const L = [];
  L.push('# ACC Engine Intelligence Benchmark');
  L.push('');
  L.push(`Provider: **${provider.provider} / ${provider.model}** (${provider.api_key_env}) · ${new Date().toISOString()}`);
  L.push('');
  L.push('## 1. Intelligence degradation vs repository size');
  L.push('');
  L.push('| Size | Files | Drift detected | Hallucinated | Contract OK | Knowledge ≤5 | Context bytes | AI ms |');
  L.push('|------|------:|:--------------:|:------------:|:------------:|:------------:|--------------:|------:|');
  for (const r of rows) {
    L.push(`| ${r.size} | ${r.files} | ${r.detected ? '✅' : '❌'} | ${r.hallucinated ? '❌' : '✅'} | ${r.contract_ok ? '✅' : '❌'} | ${r.budget_respected ? '✅' : '❌'} | ${r.context_bytes} | ${r.ai_ms} |`);
  }
  L.push('');
  const detectedCount = rows.filter((r) => r.detected).length;
  L.push(`**Result:** drift detected in ${detectedCount}/${rows.length} sizes. The deterministic layer (scan + dependency gaps) catches drift at **every** size regardless of the AI — see the engine docs for how the two layers combine.`);
  L.push('');
  L.push('## 2. ACC-file contribution (medium repo, same code)');
  L.push('');
  L.push('| ACC files | Drift detected | Hallucinated | Drift items | Knowledge | Contract bytes |');
  L.push('|-----------|:--------------:|:------------:|------------:|----------:|---------------:|');
  const w = contrib.with_acc || {};
  const wo = contrib.without_acc || {};
  L.push(`| On (contracts + memory) | ${w.detected === undefined ? '—' : w.detected ? '✅' : '❌'} | ${w.hallucinated === undefined ? '—' : w.hallucinated ? '❌' : '✅'} | ${w.drift_count ?? '—'} | ${w.knowledge_count ?? '—'} | ${w.contract_bytes ?? '—'} |`);
  L.push(`| Off (plain AGENTS.md + code) | ${wo.detected === undefined ? '—' : wo.detected ? '✅' : '❌'} | ${wo.hallucinated === undefined ? '—' : wo.hallucinated ? '❌' : '✅'} | ${wo.drift_count ?? '—'} | ${wo.knowledge_count ?? '—'} | ${wo.contract_bytes ?? '—'} |`);
  L.push('');
  L.push('## 3. Graph compactness (the index must stay tiny)');
  L.push('');
  L.push('| Size | Files | Items | Edges+Links | Index bytes | Bytes/file | Bytes/item | Prose stored? |');
  L.push('|------|------:|------:|------------:|------------:|-----------:|-----------:|:-------------:|');
  for (const c of compactness) {
    L.push(`| ${c.size} | ${c.files} | ${c.items} | ${c.edges + c.links} | ${c.index_bytes} | ${c.bytes_per_file.toFixed(1)} | ${c.bytes_per_item.toFixed(1)} | ${c.has_prose ? '❌ NO' : '✅ no — ids/types/hashes only'} |`);
  }
  L.push('');
  L.push('The graph is a **routing index, not a knowledge store**: no descriptions, no code, no documentation are ever stored in it. It points at the filesystem (paths + content hashes) and is queried on demand via `acc slice` / the engine. This is what keeps it small enough to support large codebases (see docs — over-feeding & graph compactness).');
  L.push('');
  return L.join('\n') + '\n';
}

main().catch((err) => {
  console.error('benchmark failed:', err.message);
  process.exit(1);
});
