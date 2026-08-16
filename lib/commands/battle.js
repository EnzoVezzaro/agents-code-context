/**
 * `acc battle <project>` — launch the standalone ACC Battle Arena (ABA).
 *
 * ABA is NOT part of the ACC framework. It is a separate application used
 * to benchmark the framework. The framework never requires it and works
 * without it; this command is a convenience launcher only.
 *
 * Docker is optional for ABA: it runs benchmarks on an isolated snapshot
 * copy, using a container when Docker is available and the host otherwise
 * (`--local` forces host mode).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = {
  name: 'battle',
  summary: 'Launch the standalone ACC Battle Arena benchmark (ABA)',
  booleans: ['--preserve', '--local', '--headless'],
  flags: {
    '--network': { type: 'string' },
    '--timeout': { type: 'string' },
    '--model': { type: 'string' },
    '--agent': { type: 'string', repeatable: true },
  },
  usage: 'acc battle <project> [--local] [--network policy] [--preserve] [--timeout s] [--agent name:model]',

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one project path or repository', exit: 2 };

    // Locate ABA. Prefer the npm-installed acc-battle-arena package (a
    // dependency of acc-agents), then a local dev copy of the standalone repo.
    const candidates = [
      path.join(__dirname, '..', '..', 'node_modules', 'acc-battle-arena', 'index.cjs'),
      path.join(__dirname, '..', '..', 'aba', 'index.cjs'),
      path.join(process.cwd(), 'aba', 'index.cjs'),
    ];
    let abaEntry = candidates.find((c) => fs.existsSync(c));
    if (!abaEntry) {
      try {
        abaEntry = require.resolve('acc-battle-arena/index.cjs', { paths: [process.cwd(), __dirname] });
      } catch {
        // fall through
      }
    }
    if (!abaEntry) {
      return {
        error:
          'ABA (ACC Battle Arena) not found. Install the acc-battle-arena package (npm install acc-battle-arena) or run it from its own repository: node index.cjs <project>',
        exit: 1,
      };
    }

    // Forward the battle arguments to the standalone ABA.
    const args = [abaEntry, positionals[0]];
    for (const [flag, val] of Object.entries(values)) {
      if (flag === '--agent') {
        for (const a of val) args.push('--agent', a);
      } else if (val !== undefined && val !== false) {
        args.push(flag, String(val));
      } else if (val === true) {
        args.push(flag);
      }
    }

    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    // Keep the process alive until the child exits; return exit code via
    // a deferred exit signal handled by the dispatcher.
    return { spawn: child };
  },
};
