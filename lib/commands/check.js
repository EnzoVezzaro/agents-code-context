/**
 * `acc check` — validate the repository against ACC rules.
 *
 * Emits stable ACC0xx diagnostics. Exit 1 when any error-level diagnostic
 * is present (unless --exit-zero). See docs/06-diagnostic-codes.md.
 */
'use strict';

const { check } = require('../diagnostics');
const { isError } = require('../diagnostics');

module.exports = {
  name: 'check',
  summary: 'Validate repository against ACC rules',
  usage: 'acc check [--json] [--exit-zero] [--severity error|warn|info] [--code ACCxxx]',
  booleans: ['--json', '--exit-zero'],
  flags: { '--severity': { type: 'string' }, '--code': { type: 'string', repeatable: true } },

  run(argv, ctx) {
    const { values, unknown, positionals } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    let diags = check(ctx.root, ctx.config, {
      configPresent: ctx.configPresent,
      configValid: ctx.configValid,
      error: ctx.configError,
    });

    // Filters.
    const minSeverity = values['--severity'];
    const codes = values['--code'];
    if (minSeverity) {
      const order = { error: 0, warn: 1, info: 2 };
      const min = order[minSeverity];
      if (min === undefined) return { error: `invalid severity: ${minSeverity}`, exit: 2 };
      diags = diags.filter((d) => order[d.severity] >= min);
    }
    if (codes && codes.length) {
      diags = diags.filter((d) => codes.includes(d.code));
    }

    const errors = diags.filter((d) => isError(d.code)).length;
    const warnings = diags.filter((d) => d.severity === 'warn').length;
    const infos = diags.filter((d) => d.severity === 'info').length;

    const summary = { errors, warnings, infos, total: diags.length };
    const result = { diagnostics: diags, summary, exit_code: errors > 0 ? 1 : 0 };

    const exitCode = values['--exit-zero'] ? 0 : errors > 0 ? 1 : 0;

    if (ctx.opts.json) {
      return { result, exit: exitCode, envelopeDiagnostics: [] };
    }
    if (ctx.opts.quiet) return { result, exit: exitCode };

    const lines = diags.map((d) => {
      const sev = d.severity.padEnd(5);
      return `ACC${d.code.slice(3)}  ${sev}  ${d.path || '.'}    ${d.message}`;
    });
    if (lines.length) {
      lines.push('');
      lines.push(`Found ${diags.length} diagnostic${diags.length === 1 ? '' : 's'} (${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${infos} info${infos === 1 ? '' : 's'})`);
    } else {
      lines.push('No diagnostics. Repository is ACC-clean.');
    }
    return { text: lines.join('\n') + '\n', exit: exitCode };
  },
};
