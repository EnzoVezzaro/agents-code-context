'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../lib/core/agents');

const SAMPLE = `# auth

## Purpose

Authentication and authorization for the API.

## Ownership

Owner: auth-team

## Dependencies

- src/database
- src/logging, src/config

## Constraints

- Must not depend on src/ui.

## Architecture

Layered. See .acc/config/standards/architecture.md.
`;

test('extracts conventional sections', () => {
  const out = parse(SAMPLE);
  assert.equal(out.sections.Purpose, 'Authentication and authorization for the API.');
  assert.ok(out.sections.Constraints.includes('Must not depend on src/ui.'));
  assert.equal(out.hasRecognizedSections, true);
});

test('extracts dependencies as paths', () => {
  const out = parse(SAMPLE);
  assert.deepEqual(out.deps, ['src/database', 'src/logging', 'src/config']);
});

test('extracts owners', () => {
  const out = parse(SAMPLE);
  assert.deepEqual(out.owners, ['auth-team']);
});

test('extracts purpose from first line', () => {
  const out = parse(SAMPLE);
  assert.equal(out.purpose, 'Authentication and authorization for the API.');
});

test('a single paragraph is still valid (no recognized sections)', () => {
  const out = parse('This directory contains the auth subsystem.\n');
  assert.equal(out.hasRecognizedSections, false);
  assert.deepEqual(out.deps, []);
});

test('prose-only dependencies are not extracted (no schema)', () => {
  const out = parse('## Dependencies\n\nthe database module and logging\n');
  assert.deepEqual(out.deps, []);
});

test('backticked path deps resolve cleanly (no stray code marks)', () => {
  const out = parse(
    '## Dependencies\n\n- `.claude-plugin/`\n- `skills/acc`\n'
  );
  // Only path-like tokens (with a slash) are extracted; backticks and
  // trailing slashes are stripped so the path resolves on disk.
  assert.deepEqual(out.deps, ['.claude-plugin', 'skills/acc']);
});
