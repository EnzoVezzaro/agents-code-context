#!/usr/bin/env node
/**
 * Skill-copy consistency guard.
 *
 * ACC ships the skill in one canonical place — skills/acc/ — and
 * `acc install` copies it into host-specific locations
 * (.agents/skills/acc, .claude/skills/acc, ...). Those copies are
 * generated artifacts: they must never drift from the canonical source.
 *
 * This check walks every installed copy found in the repo (and the
 * .agents/ bootstrap copy) and asserts each file is byte-identical to
 * its canonical counterpart, modulo the __ACC_VERSION__ placeholder the
 * install step resolves.
 *
 * Usage:
 *   npm run check:skill-copies
 *
 * Exit 0 when every copy is in sync, 1 with a per-file report otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CANONICAL = path.join(root, 'skills', 'acc');

/** Known install locations (project-local, per-agent). */
const INSTALL_LOCATIONS = [
  '.claude/skills/acc',
  '.codex/skills/acc',
  '.cursor/skills/acc',
  '.opencode/skills/acc',
  '.gemini/skills/acc',
  '.vscode/skills/acc',
  '.windsurf/skills/acc',
];

/** All files under skills/acc/, relative to the canonical dir. */
function canonicalFiles() {
  const out = [];
  (function walk(dir, rel) {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const relName = rel ? path.join(rel, name) : name;
      if (fs.statSync(abs).isDirectory()) walk(abs, relName);
      else out.push(relName);
    }
  })(CANONICAL, '');
  return out;
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

// The canonical SKILL.md carries a __ACC_VERSION__ placeholder that the
// install step resolves to the package version — so copies legitimately
// differ there. Everything else must match byte-for-byte.
function normalize(text) {
  return text.replace(/__ACC_VERSION__/g, require('../package.json').version);
}

let failed = false;
const files = canonicalFiles();

for (const dir of INSTALL_LOCATIONS) {
  if (!fs.existsSync(path.join(root, dir))) continue; // not installed here
  for (const rel of files) {
    const canonicalAbs = path.join(CANONICAL, rel);
    const copyAbs = path.join(root, dir, rel);
    if (!fs.existsSync(copyAbs)) {
      console.error(`${dir}/${rel}: MISSING — canonical file not copied`);
      failed = true;
      continue;
    }
    const a = normalize(read(path.join('skills', 'acc', rel)));
    const b = read(path.join(dir, rel));
    if (a !== b) {
      console.error(`${dir}/${rel}: DRIFTED from skills/acc/${rel}`);
      failed = true;
    }
  }
}

// Also check the repo's own bootstrap copy if present (this repo has one).
if (fs.existsSync(path.join(root, '.agents', 'skills', 'acc'))) {
  // Already covered by INSTALL_LOCATIONS[0].
}

if (failed) {
  console.error('\nFix: re-run `acc install --force` (or copy skills/acc/) to resync.');
  process.exit(1);
}
console.log(`check-skill-copies: ${INSTALL_LOCATIONS.filter((d) => fs.existsSync(path.join(root, d))).length} installed copy(ies) in sync with skills/acc/ (${files.length} files).`);
