/**
 * `.acc-memory.md` read/write.
 *
 * Memory is durable, functionality-local, agent-written, gitignored
 * Markdown. Plain prose, no schema; timestamped `## <RFC 3339>` entries.
 * See the memory-semantics spec.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { nowIso } = require('./util');

/** Supported memory entry timestamp formats (config memory.timestamp_format). */
const TIMESTAMP_FORMATS = ['rfc3339', 'date'];

/** Build the entry timestamp per the configured format (default rfc3339). */
function timestampFor(format) {
  const iso = nowIso();
  if (format === 'date') return iso.slice(0, 10);
  return iso;
}

function memoryPath(root, dir) {
  return path.join(root, dir || '', '.acc-memory.md');
}

/** Show memory for a directory: { exists, path, contents } */
function show(root, dir) {
  const file = memoryPath(root, dir);
  if (!fs.existsSync(file)) {
    return { exists: false, file: rel(root, file), contents: null };
  }
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    contents = null;
  }
  return { exists: true, file: rel(root, file), contents };
}

/** Append a timestamped entry. Creates the file if absent. */
function add(root, dir, text, opts) {
  const file = memoryPath(root, dir);
  const stamp = timestampFor((opts && opts.timestamp_format) || 'rfc3339');
  const entry = `## ${stamp}\n\n${text.trim()}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const content = existing.trim() === '' ? entry : `${existing.replace(/\s+$/, '')}\n\n${entry}`;
  fs.writeFileSync(file, content);
  return { file: rel(root, file), bytes: Buffer.byteLength(content), action: 'added' };
}

/** Create an initial timestamped record. No-op if the file already has content. */
function init(root, dir, text, opts) {
  const file = memoryPath(root, dir);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (existing.trim() !== '') return { file: rel(root, file), action: 'exists' };
  const stamp = timestampFor((opts && opts.timestamp_format) || 'rfc3339');
  const content = `## ${stamp}\n\n${text.trim()}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return { file: rel(root, file), bytes: Buffer.byteLength(content), action: 'created' };
}

/**
 * Standard initial-record body for `acc init` / `acc build`. The root
 * record carries clone date and GitHub provenance (when available).
 */
function initialRecordText({ tool, version, git, subject = 'this directory' }) {
  const lines = [
    `Initial record created by ${tool} ${version} — ${subject} was bound to the ACC graph on ${nowIso().slice(0, 10)}.`,
  ];
  if (git && git.cloneDate) lines.push(`- Cloned: ${git.cloneDate} (from .git)`);
  if (git && git.origin) lines.push(`- Origin: ${git.origin}`);
  if (git && git.github) {
    const gh = git.github;
    let line = `- GitHub: ${gh.owner}/${gh.repo}`;
    if (gh.branch) line += ` (default branch: ${gh.branch})`;
    lines.push(line);
  }
  return lines.join('\n');
}

/** Truncate the file, leaving it empty to preserve the convention marker. */
function clear(root, dir) {
  const file = memoryPath(root, dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  return { file: rel(root, file), bytes: 0, action: 'cleared' };
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

module.exports = { show, add, init, clear, memoryPath, initialRecordText, timestampFor, TIMESTAMP_FORMATS };
