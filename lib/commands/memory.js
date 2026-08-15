/**
 * `acc memory show|add|clear <path>` — read and update functionality-local
 * `.acc-memory.md` files (docs/08). Memory is never written outside these
 * explicit subcommands.
 */
'use strict';

const memory = require('../memory');

module.exports = {
  name: 'memory',
  summary: 'Read and update functionality-local .acc-memory.md files',
  usage: 'acc memory show <path> | acc memory add <path> <text> | acc memory clear <path> [--force]',
  booleans: ['--force', '--json'],
  flags: {},

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    const [sub, target, ...rest] = positionals;

    if (!['show', 'add', 'clear'].includes(sub)) {
      return { error: `unknown memory subcommand: ${sub || '(none)'} (expected show|add|clear)`, exit: 2 };
    }
    if (!target) return { error: 'expected a path', exit: 2 };

    const dir = target.replace(/\/+$/, '');

    if (sub === 'show') {
      const mem = memory.show(ctx.root, dir);
      const result = { path: dir, exists: mem.exists, file: mem.file, contents: mem.contents };
      if (ctx.opts.json) return { result };
      const empty = !mem.exists || (mem.contents ?? '').trim() === '';
      if (empty) return { text: `No memory yet at ${dir === '' ? '.' : dir}/.acc-memory.md\n` };
      return { text: mem.contents };
    }

    if (sub === 'add') {
      const text = rest.join(' ');
      if (!text.trim()) return { error: 'expected text to append', exit: 2 };
      const out = memory.add(ctx.root, dir, text);
      const result = { path: dir, file: out.file, action: out.action, bytes: out.bytes };
      if (ctx.opts.json) return { result };
      return { text: `Added entry to ${out.file} (${out.bytes} bytes)\n` };
    }

    if (sub === 'clear') {
      if (!values['--force']) {
        return { error: 'refusing to clear without --force (memory is durable knowledge)', exit: 1 };
      }
      const out = memory.clear(ctx.root, dir);
      const result = { path: dir, file: out.file, action: out.action, bytes: out.bytes };
      if (ctx.opts.json) return { result };
      return { text: `Cleared ${out.file}\n` };
    }
  },
};
