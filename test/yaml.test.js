'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../lib/core/yaml');

test('parses nested mappings', () => {
  const out = parse('schema_version: 1\nmulti_agent:\n  enabled: false\n  max_concurrency: 4\n');
  assert.equal(out.schema_version, 1);
  assert.equal(out.multi_agent.enabled, false);
  assert.equal(out.multi_agent.max_concurrency, 4);
});

test('parses sequences and inline sequences', () => {
  const out = parse('ignore:\n  - "target/"\n  - node_modules/\ndiagnostics:\n  warn_only: ["ACC014"]\n');
  assert.deepEqual(out.ignore, ['target/', 'node_modules/']);
  assert.deepEqual(out.diagnostics.warn_only, ['ACC014']);
});

test('parses scalars: numbers, booleans, quoted strings', () => {
  const out = parse('a: 42\nb: true\nc: "hello world"\nd: \'single\'\ne: null\n');
  assert.equal(out.a, 42);
  assert.equal(out.b, true);
  assert.equal(out.c, 'hello world');
  assert.equal(out.d, 'single');
  assert.equal(out.e, null);
});

test('ignores comments and empty lines', () => {
  const out = parse('# comment\n\nschema_version: 1\n# another\n');
  assert.equal(out.schema_version, 1);
});

test('returns null for empty documents', () => {
  assert.equal(parse(''), null);
  assert.equal(parse('# only comments\n'), null);
});

test('handles the documented config shape', () => {
  const out = parse(`
schema_version: 1
language_analyzers:
  rust: true
  typescript: true
ownership:
  strict: false
multi_agent:
  enabled: true
  max_concurrency: 8
  isolation_mode: "git_worktree"
  conflict_policy: "sequentialize"
tools:
  auto_discover: true
  permissions:
    shell:
      enabled: true
      approval: "auto"
`);
  assert.equal(out.schema_version, 1);
  assert.equal(out.language_analyzers.rust, true);
  assert.equal(out.multi_agent.max_concurrency, 8);
  assert.equal(out.tools.permissions.shell.approval, 'auto');
});
