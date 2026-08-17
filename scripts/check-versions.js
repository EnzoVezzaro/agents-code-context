#!/usr/bin/env node
/**
 * Version-consistency guard.
 *
 * ACC declares its version in several host manifests (npm package.json,
 * Claude Code plugin, Codex plugin, Gemini extension, Hermes plugin.yaml,
 * generic plugin.json). package.json is the single source of truth — the
 * docs build reads it, `acc --version` reads it, and `npm run bump`
 * writes it. Every other manifest must agree with it so a release can
 * never ship hosts that advertise a stale version.
 *
 * Usage:
 *   npm run check:versions
 *
 * Exit 0 when every manifest agrees with package.json, 1 otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PINNED_SEMVER = /^\d+\.\d+\.\d+$/;

// Every file that declares the ACC version, and who reads it. Add new
// host manifests here so a future ecosystem can't drift unnoticed.
const VERSION_FILES = [
  'package.json',              // npm / repo root — the single source of truth
  '.claude-plugin/plugin.json', // Claude Code plugin
  '.codex-plugin/plugin.json',  // Codex plugin
  'gemini-extension.json',      // Gemini CLI extension
  'plugin.json',                // generic plugin manifest
  'plugin.yaml',                // Hermes Agent plugin manifest
];

function readVersion(relPath) {
  try {
    const raw = fs.readFileSync(path.join(root, relPath), 'utf8').replace(/^\uFEFF/, '');
    if (relPath.endsWith('.yaml')) {
      const m = raw.match(/^version:\s*(\S+)/m);
      if (!m) throw new Error('no version key');
      return m[1];
    }
    return JSON.parse(raw).version;
  } catch (e) {
    throw new Error(`${relPath}: ${e.message}`);
  }
}

let failed = false;
const versions = [];
for (const relPath of VERSION_FILES) {
  if (!fs.existsSync(path.join(root, relPath))) {
    console.error(`${relPath}: MISSING — expected a version-bearing manifest`);
    failed = true;
    continue;
  }
  const version = readVersion(relPath);
  if (typeof version !== 'string' || !PINNED_SEMVER.test(version)) {
    console.error(`${relPath}: version must be a pinned X.Y.Z semver, got ${JSON.stringify(version)}`);
    failed = true;
  }
  versions.push([relPath, version]);
}

const expected = require('../package.json').version;
for (const [relPath, version] of versions) {
  if (version !== expected) {
    console.error(`${relPath}: version ${version} ≠ package.json ${expected}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nFix: run `npm run bump -- <version>` so every manifest follows package.json.');
  process.exit(1);
}
console.log(`check-versions: ${versions.length} manifests agree on ${expected}.`);
