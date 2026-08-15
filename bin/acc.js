#!/usr/bin/env node
/**
 * ACC — Agent Code Context CLI
 *
 * A deterministic, offline, zero-dependency accelerator for ACC-enabled
 * repositories. It is OPTIONAL: the framework is plain files (AGENTS.md,
 * .acc/config/, .acc-memory.md) that any coding agent understands without
 * any tool. The CLI exists to make context generation, validation, and
 * graph derivation faster and more reliable.
 *
 * Exit codes (docs/04): 0 success · 1 ACC error · 2 usage error · 3 panic.
 */
'use strict';

const path = require('path');
const { parseArgv } = require('../lib/args');
const { resolveRoot, load } = require('../lib/config');
const { envelope, errorEnvelope, json } = require('../lib/output');

const VERSION = require('../package.json').version;

const commandModules = {
  init: require('../lib/commands/init'),
  check: require('../lib/commands/check'),
  inspect: require('../lib/commands/inspect'),
  context: require('../lib/commands/context'),
  graph: require('../lib/commands/graph'),
  dependencies: require('../lib/commands/relations').dependencies,
  dependents: require('../lib/commands/relations').dependents,
  impact: require('../lib/commands/relations').impact,
  search: require('../lib/commands/search'),
  discover: require('../lib/commands/discover'),
  document: require('../lib/commands/document'),
  memory: require('../lib/commands/memory'),
  tools: require('../lib/commands/tools'),
  battle: require('../lib/commands/battle'),
};

// Documented in docs/04 as future work — not part of the V1 surface.
const RESERVED = {
  tool: 'Execute a specific tool capability (docs/11-tooling.md) — reserved, not implemented in V1',
  shell: 'Execute a shell command in a project sandbox (docs/11-tooling.md) — reserved, not implemented in V1',
  agents: 'Multi-agent orchestration commands (docs/10) — reserved, not implemented in V1',
};

function printTopHelp() {
  const lines = [
    `acc ${VERSION} — Agent Code Context CLI`,
    '',
    'A deterministic, offline accelerator for ACC-enabled repositories.',
    'Optional: the framework is plain files and works without this tool.',
    '',
    'Usage: acc <command> [options]',
    '',
    'Commands:',
  ];
  const names = Object.keys(commandModules);
  for (const name of names.sort()) {
    const cmd = commandModules[name];
    lines.push(`  ${name.padEnd(14)} ${cmd.summary}`);
  }
  for (const [name, desc] of Object.entries(RESERVED)) {
    lines.push(`  ${name.padEnd(14)} ${desc}`);
  }
  lines.push('');
  lines.push('Global flags:');
  lines.push('  --json          Emit deterministic JSON output');
  lines.push('  --root <path>   Override project root detection');
  lines.push('  --quiet         Suppress non-error output');
  lines.push('  --help, -h      Show help');
  lines.push('  --version, -V   Show version');
  lines.push('');
  lines.push("Run 'acc <command> --help' for command-specific usage.");
  process.stdout.write(lines.join('\n') + '\n');
  process.exit(0);
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printTopHelp();
    return;
  }
  if (argv.includes('--version') || argv.includes('-V')) {
    process.stdout.write(`acc ${VERSION}\n`);
    process.exit(0);
  }

  const command = argv[0];
  const rest = argv.slice(1);

  // Command-level help.
  if (rest.includes('--help') || rest.includes('-h')) {
    const mod = commandModules[command];
    if (mod) {
      process.stdout.write(`Usage: ${mod.usage}\n\n${mod.summary}\n`);
      process.exit(0);
    }
  }

  // Reserved commands produce an informative message, not an error.
  if (RESERVED[command]) {
    process.stdout.write(`acc ${command}: ${RESERVED[command]}\n`);
    process.exit(0);
  }

  const mod = commandModules[command];
  if (!mod) {
    process.stderr.write(`acc: unknown command '${command}'\nRun 'acc --help' for usage.\n`);
    process.exit(2);
  }

  // Extract global flags (--json, --root, --quiet) from the tail.
  let jsonFlag = false;
  let quietFlag = false;
  let rootFlag = null;
  const clean = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') { jsonFlag = true; continue; }
    if (a === '--quiet') { quietFlag = true; continue; }
    if (a === '--root') {
      if (i + 1 < rest.length) { rootFlag = rest[i + 1]; i++; }
      continue;
    }
    clean.push(a);
  }

  let root;
  let config;
  try {
    root = resolveRoot(rootFlag);
    const loaded = load(root);
    config = loaded;
  } catch (err) {
    const e = errorEnvelope(command, null, 'io', `cannot resolve project root: ${err.message}`, 1);
    process.stderr.write(jsonFlag ? json(e) : `acc: ${err.message}\n`);
    process.exit(1);
  }

  const ctx = {
    root: config.root,
    config: config.config,
    configPresent: config.configPresent,
    configValid: config.configValid,
    configError: config.error,
    opts: { json: jsonFlag, quiet: quietFlag },
    rootFlag,
  };

  const parsed = parseArgv(clean, {
    booleans: mod.booleans || [],
    flags: mod.flags || {},
  });

  const outcome = mod.run(parsed, ctx);

  // Battle spawns a child process (standalone ABA).
  if (outcome && outcome.spawn) {
    outcome.spawn.on('exit', (code) => process.exit(code === null ? 1 : code));
    outcome.spawn.on('error', (err) => {
      process.stderr.write(`acc battle: failed to launch ABA: ${err.message}\n`);
      process.exit(1);
    });
    return;
  }

  if (!outcome) {
    const e = errorEnvelope(command, root, 'panic', 'command produced no result', 3);
    process.stderr.write(jsonFlag ? json(e) : 'acc: internal error — command produced no result\n');
    process.exit(3);
  }

  // Errors (usage / ACC errors).
  if (outcome.error) {
    const exit = outcome.exit || 2;
    const e = errorEnvelope(command, root, exit === 2 ? 'usage' : 'io', outcome.error, exit);
    process.stderr.write(jsonFlag ? json(e) : `acc: ${outcome.error}\n`);
    process.exit(exit);
  }

  const exit = outcome.exit || 0;

  if (jsonFlag) {
    const env = envelope(command, root, outcome.result ?? null, {
      diagnostics: outcome.envelopeDiagnostics ?? [],
      truncated: outcome.truncated || false,
      truncatedBytesOmitted: outcome.truncatedBytesOmitted || 0,
    });
    process.stdout.write(json(env));
  } else if (outcome.text) {
    process.stdout.write(outcome.text);
  } else if (outcome.result !== undefined && !quietFlag) {
    process.stdout.write(json(outcome.result));
  }

  process.exit(exit);
}

process.on('uncaughtException', (err) => {
  const e = errorEnvelope('unknown', null, 'panic', err.message, 3);
  process.stderr.write(json(e));
  process.exit(3);
});

if (require.main === module) {
  main();
}

module.exports = { main, VERSION };
