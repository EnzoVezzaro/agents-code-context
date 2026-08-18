/**
 * `acc init` — convert a repository into an ACC-enhanced one.
 *
 * Only adds files; never deletes or rewrites existing content. Preserves
 * any existing AGENTS.md, .agents/ and .gitignore content (per the CLI
 * command spec).
 *
 * When run in an interactive terminal, init asks whether to scan the
 * codebase and prepare the project. If confirmed (or with `--scan`), it
 * runs the diagnostics scan (`acc check`) and creates the missing
 * AGENTS.md contract files (`acc build --yes`). Non-interactive runs
 * (CI, piped stdin, `--no-scan`) never scan, keeping the command
 * deterministic and safe on untrusted repositories.
 *
 * Init also creates the root `.acc-memory.md` initial record (when the
 * file is missing), carrying the project's clone date and GitHub origin
 * provenance when `.git` provides them.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { resolveRoot, load } = require('../core/config');
const { agentsMdTemplate, configYaml } = require('../core/templates');
const { check, isError } = require('../core/diagnostics');
const memory = require('../core/memory');
const { gitMeta } = require('../core/gitmeta');
const buildCommand = require('./build');

const VERSION = require('../../package.json').version;

module.exports = {
  name: 'init',
  summary: 'Initialize ACC structure in a directory',
  usage: 'acc init [directory] [--force] [--scan] [--no-scan] [--template <path>]',
  booleans: ['--force', '--scan', '--no-scan'],
  flags: { '--template': { type: 'string' } },

  async run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const root = resolveRoot(ctx.rootFlag || positionals[0]);
    const loaded = load(root);
    const localCtx = {
      ...ctx,
      root,
      config: loaded.config,
      configPresent: loaded.configPresent,
      configValid: loaded.configValid,
      configError: loaded.error,
    };
    const accDir = path.join(root, '.acc', 'config');
    const configFile = path.join(accDir, 'config.yaml');

    const created = [];
    const existing = [];
    let gitignoreUpdated = false;

    // 1. Scaffold .acc/config/ (config.yaml + agents/workflows/standards).
    if (fs.existsSync(configFile) && !values['--force']) {
      existing.push('.acc/config/config.yaml');
    } else if (fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, configYaml(path.basename(root)));
      created.push('.acc/config/config.yaml');
    } else {
      fs.mkdirSync(accDir, { recursive: true });
      fs.writeFileSync(configFile, configYaml(path.basename(root)));
      created.push('.acc/config/config.yaml');
    }
    for (const sub of ['agents', 'workflows', 'standards', 'templates']) {
      const dir = path.join(accDir, sub);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        created.push(`.acc/config/${sub}/`);
      } else {
        existing.push(`.acc/config/${sub}/`);
      }
    }
    // Write the default AGENTS.md template if the templates dir is new.
    const templatesDir = path.join(accDir, 'templates');
    const agentsTemplatePath = path.join(templatesDir, 'agents.md');
    if (!fs.existsSync(agentsTemplatePath)) {
      const { resolveTemplate, renderTemplate, builtinAgentsMdTemplate } = require('../core/templates');
      const raw = resolveTemplate(root, 'agents', null) || builtinAgentsMdTemplate(path.basename(root));
      fs.writeFileSync(agentsTemplatePath, raw);
      created.push('.acc/config/templates/agents.md');
    }

    // 2. Ensure .gitignore excludes .acc-memory.md (append if missing).
    const gitignorePath = path.join(root, '.gitignore');
    let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (!/\.acc-memory\.md/.test(gitignore)) {
      const addition = `${gitignore.endsWith('\n') || gitignore === '' ? '' : '\n'}.acc-memory.md\n`;
      fs.writeFileSync(gitignorePath, gitignore + addition);
      gitignoreUpdated = true;
    }

    // 3. Create the root .acc-memory.md initial record (clone date + GitHub data).
    const rootMemory = memory.init(root, '', memory.initialRecordText({ tool: 'acc init', version: VERSION, subject: 'the project', git: gitMeta(root) }));

    // 4. Decide whether to scan and prepare the project.
    if (values['--scan'] && values['--no-scan']) {
      return { error: '--scan and --no-scan are mutually exclusive', exit: 2 };
    }
    let doScan = !!values['--scan'];
    if (!doScan && !values['--no-scan'] && process.stdin.isTTY) {
      doScan = await askYesNo('Scan the codebase and prepare the project? [y/N] ');
    }

    // 5. Scan and prepare: diagnostics scan + create missing AGENTS.md files.
    let scan = null;
    if (doScan) {
      const diags = check(root, localCtx.config, {
        configPresent: localCtx.configPresent,
        configValid: localCtx.configValid,
        error: localCtx.configError,
      });
      const errors = diags.filter((d) => isError(d.code)).length;
      const warnings = diags.filter((d) => d.severity === 'warn').length;
      const infos = diags.filter((d) => d.severity === 'info').length;

      const buildOutcome = buildCommand.run(
        { positionals: [], values: { '--yes': true, '--from-discovery': true }, unknown: [], errors: [] },
        localCtx,
      );
      scan = {
        diagnostics: { errors, warnings, infos, total: diags.length },
        created_files: buildOutcome.result.created,
      };
    }

    // 6. Write the AGENTS.md root contract template to disk if missing.
    const agentsPath = path.join(root, 'AGENTS.md');
    let agentsMdTemplateWritten = false;
    if (!fs.existsSync(agentsPath)) {
      fs.writeFileSync(agentsPath, agentsMdTemplate(path.basename(root), localCtx.config, values['--template']));
      agentsMdTemplateWritten = true;
      created.push('AGENTS.md');
    }

    const result = {
      root,
      created: created.sort(),
      existing: existing.sort(),
      gitignore_updated: gitignoreUpdated,
      memory: rootMemory,
      agents_md_template_written: agentsMdTemplateWritten,
      scanned: !!scan,
      scan: scan || null,
    };

    if (ctx.opts.json) return { result };
    if (ctx.opts.quiet) return { result };

    const lines = [];
    for (const c of created) lines.push(`Created ${c}`);
    for (const e of existing) lines.push(`Exists  ${e}`);
    if (gitignoreUpdated) lines.push('Updated .gitignore (added .acc-memory.md)');
    if (rootMemory.action === 'created') lines.push(`Created ${rootMemory.file}`);
    else lines.push(`Exists  ${rootMemory.file}`);
    if (scan) {
      const d = scan.diagnostics;
      lines.push(
        `Scanned codebase: ${d.total} diagnostic${d.total === 1 ? '' : 's'} (${d.errors} error${d.errors === 1 ? '' : 's'}, ${d.warnings} warning${d.warnings === 1 ? '' : 's'}, ${d.infos} info${d.infos === 1 ? '' : 's'})`,
      );
      if (scan.created_files.length) {
        lines.push(`Created ${scan.created_files.length} missing AGENTS.md file${scan.created_files.length === 1 ? '' : 's'}:`);
        for (const c of scan.created_files) lines.push(`  ${c === '' ? 'AGENTS.md' : `${c}/AGENTS.md`}`);
      } else {
        lines.push('Created 0 missing AGENTS.md files — the project is fully documented.');
      }
    }
    if (agentsMdTemplateWritten) {
      lines.push('Created AGENTS.md (root contract template)');
    }
    return { text: lines.join('\n') + '\n' };
  },
};

/** Prompt a yes/no question on an interactive terminal. */
function askYesNo(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, (answer) => {
      rl.close();
      const a = (answer || '').trim().toLowerCase();
      resolve(a === 'y' || a === 'yes');
    });
  });
}
