/**
 * Read-only git metadata used for provenance in initial memory records.
 *
 * Everything here is a pure filesystem read of `.git/` — no git binary is
 * ever executed, keeping the CLI deterministic and safe on untrusted
 * repositories. Best-effort: any missing or malformed file yields `null`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { readUtf8 } = require('./util');

/** Best-effort metadata about the repository's origin and clone date. */
function gitMeta(root) {
  const gitDir = resolveGitDir(root);
  if (!gitDir) {
    return { git: false, cloneDate: null, origin: null, github: null };
  }
  const origin = readOrigin(gitDir);
  const github = parseGithub(origin);
  const branch = readBranch(gitDir);
  if (github && branch) github.branch = branch;
  return {
    git: true,
    cloneDate: readCloneDate(gitDir),
    origin,
    github,
  };
}

/** Resolve `.git` (directory or worktree pointer file). */
function resolveGitDir(root) {
  const gitDir = path.join(root, '.git');
  if (isDir(gitDir)) return gitDir;
  if (fs.existsSync(gitDir) && fs.statSync(gitDir).isFile()) {
    const content = readUtf8(gitDir);
    const m = content && content.match(/^gitdir:\s*(.+)$/m);
    if (m) return path.resolve(root, m[1].trim());
  }
  return null;
}

/** Origin URL from `[remote "origin"]` in `.git/config`, normalized. */
function readOrigin(gitDir) {
  const config = readUtf8(path.join(gitDir, 'config'));
  if (!config) return null;
  const section = config.match(/\[remote\s+"origin"\s*\]\s*([^\[]*)/);
  if (!section) return null;
  const url = section[1].match(/^\s*url\s*=\s*(.+)$/m);
  if (!url) return null;
  return normalizeOrigin(url[1].trim());
}

/** scp-like `git@host:owner/repo` -> `https://host/owner/repo` for display. */
function normalizeOrigin(url) {
  if (/^git@/.test(url)) return `https://${url.slice(4).replace(':', '/')}`;
  return url;
}

/** GitHub identity from an origin URL, or null. */
function parseGithub(url) {
  if (!url) return null;
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) return null;
  return { host: 'github.com', owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

/** Default branch name from `.git/HEAD`, or null when detached. */
function readBranch(gitDir) {
  const head = readUtf8(path.join(gitDir, 'HEAD'));
  if (!head) return null;
  const m = head.match(/^ref:\s*refs\/heads\/(.+)$/m);
  return m ? m[1].trim() : null;
}

/** Clone date as `YYYY-MM-DD` (reflog first entry, else filesystem birthtime). */
function readCloneDate(gitDir) {
  const reflog = readUtf8(path.join(gitDir, 'logs', 'HEAD'));
  if (reflog) {
    const m = reflog.match(/^[0-9a-f]{4,} [0-9a-f]{4,} .*?\s(\d{10,})\s[+-]\d{4}\t/);
    if (m) return dateIso(new Date(Number(m[1]) * 1000));
  }
  try {
    const st = fs.statSync(gitDir);
    const t = st.birthtimeMs > 0 ? new Date(st.birthtimeMs) : st.mtime;
    return dateIso(t);
  } catch {
    return null;
  }
}

function dateIso(d) {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { gitMeta, parseGithub };
