/**
 * Shared filesystem and path helpers for the ACC CLI.
 *
 * The CLI is deterministic: every walk and sort here is stable and
 * locale-independent (byte-order lexicographic).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/** Convert a path to POSIX style with forward slashes. */
function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Path relative to root, POSIX style, no leading './'. */
function relPath(root, p) {
  const rel = path.relative(root, p);
  if (rel === '') return '';
  return toPosix(rel);
}

/** Lexicographic byte-order comparator (deterministic). */
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Directory of a POSIX-relative path, normalized: '' for the root. */
function dirOf(rel) {
  const d = path.posix.dirname(rel);
  return d === '.' ? '' : d;
}

/** Recursively list files under dir, POSIX-relative to root, sorted. */
function walkFiles(root, dir, ignore, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => cmp(a.name, b.name));
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = relPath(root, abs);
    if (isIgnored(rel, ignore)) continue;
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walkFiles(root, abs, ignore, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/** Built-in ignore patterns (always applied). */
const DEFAULT_IGNORE = ['.git/', 'node_modules/', 'target/', 'dist/', 'build/', '*.lock'];

function isIgnored(rel, ignore) {
  const patterns = DEFAULT_IGNORE.concat(ignore || []);
  for (const pat of patterns) {
    const p = pat.replace(/^\.\//, '');
    if (p.endsWith('/')) {
      if (rel.startsWith(p) || rel === p.slice(0, -1)) return true;
    } else if (p.startsWith('*')) {
      if (rel.endsWith(p.slice(1))) return true;
    } else if (p.includes('*')) {
      const re = new RegExp('^' + p.split('*').map(escapeRe).join('.*') + '$');
      if (re.test(rel)) return true;
    } else if (rel === p || rel.startsWith(p + '/')) {
      return true;
    }
  }
  return false;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Read a file as UTF-8, returning null if unreadable or not valid UTF-8. */
function readUtf8(file) {
  try {
    const buf = fs.readFileSync(file);
    if (!isUtf8(buf)) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function isUtf8(buf) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

/** Find the nearest ancestor directory (including start) with a marker file.
 *  Never resolves to (or above) the user's home directory: a stray
 *  package.json/AGENTS.md in the home dir must not make the entire home
 *  tree the project root (would walk caches, node_modules, .npm, etc.). */
function detectProjectRoot(start) {
  const fallback = path.resolve(start || process.cwd());
  let dir = fallback;
  let home;
  try {
    home = fs.realpathSync(os.homedir());
  } catch {
    home = os.homedir();
  }
  const markers = ['.git', 'AGENTS.md', 'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml'];
  for (;;) {
    const isHome = dir === home;
    if (!isHome) {
      for (const m of markers) {
        try {
          if (fs.statSync(path.join(dir, m)).isFile() || fs.statSync(path.join(dir, m)).isDirectory()) {
            return dir;
          }
        } catch {
          /* keep walking */
        }
      }
    }
    if (isHome) return fallback;
    const parent = path.dirname(dir);
    if (parent === dir) return fallback;
    dir = parent;
  }
}

/** RFC 3339 UTC timestamp (used only for memory entries). */
function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = {
  toPosix,
  relPath,
  cmp,
  dirOf,
  walkFiles,
  isIgnored,
  readUtf8,
  isUtf8,
  detectProjectRoot,
  nowIso,
};
