/**
 * Engine trigger.
 *
 * The AI phase of the engine consumes tokens, so it must not run on
 * every invocation. The repository config declares how much change the
 * engine waits for before triggering:
 *
 *   engine.trigger.mode: commits | changes | always   (default: commits)
 *   engine.trigger.threshold: N                        (default: 3)
 *
 *   - commits: counts commits since the last triggered run, reading the
 *     git logs as plain files (.git/logs/HEAD + refs) — no git binary,
 *     no network.
 *   - changes: keeps a content-hash snapshot of the tree; triggers when
 *     at least N files changed since the snapshot.
 *   - always: never waits.
 *
 * Local derived state (last processed commit / last snapshot) lives in
 * the gitignored `.acc/state/engine.json` — disposable, per-clone.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { walkFiles, readUtf8 } = require('./util');
const { hashContent } = require('./graph');

const STATE_FILE = path.join('.acc', 'state', 'engine.json');
const DEFAULT_MODE = 'commits';
const DEFAULT_THRESHOLD = 3;

function statePath(root) {
  return path.join(root, STATE_FILE);
}

function loadState(root) {
  try {
    const raw = fs.readFileSync(statePath(root), 'utf8');
    return JSON.parse(raw) || null;
  } catch {
    return null;
  }
}

function saveState(root, state) {
  const file = statePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}

/**
 * Evaluate whether the AI phase should run.
 * Returns { mode, threshold, current, triggered, reason,
 *           headCommit?, snapshot?, changedFiles? }.
 * `current` is null for always/forced. `changedFiles` is the list of
 * files whose content changed since the last run (or since the initial
 * baseline) — the code the AI must evaluate, in both modes.
 */
function evaluateTrigger(root, config, { force = false } = {}) {
  const t = (config.engine && config.engine.trigger) || {};
  const mode = t.mode || DEFAULT_MODE;
  const threshold = Number.isInteger(t.threshold) && t.threshold > 0 ? t.threshold : DEFAULT_THRESHOLD;

  const snapshot = buildSnapshot(root, config);
  const state = loadState(root);
  const prev = state && state.trigger ? state.trigger : null;

  if (force) {
    return { mode, threshold, current: null, triggered: true, reason: 'forced', snapshot, changedFiles: changedSince(snapshot, prev) };
  }
  if (mode === 'always') {
    return { mode, threshold, current: null, triggered: true, reason: 'always', snapshot, changedFiles: changedSince(snapshot, prev) };
  }

  if (mode === 'changes') {
    const ev = evaluateChanges(root, config, threshold, prev, snapshot);
    // Expose the changed files regardless of trigger state so the AI
    // always knows what code to look at.
    ev.changedFiles = changedSince(snapshot, prev);
    return ev;
  }

  // commits (default)
  const head = currentHead(root);
  if (!head) {
    return {
      mode, threshold, current: null, triggered: true, reason: 'no git history — cannot count commits',
      snapshot, changedFiles: changedSince(snapshot, prev),
    };
  }
  const baseline = prev && prev.mode === 'commits' ? prev.last_commit : null;
  const count = baseline ? commitsSince(root, baseline) : commitsTotal(root);
  if (count === null) {
    // Unreadable/rotated log — be safe and trigger rather than skip work.
    return {
      mode, threshold, current: null, triggered: true, reason: 'git log unreadable — triggering',
      snapshot, changedFiles: changedSince(snapshot, prev),
    };
  }
  const triggered = count >= threshold;
  return {
    mode,
    threshold,
    current: count,
    triggered,
    reason: triggered ? `reached ${count}/${threshold} commits` : `waiting for ${count}/${threshold} commits`,
    headCommit: head,
    snapshot,
    changedFiles: changedSince(snapshot, prev),
  };
}

/** Files whose content hash differs from the previous run's snapshot. */
function changedSince(snapshot, prev) {
  const prevSnap = prev && prev.snapshot ? prev.snapshot : null;
  if (!prevSnap) return Object.keys(snapshot).sort();
  const out = [];
  for (const rel of Object.keys(snapshot).sort()) {
    if (prevSnap[rel] !== snapshot[rel]) out.push(rel);
  }
  for (const rel of Object.keys(prevSnap)) {
    if (!(rel in snapshot)) out.push(rel); // removed
  }
  return out.sort();
}

/** Persist the trigger baseline after a triggered run. */
function persistTrigger(root, ev) {
  if (!ev || !ev.triggered) return null;
  const state = loadState(root) || {};
  // Always persist the content snapshot too, so the next run knows which
  // files changed since this one (both modes). evaluateTrigger always
  // builds it, so this is just a defensive fallback.
  const snapshot = ev.snapshot || {};
  if (ev.mode === 'commits' && ev.headCommit) {
    state.trigger = { mode: 'commits', last_commit: ev.headCommit, snapshot };
  } else if (ev.mode === 'changes' && snapshot) {
    state.trigger = { mode: 'changes', snapshot };
  } else {
    return null;
  }
  saveState(root, state);
  return state;
}

/* ---------------- commits mode (git logs as plain files) ---------------- */

/** Resolve the current HEAD commit hash without executing git. */
function currentHead(root) {
  const gitDir = path.join(root, '.git');
  let headRef;
  try {
    headRef = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  } catch {
    return null;
  }
  if (headRef.startsWith('ref: ')) {
    const ref = headRef.slice(5).trim();
    try {
      const hash = fs.readFileSync(path.join(gitDir, ref), 'utf8').trim();
      if (/^[0-9a-f]{40}$/i.test(hash)) return hash;
    } catch {
      /* packed-refs — fall through to the reflog */
    }
  } else if (/^[0-9a-f]{40}$/i.test(headRef)) {
    return headRef;
  }
  return lastLogHash(root);
}

/** New-hash of the most recent .git/logs/HEAD entry, if any. */
function lastLogHash(root) {
  const hashes = logHashes(root);
  return hashes.length ? hashes[hashes.length - 1] : null;
}

/** Ordered new-hashes from .git/logs/HEAD (oldest → newest). */
function logHashes(root) {
  try {
    const log = fs.readFileSync(path.join(root, '.git', 'logs', 'HEAD'), 'utf8');
    const out = [];
    for (const line of log.split(/\r?\n/)) {
      const m = line.match(/^[0-9a-f]{40} ([0-9a-f]{40})/);
      if (m) out.push(m[1]);
    }
    return out;
  } catch {
    return [];
  }
}

/** Total commits recorded in the reflog. */
function commitsTotal(root) {
  const hashes = logHashes(root);
  if (!hashes.length) return null;
  return hashes.length;
}

/** Commits after `baseline` in the reflog; null when the baseline is gone. */
function commitsSince(root, baseline) {
  const hashes = logHashes(root);
  if (!hashes.length) return null;
  // Newest entry is last; find the baseline scanning from the end.
  for (let i = hashes.length - 1; i >= 0; i--) {
    if (hashes[i] === baseline) return hashes.length - 1 - i;
  }
  return null; // rotated away — unknown baseline
}

/* ---------------- changes mode (hash snapshot) ---------------- */

function evaluateChanges(root, config, threshold, prev, snapshot) {
  if (!prev || prev.mode !== 'changes' || !prev.snapshot) {
    return {
      mode: 'changes',
      threshold,
      current: 0,
      triggered: true,
      reason: 'initial baseline recorded',
      snapshot,
    };
  }
  let changed = 0;
  const seen = new Set();
  for (const [rel, hash] of Object.entries(snapshot)) {
    seen.add(rel);
    if (prev.snapshot[rel] !== hash) changed++;
  }
  for (const rel of Object.keys(prev.snapshot)) {
    if (!seen.has(rel)) changed++; // removed files count as changes
  }
  const triggered = changed >= threshold;
  return {
    mode: 'changes',
    threshold,
    current: changed,
    triggered,
    reason: triggered
      ? `reached ${changed}/${threshold} changed files`
      : `waiting for ${changed}/${threshold} changed files`,
    snapshot: triggered ? snapshot : null,
  };
}

/** Content-hash snapshot of every walked file (rel → hash).
 *  Excludes ACC's own derived state (`.acc/`, `.acc-memory.md`, and the
 *  ACC_WARN.md drift report) so the trigger measures CODE changes, not
 *  the engine's own bookkeeping. */
function buildSnapshot(root, config) {
  const out = {};
  const files = walkFiles(root, root, config.ignore || [], []);
  for (const rel of files) {
    if (rel.startsWith('.acc/')) continue;
    if (path.posix.basename(rel) === '.acc-memory.md') continue;
    if (path.posix.basename(rel) === 'ACC_WARN.md') continue;
    const text = readUtf8(path.join(root, rel));
    out[rel] = text === null ? '' : hashContent(text);
  }
  return out;
}

module.exports = { evaluateTrigger, persistTrigger, loadState, saveState, DEFAULT_MODE, DEFAULT_THRESHOLD };
