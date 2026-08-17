/**
 * Minimal, deterministic argument parser.
 *
 * spec.flags:  { '--depth': { type: 'number'|'string', repeatable?: bool } }
 * spec.booleans: ['--json', ...]  (accepts --flag or --flag=true)
 *
 * Unknown `--flags` are collected into `unknown` so commands can report
 * usage errors with exit code 2 (per the CLI command spec conventions).
 */
'use strict';

function parseArgv(argv, spec) {
  const values = {};
  const booleans = new Set(spec.booleans || []);
  const flags = spec.flags || {};
  const positionals = [];
  const unknown = [];
  let i = 0;

  const takeValue = (name, idx) => {
    if (idx + 1 >= argv.length) {
      return { error: `option '${name}' requires a value` };
    }
    return { value: argv[idx + 1] };
  };

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const name = eq === -1 ? arg : arg.slice(0, eq);
      const inline = eq === -1 ? null : arg.slice(eq + 1);

      if (booleans.has(name)) {
        values[name] = inline === null ? true : inline !== 'false';
        i++;
      } else if (flags[name]) {
        const t = flags[name].type || 'string';
        let raw;
        if (inline !== null) {
          raw = inline;
          i++;
        } else {
          const taken = takeValue(name, i);
          if (taken.error) return { errors: [taken.error], positionals, values, unknown };
          raw = taken.value;
          i += 2;
        }
        if (flags[name].repeatable) {
          (values[name] = values[name] || []).push(t === 'number' ? Number(raw) : raw);
        } else {
          values[name] = t === 'number' ? Number(raw) : raw;
        }
      } else {
        unknown.push(arg);
        i++;
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      unknown.push(arg);
      i++;
    } else {
      positionals.push(arg);
      i++;
    }
  }

  return { positionals, values, unknown, errors: [] };
}

module.exports = { parseArgv };
