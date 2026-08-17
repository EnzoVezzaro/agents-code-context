/**
 * Minimal `.env` reader/writer.
 *
 * ACC keeps API keys out of the repository config and out of git. The
 * `acc ai` command stores keys in the project's `.env` (gitignored) and
 * reads them back into `process.env` when the config is loaded — no
 * dotenv dependency, no network, no surprises.
 *
 * Format supported (same surface as dotenv):
 *   KEY=value
 *   export KEY=value
 *   # comments and blank lines are preserved on write
 *
 * `loadEnv` never overrides an already-set environment variable, so a
 * shell export wins over the file — the usual dotenv contract.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ENV_FILE = '.env';

/** Parse .env text into [{ raw, key, value }] preserving raw lines. */
function parseEnv(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (const raw of lines) {
    const m = raw.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) {
      out.push({ raw });
      continue;
    }
    let value = m[2].trim();
    // Strip one matching pair of surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.push({ raw, key: m[1], value });
  }
  return out;
}

/** Load `.env` from `root` into process.env (never overrides existing). */
function loadEnv(root) {
  const file = path.join(root, ENV_FILE);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { file, loaded: false, vars: 0 };
  }
  let vars = 0;
  for (const line of parseEnv(text)) {
    if (!line.key) continue;
    if (process.env[line.key] === undefined) {
      process.env[line.key] = line.value;
      vars++;
    }
  }
  return { file, loaded: true, vars };
}

/**
 * Upsert `updates` ({ KEY: value }) into `root/.env`, preserving
 * comments, blank lines, and unrelated keys. New keys are appended.
 * Returns the absolute file path.
 */
function writeEnv(root, updates) {
  const file = path.join(root, ENV_FILE);
  let entries = [];
  try {
    entries = parseEnv(fs.readFileSync(file, 'utf8'));
  } catch {
    entries = [];
  }

  const byKey = new Map();
  for (const e of entries) if (e.key) byKey.set(e.key, e);

  const changed = [];
  for (const [key, value] of Object.entries(updates)) {
    const existing = byKey.get(key);
    if (existing) {
      if (existing.value !== String(value)) {
        existing.raw = `${key}=${value}`;
        existing.value = String(value);
        changed.push(key);
      }
    } else {
      entries.push({ raw: `${key}=${value}`, key, value: String(value) });
      byKey.set(key, entries[entries.length - 1]);
      changed.push(key);
    }
  }

  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(file, entries.map((e) => e.raw).join('\n') + (entries.length ? '\n' : ''));
  return { file, changed };
}

/** Remove keys from `.env` (used by `acc ai remove`). */
function removeEnvKeys(root, keys) {
  const file = path.join(root, ENV_FILE);
  let entries = [];
  try {
    entries = parseEnv(fs.readFileSync(file, 'utf8'));
  } catch {
    return { file, removed: [] };
  }
  const removed = [];
  const next = [];
  for (const e of entries) {
    if (e.key && keys.includes(e.key)) {
      removed.push(e.key);
      continue; // drop the line entirely
    }
    next.push(e);
  }
  if (removed.length) {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(file, next.map((e) => e.raw).join('\n') + (next.length ? '\n' : ''));
  }
  return { file, removed };
}

module.exports = { parseEnv, loadEnv, writeEnv, removeEnvKeys, ENV_FILE };
