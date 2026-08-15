/**
 * `acc battle <project>` — launch the standalone ACC Battle Arena (ABA).
 *
 * ABA is NOT part of the ACC framework. It is a separate application used
 * to benchmark and test the framework in isolated Docker containers. The
 * framework never requires it and works without it; this command is a
 * convenience launcher only.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = {
  name: 'battle',
  summary: 'Launch the standalone ACC Battle Arena benchmark (ABA)',
  usage: 'acc battle <project> [--network policy] [--preserve] [--timeout s] [--agent name:model]',
  booleans: ['--preserve'],
  flags: {
    '--network': { type: 'string' },
    '--timeout': { type: 'string' },
    '--model': { type: 'string' },
    '--agent': { type: 'string', repeatable: true },
  },

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one project path or repository', exit: 2 };

    // Locate the standalone ABA application (sibling of the CLI package).
    const candidates = [
      path.join(__dirname, '..', '..', 'aba', 'index.cjs'),
      path.join(process.cwd(), 'aba', 'index.cjs'),
    ];
    const abaEntry = candidates.find((c) => fs.existsSync(c));
    if (!abaEntry) {
      return {
        error:
          'ABA (ACC Battle Arena) not found. ABA is a standalone benchmark application — it is not part of the ACC framework. Install or clone it separately, then run: node aba/index.cjs <project>',
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
