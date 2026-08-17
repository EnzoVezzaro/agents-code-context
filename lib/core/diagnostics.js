/**
 * Stable diagnostic registry (ACC0xx) and `acc check` validation.
 *
 * Codes and severities are stable per the diagnostic codes spec:
 * renumbering or repurposing a code is forbidden. V1 implements the subset
 * below; the full registry is documented in the spec.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph } = require('./graph');
const { walkFiles, readUtf8, cmp, isUtf8, dirOf } = require('./util');

const REGISTRY = {
  ACC001: { severity: 'error', message: "malformed AGENTS.md at {path}: not valid UTF-8" },
  ACC010: { severity: 'error', message: "broken reference: {ref} in {path} does not exist" },
  ACC012: { severity: 'error', message: "reference '{ref}' in {path} is not a functionality boundary" },
  ACC014: { severity: 'warn', message: "circular reference: {cycle}" },
  ACC022: { severity: 'warn', message: "discovered dependency '{from} → {to}' not declared in any AGENTS.md" },
  ACC024: { severity: 'error', message: "forbidden dependency detected: '{from} → {to}'" },
  ACC025: { severity: 'warn', message: "forbidden dependency declared but unenforced: '{from} → {to}'" },
  ACC030: { severity: 'error', message: "duplicate ownership: {path} claimed by {owners}" },
  ACC031: { severity: 'warn', message: "unowned dependency target: {path} has no declared owner" },
  ACC040: { severity: 'info', message: "no language analyzer for extension '{ext}'" },
  ACC050: { severity: 'warn', message: "orphan .acc-memory.md at {path}: no AGENTS.md in this directory or any ancestor" },
  ACC051: { severity: 'info', message: "empty .acc-memory.md at {path}" },
  ACC053: { severity: 'warn', message: ".acc-memory.md at {path} appears committed (not gitignored)" },
  ACC054: { severity: 'info', message: "memory file at {path} exceeds memory.warn_bytes ({bytes} > {warn_bytes})" },
  ACC065: { severity: 'warn', message: "forbidden_deps rule references unknown path '{path}'" },
  ACC060: { severity: 'error', message: "malformed .acc/config/config.yaml: {reason}" },
  ACC062: { severity: 'info', message: ".acc/config/config.yaml absent; using defaults" },
  ACC072: { severity: 'info', message: "orphaned code at {path}: no AGENTS.md covers this directory" },
};

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

function severityOf(code) {
  return REGISTRY[code] ? REGISTRY[code].severity : 'info';
}

function isError(code) {
  return severityOf(code) === 'error';
}

/**
 * Run the validation pipeline.
 * Returns diagnostics: [{ code, severity, path, message, detail }] sorted.
 */
function check(root, config, meta = {}) {
  const diags = [];
  const push = (code, p, message, detail) => {
    diags.push({ code, severity: severityOf(code), path: p, message, detail });
  };

  if (meta.configPresent && !meta.configValid) {
    push('ACC060', '.acc/config/config.yaml', REGISTRY.ACC060.message.replace('{reason}', meta.error || 'invalid YAML'));
  } else if (!meta.configPresent) {
    push('ACC062', '.acc/config/config.yaml', REGISTRY.ACC062.message);
  }

  const files = walkFiles(root, root, config.ignore || [], []);
  const dirSet = new Set(files.map((f) => dirOf(f)));
  const boundaryDirs = new Set();
  const contracts = {};

  for (const rel of files) {
    if (path.posix.basename(rel).toLowerCase() !== 'agents.md') continue;
    const dir = dirOf(rel);
    const abs = path.join(root, rel);
    const buf = fs.readFileSync(abs);
    if (!isUtf8(buf)) {
      push('ACC001', rel, REGISTRY.ACC001.message.replace('{path}', rel));
      continue;
    }
    boundaryDirs.add(dir);
    contracts[dir] = { text: buf.toString('utf8'), source: rel };
  }
  boundaryDirs.add('');

  // Dirs with an actual AGENTS.md contract. The implicit root node is a
  // graph node, but for memory/code anchoring (ACC050 / ACC072) only a
  // directory with a real contract counts — otherwise those checks could
  // never fire (root always resolves).
  const declaredBoundaries = new Set(Object.keys(contracts));

  const resolveBoundary = (clean) => {
    if (boundaryDirs.has(clean)) return clean;
    let d = clean;
    while (d.includes('/')) {
      d = d.slice(0, d.lastIndexOf('/'));
      if (boundaryDirs.has(d)) return d;
    }
    return boundaryDirs.has('') ? '' : null;
  };

  // Broken references + not-a-boundary (ACC010 / ACC012) and owners.
  const ownerClaims = new Map(); // path -> [owners]
  const depTargets = []; // { from, source, target } — for ACC031 / ACC022

  for (const [dir, c] of Object.entries(contracts)) {
    const parsed = require('./agents').parse(c.text);
    for (const dep of parsed.deps) {
      const target = resolveBoundary(dep.replace(/\/+$/, ''));
      const abs = path.join(root, dir, dep);
      const exists =
        fs.existsSync(abs) || fs.existsSync(path.join(root, dep));
      if (!exists) {
        push('ACC010', c.source, REGISTRY.ACC010.message.replace('{ref}', dep).replace('{path}', c.source));
      } else if (target === null) {
        push('ACC012', c.source, REGISTRY.ACC012.message.replace('{ref}', dep).replace('{path}', c.source));
      }
      if (target !== null) depTargets.push({ from: dir, source: c.source, target });
    }
    for (const owner of parsed.owners) {
      // A path owner (e.g. `Owner: src/platform`) claims that boundary
      // (per the authoring guide: path owners become ownership edges). A
      // bare team name (e.g. `Owner: platform-team`) is a label for this
      // contract's own boundary — it is claimed below, never resolved up
      // to the root (which would produce false ACC030 duplicates).
      const clean = owner.replace(/\/+$/, '');
      let stat = null;
      try { stat = fs.statSync(path.join(root, clean)); } catch { /* not a path */ }
      if (!stat || !stat.isDirectory()) continue;
      const target = resolveBoundary(clean);
      if (target !== null) {
        if (!ownerClaims.has(target)) ownerClaims.set(target, []);
        ownerClaims.get(target).push({ owner, source: c.source });
      }
    }
    // A contract that declares any owner claims itself (ACC031 semantics:
    // an AGENTS.md with an Ownership section means the boundary is owned —
    // the owner string itself may not resolve back to this boundary).
    if (parsed.owners.length > 0) {
      if (!ownerClaims.has(dir)) ownerClaims.set(dir, []);
      ownerClaims.get(dir).push({ owner: parsed.owners[0], source: c.source });
    }
  }

  // Duplicate ownership (ACC030): same boundary claimed by different sources.
  // ownership.strict: true → fail fast (stop at the first conflict);
  // false (default) → collect every conflict.
  for (const [target, claims] of ownerClaims) {
    const uniqueSources = [...new Set(claims.map((c) => c.source))];
    const uniqueOwners = [...new Set(claims.map((c) => c.owner))];
    if (uniqueSources.length > 1 && uniqueOwners.length > 1) {
      push('ACC030', target || '.', REGISTRY.ACC030.message.replace('{path}', target || '.').replace('{owners}', uniqueOwners.join(', ')));
      if (config.ownership && config.ownership.strict) break;
    }
  }

  // Unowned dependency targets (ACC031): a declared dependency target with
  // no owner claim anywhere in the repository.
  const claimed = new Set(ownerClaims.keys());
  const seen031 = new Set();
  for (const { source, target } of depTargets) {
    const key = `${source}\u0000${target}`;
    if (seen031.has(key)) continue;
    seen031.add(key);
    if (!claimed.has(target)) {
      push('ACC031', source, REGISTRY.ACC031.message.replace('{path}', target === '' ? '.' : target));
    }
  }

  // ACC022: discovered dependency edges with no declared counterpart.
  // Declared facts win (per the epistemology spec); a discovered edge
  // that nothing declares is the classic "the code drifted from the
  // contract" signal. A declared edge to a boundary also covers
  // discovered edges to its sub-boundaries: declaring a dep on a parent
  // boundary covers references to its children.
  const declaredPairs = new Set(depTargets.map((d) => `${d.from}\u0000${d.target}`));
  const covers = (from, to) => {
    let t = to;
    for (;;) {
      if (declaredPairs.has(`${from}\u0000${t}`)) return true;
      if (!t.includes('/')) break;
      t = t.slice(0, t.lastIndexOf('/'));
    }
    return false;
  };
  const derived = buildGraph(root, config);
  for (const e of derived.edges) {
    if (e.kind !== 'dependency' || e.provenance.kind !== 'discovered') continue;
    if (covers(e.from, e.to)) continue;
    const from = e.from === '' ? '.' : e.from;
    const to = e.to === '' ? '.' : e.to;
    push('ACC022', e.provenance.source, REGISTRY.ACC022.message.replace('{from}', from).replace('{to}', to));
  }

  // Forbidden dependency rules (config.forbidden_deps): ACC024 for an
  // edge (declared or discovered) under both prefixes, ACC025 for an
  // inert rule (paths exist but nothing matches), ACC065 for a rule
  // naming a path that does not exist.
  const under = (a, b) => {
    const aa = a === '' ? '.' : a;
    const bb = b === '' || b === '.' ? '' : b.replace(/\/+$/, '');
    if (bb === '') return true; // a rule targeting the root matches everything
    return aa === bb || aa.startsWith(bb + '/');
  };
  const rules = Array.isArray(config.forbidden_deps) ? config.forbidden_deps : [];
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    const from = String(rule.from == null ? '' : rule.from).replace(/\/+$/, '');
    const to = String(rule.to == null ? '' : rule.to).replace(/\/+$/, '');
    // ACC065: rule references a path that doesn't exist.
    let missing = false;
    for (const p of [from, to]) {
      const clean = p === '' || p === '.' ? '' : p;
      if (clean !== '' && !fs.existsSync(path.join(root, clean))) {
        missing = true;
        push('ACC065', '.acc/config/config.yaml', REGISTRY.ACC065.message.replace('{path}', clean));
      }
    }
    let matched = false;
    for (const e of derived.edges) {
      if (e.kind !== 'dependency') continue;
      if (!under(e.from, from) || !under(e.to, to)) continue;
      matched = true;
      push('ACC024', e.provenance.source || '.acc/config/config.yaml', REGISTRY.ACC024.message.replace('{from}', e.from === '' ? '.' : e.from).replace('{to}', e.to === '' ? '.' : e.to));
    }
    // A rule is inert only when its paths exist but nothing matches.
    if (!matched && !missing && from !== '' && to !== '') {
      push('ACC025', '.acc/config/config.yaml', REGISTRY.ACC025.message.replace('{from}', from === '' ? '.' : from).replace('{to}', to === '' ? '.' : to));
    }
  }

  // Memory checks (ACC050 / ACC051 / ACC053).
  for (const rel of files) {
    const base = path.posix.basename(rel);
    if (base !== '.acc-memory.md') continue;
    const dir = dirOf(rel);
    // ACC050: memory is orphan when no AGENTS.md exists in this directory
    // or any ancestor. The implicit root node is not an anchor — only a
    // directory with an actual contract is.
    let hasAnchor = declaredBoundaries.has(dir);
    if (!hasAnchor) {
      let d = dir;
      while (d.includes('/')) {
        d = d.slice(0, d.lastIndexOf('/'));
        if (declaredBoundaries.has(d)) { hasAnchor = true; break; }
      }
    }
    if (!hasAnchor) {
      push('ACC050', rel, REGISTRY.ACC050.message.replace('{path}', rel));
    }
    const stat = fs.statSync(path.join(root, rel));
    if (stat.size === 0) {
      push('ACC051', rel, REGISTRY.ACC051.message.replace('{path}', rel));
    }
    // memory.warn_bytes (config control plane): over the threshold → ACC054.
    const warnBytes = Number.isFinite(config.memory?.warn_bytes) ? config.memory.warn_bytes : 65536;
    if (stat.size > warnBytes) {
      push('ACC054', rel, REGISTRY.ACC054.message.replace('{path}', rel).replace('{bytes}', stat.size).replace('{warn_bytes}', warnBytes));
    }
    if (isGitTracked(root, rel)) {
      push('ACC053', rel, REGISTRY.ACC053.message.replace('{path}', rel));
    }
  }

  // Orphaned code (ACC072): source dirs with no enclosing contract.
  const srcDirs = new Set();
  for (const rel of files) {
    if (/\.(rs|ts|tsx|js|jsx|go|py|java|rb|php|c|cpp|h|hpp|swift|kt|cs)$/.test(rel)) {
      srcDirs.add(dirOf(rel));
    }
  }
  for (const dir of srcDirs) {
    if (declaredBoundaries.has(dir)) continue;
    let d = dir;
    let covered = false;
    while (d.includes('/')) {
      d = d.slice(0, d.lastIndexOf('/'));
      if (declaredBoundaries.has(d)) { covered = true; break; }
    }
    if (!covered && !declaredBoundaries.has('')) {
      push('ACC072', dir || '.', REGISTRY.ACC072.message.replace('{path}', dir || '.'));
    }
  }

  // No-analyzer info (ACC040): one per extension present, at most once.
  // An extension is "covered" when a configured analyzer maps to it.
  const ANALYZER_EXTS = {
    rust: ['.rs'],
    typescript: ['.ts', '.tsx', '.mts', '.cts'],
    go: ['.go'],
    python: ['.py', '.pyi'],
    java: ['.java'],
    csharp: ['.cs'],
    cpp: ['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx'],
    ruby: ['.rb'],
    php: ['.php'],
    swift: ['.swift'],
    kotlin: ['.kt', '.kts'],
    javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  };
  const covered = new Set();
  for (const [name, on] of Object.entries(config.language_analyzers || {})) {
    if (on) for (const e of ANALYZER_EXTS[name] || []) covered.add(e);
  }
  const exts = new Set();
  for (const rel of files) {
    const ext = path.posix.extname(rel);
    if (ext && /^\.[a-z0-9]+$/i.test(ext)) exts.add(ext.toLowerCase());
  }
  const SKIP = new Set(['.md', '.yaml', '.yml', '.toml', '.json', '.lock']);
  for (const ext of exts) {
    if (covered.has(ext) || SKIP.has(ext)) continue;
    push('ACC040', '.', REGISTRY.ACC040.message.replace('{ext}', ext));
  }

  // Cycle detection (ACC014) via declared dependency graph.
  const boundaryList = [...boundaryDirs];
  const adj = {};
  for (const [dir, c] of Object.entries(contracts)) {
    const parsed = require('./agents').parse(c.text);
    for (const dep of parsed.deps) {
      const target = resolveBoundary(dep.replace(/\/+$/, ''));
      if (target !== null && target !== dir) {
        (adj[dir] = adj[dir] || []).push(target);
      }
    }
  }
  const seenCycles = new Set();
  const visitedNodes = new Set();
  const inPath = new Set();
  const visit = (node, trail) => {
    if (inPath.has(node)) {
      const idx = trail.indexOf(node);
      const cycle = trail.slice(idx).concat(node);
      const key = cycle.join('>');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        push('ACC014', '.', REGISTRY.ACC014.message.replace('{cycle}', cycle.join(' → ')));
      }
      return;
    }
    if (visitedNodes.has(node)) return;
    visitedNodes.add(node);
    inPath.add(node);
    for (const next of adj[node] || []) visit(next, trail.concat(next));
    inPath.delete(node);
  };
  for (const start of boundaryList) visit(start, []);

  diags.sort((a, b) => {
    return (
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
      cmp(a.code, b.code) ||
      cmp(a.path, b.path)
    );
  });
  return diags;
}

function isGitTracked(root, rel) {
  try {
    const out = require('child_process').execFileSync('git', ['ls-files', '--error-unmatch', rel], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.toString().trim().length > 0;
  } catch {
    return false;
  }
}

module.exports = { check, REGISTRY, severityOf, isError, SEVERITY_ORDER };
