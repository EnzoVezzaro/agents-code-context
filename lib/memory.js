/**
 * `.acc-memory.md` read/write.
 *
 * Memory is durable, functionality-local, agent-written, gitignored
 * Markdown. Plain prose, no schema; timestamped `## <RFC 3339>` entries.
 * See docs/08-memory-semantics.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { nowIso } = require('./util');

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
function add(root, dir, text) {
  const file = memoryPath(root, dir);
  const stamp = nowIso();
  const entry = `## ${stamp}\n\n${text.trim()}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const content = existing.trim() === '' ? entry : `${existing.replace(/\s+$/, '')}\n\n${entry}`;
  fs.writeFileSync(file, content);
  return { file: rel(root, file), bytes: Buffer.byteLength(content), action: 'added' };
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

module.exports = { show, add, clear, memoryPath };
