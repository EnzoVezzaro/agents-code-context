/**
 * `acc engine [path]` — the always-on AI intelligence engine.
 *
 * The engine does automatically what the coding agent working on the
 * project should have done: it keeps the ACC files (AGENTS.md contracts,
 * .acc-memory.md knowledge, ACC_WARN.md drift) in sync with the code.
 *
 *   - Engine ON  → run `acc engine --watch`: the agent can ignore the
 *     ACC files and just code; the engine reviews changed files, updates
 *     knowledge/memory, and reports drift.
 *   - Engine OFF → the coding agent is exclusively responsible for the
 *     ACC files and follows the ACC workflow (see the skill / docs).
 *
 * Deterministic phase (always, offline): derives the graph, runs the
 * diagnostic scan, computes per-boundary graph slices and the
 * dependency-gap plan (discovered deps not yet declared).
 *
 * Sync phase (--apply only, deterministic): reuses `acc build` and
 * `acc discover` to create missing AGENTS.md contracts (+ initial
 * memory records) and declare discovered dependencies — additive only.
 *
 * AI phase (only when `ai.enabled` is true): for each scoped boundary
 * with a contract, reviews the contract against the derived slice and
 * produces durable knowledge entries and drift proposals. With --apply,
 * knowledge entries are written to .acc-memory.md (gitignored);
 * contract rewrites and skill/standard gaps are proposals only. The
 * supervisor scores proposals against ACC rules before anything is
 * written.
 */
'use strict';

const { runEngine } = require('../core/engine');
const { providersOf } = require('../core/ai');
const { saveSnapshot, listSnapshots, restoreSnapshot } = require('../core/rollback');
const initCommand = require('./init');
const fillCommand = require('./fill');
const term = require('../core/terminal');

module.exports = {
  name: 'engine',
  summary: 'Always-on AI intelligence engine — automatically maintains the ACC files (deterministic + AI)',
  usage: 'acc engine [path] [--apply] [--force] [--supervisor] [--init-context] [--rollback] [--list] [--yes] [--watch] [--model <id>] [--template <path>] [--json]',
  booleans: ['--apply', '--force', '--supervisor', '--init-context', '--rollback', '--list', '--yes', '--watch', '--json'],
  flags: { '--model': { type: 'string' }, '--template': { type: 'string' } },

  async run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const scope = positionals[0] ? positionals[0].replace(/\/+$/, '') : null;

    // --rollback: undo the last ACC write operation by restoring a snapshot.
    if (values['--rollback']) {
      return runRollback(ctx, values);
    }

    // --init-context: bootstrap the repository — scaffold ACC (init),
    // create every missing AGENTS.md contract from the codebase, declare
    // discovered dependencies, write the drift report, and report what
    // still needs human attention (fill).
    if (values['--init-context']) {
      return runInitContext(ctx, { scope, modelId: values['--model'] || null, supervisor: !!values['--supervisor'], templatePath: values['--template'] || null });
    }

    // Live watch mode: keep the server alive, re-run on changes, stream
    // logs (phases, AI responses, supervisor scores) to the terminal.
    if (values['--watch']) {
      return runWatch(ctx, {
        scope,
        apply: !!values['--apply'],
        force: !!values['--force'],
        supervisor: !!values['--supervisor'],
        modelId: values['--model'] || null,
      });
    }

    const outcome = await runEngine({
      root: ctx.root,
      config: ctx.config,
      configPresent: ctx.configPresent,
      configValid: ctx.configValid,
      configError: ctx.configError,
      apply: !!values['--apply'],
      force: !!values['--force'],
      supervisor: !!values['--supervisor'],
      scope,
      modelId: values['--model'] || null,
    });

    if (ctx.opts.json) return { result: outcome };

    const { scan, sync, ai } = outcome;
    const lines = [];
    lines.push('');
    lines.push(term.header(term.icons.gear, 'ACC Engine', term.theme.primary));
    lines.push(term.hr(60, term.theme.muted));
    lines.push('');

    // Scan section
    lines.push(term.header(term.icons.chart, 'Scan Results', term.theme.info));
    lines.push(term.indent(
      term.summary([
        { label: 'Boundaries', value: scan.stats.boundaries, color: term.theme.primary },
        { label: 'Files', value: scan.stats.files, color: term.theme.info },
        { label: 'Tests', value: scan.stats.tests, color: term.theme.success },
        { label: 'Skills', value: scan.stats.skills, color: term.theme.secondary },
        { label: 'Standards', value: scan.stats.standards, color: term.theme.accent },
      ])
    ));
    lines.push(term.indent(
      term.summary([
        { label: 'Edges', value: `${scan.stats.edges_declared} declared, ${scan.stats.edges_discovered} discovered`, color: term.theme.info },
        { label: 'Cycles', value: scan.stats.cycles, color: scan.stats.cycles > 0 ? term.theme.warning : term.theme.success },
      ])
    ));
    const d = scan.diagnostics_summary;
    lines.push(term.indent(
      term.summary([
        { label: 'Diagnostics', value: `${d.total} (${term.formatNumber(d.errors, 'error')} errors, ${term.formatNumber(d.warnings, 'warning')} warnings, ${term.formatNumber(d.infos, 'info')} infos)`, color: term.theme.info },
      ])
    ));
    lines.push(term.indent(
      term.summary([
        { label: 'Slices', value: scan.slices.length, color: term.theme.info },
        { label: 'Dep gaps', value: scan.dependency_gaps.length, color: scan.dependency_gaps.length > 0 ? term.theme.warning : term.theme.success },
      ])
    ));
    if (scan.dependency_gaps.length) {
      for (const g of scan.dependency_gaps) {
        lines.push(term.indent(`${term.theme.muted(term.icons.arrow)} ${term.theme.warning(g.from)} ${term.theme.muted('→')} ${term.theme.warning(g.to)} ${term.theme.muted(`(${g.source})`)}`));
      }
    }
    lines.push('');

    // Sync section
    lines.push(term.header(term.icons.file, 'Sync', term.theme.secondary));
    if (sync.applied) {
      lines.push(term.indent(
        `${term.theme.success(term.icons.check)} ` +
        `${sync.contracts_created.length} contract(s) created, ` +
        `${sync.suggestions_applied} suggestion(s) applied, ` +
        `${sync.memory_records_created.length} memory record(s) created`
      ));
    } else {
      lines.push(term.indent(
        `${term.theme.muted(term.icons.dot)} ` +
        `${term.theme.warning(sync.contracts_missing.length)} contract(s) missing, ` +
        `${term.theme.warning(sync.suggestions)} suggestion(s) — run with ${term.theme.accent('--apply')}`
      ));
    }
    lines.push('');

    // Trigger section
    const outcomeTrigger = outcome.trigger;
    lines.push(term.header(term.icons.rocket, 'Trigger', term.theme.accent));
    if (outcomeTrigger.current !== null) {
      lines.push(term.indent(
        `${term.theme.muted(outcomeTrigger.mode)} ${term.theme.info(outcomeTrigger.current + '/' + outcomeTrigger.threshold)} ${term.theme.muted('—')} ${outcomeTrigger.reason}`
      ));
    } else {
      lines.push(term.indent(
        `${term.theme.muted(outcomeTrigger.mode)} ${term.theme.muted('(threshold ' + outcomeTrigger.threshold + ')')} ${term.theme.muted('—')} ${outcomeTrigger.reason}`
      ));
    }
    lines.push('');

    // AI section
    lines.push(term.header(term.icons.brain, 'AI', term.theme.secondary));
    if (!ai.enabled) {
      lines.push(term.indent(`${term.theme.muted(term.icons.dot)} ${term.theme.muted('disabled (ai.enabled: false) — deterministic only')}`));
    } else if (ai.skipped) {
      lines.push(term.indent(
        `${term.theme.warning(term.icons.clock)} ${term.theme.warning('enabled but waiting')} ${term.theme.muted('(' + ai.reason + ')')} — run with ${term.theme.accent('--force')}`
      ));
    } else if (ai.errors.length) {
      lines.push(term.indent(`${term.theme.error(term.icons.cross)} ${term.theme.error('errors (all providers exhausted)')}`));
      for (const e of ai.errors) lines.push(term.indent(term.indent(`${term.theme.error(term.icons.cross)} ${e}`)));
      if (ai.retry_log && ai.retry_log.length) {
        lines.push(term.indent(term.theme.muted('failed attempts:')));
        for (const f of ai.retry_log) lines.push(term.indent(term.indent(
          `${term.theme.error(f.provider)} ${term.theme.muted('(' + f.model + ')')} attempt ${term.theme.warning(f.attempt)}: ${f.error}`
        )));
      }
    } else {
      const p = ai.provider;
      const written = ai.knowledge_written || 0;
      const statusStr = written
        ? ` — ${written} knowledge entr${written === 1 ? 'y' : 'ies'} written`
        : ai.applied
          ? ' — nothing written (empty or rejected)'
          : '';
      lines.push(term.indent(
        `${term.theme.success(term.icons.check)} ${term.theme.primary(p.provider)} ${term.theme.muted('/')} ${term.theme.info(p.model)} ${term.theme.muted('(id: ' + p.id + ')' + statusStr)}`
      ));
      if (ai.provider_notes && ai.provider_notes.length) {
        for (const n of ai.provider_notes) lines.push(term.indent(
          `${term.theme.muted(term.icons.arrow)} skipped provider '${term.theme.warning(n.id)}': ${n.error}`
        ));
      }
      if (ai.retry_log && ai.retry_log.length) {
        lines.push(term.indent(`${term.theme.warning(term.icons.warning)} ${ai.retry_log.length} failed attempt(s) recovered`));
        for (const f of ai.retry_log) lines.push(term.indent(term.indent(
          `${term.theme.error(f.provider)} ${term.theme.muted('(' + f.model + ')')} attempt ${term.theme.warning(f.attempt)}: ${f.error}`
        )));
      }
      for (const r of ai.results) {
        const parts = [];
        if (r.knowledge.length) parts.push(`${term.theme.success(r.knowledge.length)} knowledge`);
        if (r.drift.length) parts.push(`${term.theme.warning(r.drift.length)} drift`);
        if (r.skill_gaps.length) parts.push(`${term.theme.info(r.skill_gaps.length)} skill gap(s)`);
        if (r.standard_gaps.length) parts.push(`${term.theme.info(r.standard_gaps.length)} standard gap(s)`);
        if (r.supervisor && r.supervisor.enabled) {
          const approved = r.supervisor.approved;
          parts.push(`supervisor ${approved ? term.theme.success(r.supervisor.score) : term.theme.error(r.supervisor.score)}/${term.theme.muted(ai.supervisor.threshold)}${approved ? ' ' + term.theme.success(term.icons.check) : ' ' + term.theme.error(term.icons.cross)}`);
        }
        lines.push(term.indent(
          `${term.theme.muted(term.icons.arrow)} ${term.theme.primary(r.dir)}: ${parts.length ? parts.join(', ') : term.theme.muted('no findings')}`
        ));
      }
    }
    if (ai.changed_files && ai.changed_files.length) {
      lines.push('');
      lines.push(term.indent(`${term.theme.muted('Changed files:')} ${ai.changed_files.join(', ')}`));
    }
    lines.push('');

    // Drift report section
    const w = outcome.warn;
    lines.push(term.header(term.icons.warning, 'ACC_WARN.md', term.theme.warning));
    if (w.diagnostics || w.docs_behind_code || w.docs_ahead_of_code || w.ai_findings) {
      const parts = [];
      if (w.diagnostics) parts.push(`${term.formatNumber(w.diagnostics, 'error')} diagnostics`);
      if (w.docs_behind_code) parts.push(`${term.formatNumber(w.docs_behind_code, 'warning')} documentation-behind`);
      if (w.docs_ahead_of_code) parts.push(`${term.formatNumber(w.docs_ahead_of_code, 'warning')} documentation-ahead`);
      if (w.ai_findings) parts.push(`${term.formatNumber(w.ai_findings, 'info')} AI finding(s)`);
      lines.push(term.indent(`${term.theme.warning(term.icons.warning)} updated — ${parts.join(', ')}`));
    } else {
      lines.push(term.indent(`${term.theme.success(term.icons.check)} ${term.theme.success('clean')}`));
    }
    lines.push('');
    return { text: lines.join('\n') + '\n' };
  },
};

/**
 * `acc engine --init-context` — bootstrap a repository into a fully
 * ACC-contextualized state:
 *
 *   1. `acc init` — scaffold `.acc/config/`, the root AGENTS.md template,
 *      root `.acc-memory.md`, and `.gitignore` (additive, never rewrites).
 *   2. `acc engine --apply` — create every missing AGENTS.md contract
 *      from the codebase (`acc build --yes --from-discovery`), declare
 *      discovered dependencies (`acc discover --apply`, additive kinds),
 *      and regenerate ACC_WARN.md.
 *   3. `acc fill` — report which contracts still have placeholders or
 *      missing sections, so a human/agent knows what context to add.
 *
 * Deterministic; never deletes or rewrites existing content.
 */
async function runInitContext(ctx, { scope, modelId, supervisor = false, templatePath = null }) {
  const fs = require('fs');
  const path = require('path');
  const readline = require('readline');
  const { resolveRoot, load } = require('../core/config');
  const { agentsMdTemplate } = require('../core/templates');
  const aiCommand = require('./ai');
  const root = resolveRoot(ctx.rootFlag);
  const loaded = load(root);
  const localCtx = {
    ...ctx,
    root,
    config: loaded.config,
    configPresent: loaded.configPresent,
    configValid: loaded.configValid,
    configError: loaded.error,
    opts: { ...ctx.opts, json: true, quiet: true },
  };

  // 1. init (scaffold). --scan is forced: init-context must map the code.
  // This creates .acc/config/config.yaml (with ai section commented out
  // by default), AGENTS.md, templates, and other scaffold files.
  const initOutcome = await initCommand.run(
    { positionals: [], values: { '--scan': true }, unknown: [], errors: [] },
    localCtx,
  );

  // 1b. The root AGENTS.md is the project's top contract. init now
  // writes the template to disk; init-context creates it only if init
  // did not (e.g. when called without --scan).
  let rootContractCreated = false;
  const rootAgents = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(rootAgents)) {
    fs.writeFileSync(rootAgents, agentsMdTemplate(path.basename(root), localCtx.config, templatePath));
    rootContractCreated = true;
  }

  // 1c. Reload config from disk — init just created/updated config.yaml,
  // so we need the fresh version to check AI provider status accurately.
  const reloadedAfterInit = load(root);
  localCtx.config = reloadedAfterInit.config;
  localCtx.configPresent = reloadedAfterInit.configPresent;

  // 1d. Check if AI is configured. If not, walk the user through setup
  // BEFORE the engine runs, so the AI phase can fill contracts and
  // generate knowledge. This is the single most important UX step:
  // without AI, init-context creates templates but cannot fill them.
  //
  // Check the merged config (config.yaml + ai.yaml). If ai.yaml has
  // a provider from a previous `acc ai add`, it's still valid —
  // the user configured it before and it should be reused.
  const providers = providersOf(localCtx.config);
  const hasReadyProvider = providers.some((p) => p.has_api_key && p.installed && !p.errors.length);

  if (!hasReadyProvider && !ctx.opts.json) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));

    console.log('');
    console.log(`${term.icons.brain} ${term.theme.brain('No AI provider configured.')}`);
    console.log(term.theme.muted('The engine uses AI to fill AGENTS.md contracts with real content,'));
    console.log(term.theme.muted('generate .acc-memory.md knowledge, and detect drift automatically.'));
    console.log(term.theme.muted('Without AI, contracts stay as templates with placeholder items.'));
    console.log('');
    const answer = await ask(`${term.theme.accent('Set up an AI provider now?')} [Y/n] `);
    rl.close();

    if (!answer || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('');
      // Delegate to `acc ai add` (interactive walk: provider → key → model).
      const addResult = await aiCommand.run(
        { positionals: ['add'], values: {}, unknown: [], errors: [] },
        { ...localCtx, opts: { json: false, quiet: false } },
      );
      if (addResult.error) {
        console.log(`${term.theme.error(term.icons.cross)} Provider setup failed: ${addResult.error}`);
        console.log(term.theme.muted('Continuing without AI — contracts will be created but not filled.'));
      } else if (addResult.text) {
        console.log(addResult.text);
      }
      // Reload config to pick up the newly added provider.
      const reloaded = load(root);
      localCtx.config = reloaded.config;
    } else {
      console.log('');
      console.log(`${term.theme.warning(term.icons.warning)} Skipping AI setup — continuing without AI.`);
      console.log(term.theme.muted('Contracts will be created as templates. Run `acc engine --init-context` again'));
      console.log(term.theme.muted('after configuring AI to fill them automatically.'));
    }
  }

  // 2. Save a snapshot before the engine modifies files, so rollback
  // can restore the pre-init state.
  const snapshotFiles = ['AGENTS.md', 'ACC_WARN.md', '.acc-memory.md'];
  // Include subdirectory AGENTS.md files that might be created.
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        snapshotFiles.push(path.join(e.name, 'AGENTS.md'));
      }
    }
  } catch { /* ok */ }
  const snapshotId = saveSnapshot(root, 'engine --init-context', snapshotFiles);

  // 3. engine --apply: create contracts + declare discovered deps. With
  // --supervisor, the AI phase scores its proposals against ACC rules
  // before any knowledge is written (nothing writes below the threshold).
  const outcome = await runEngine({
    root,
    config: localCtx.config,
    configPresent: localCtx.configPresent,
    configValid: localCtx.configValid,
    configError: localCtx.configError,
    apply: true,
    force: true,
    scope,
    modelId,
    supervisor,
  });

  // 3. fill: what still needs human context.
  const fillOutcome = fillCommand.run({ positionals: scope ? [scope] : [], values: {}, unknown: [], errors: [] }, localCtx);

  const result = {
    root,
    init: {
      created: initOutcome.result.created,
      existing: initOutcome.result.existing,
      memory: initOutcome.result.memory,
      scanned: initOutcome.result.scanned,
      scan: initOutcome.result.scan || null,
      root_agents_created: rootContractCreated,
    },
    engine: {
      contracts_missing: outcome.sync.contracts_missing,
      contracts_created: outcome.sync.contracts_created,
      suggestions_applied: outcome.sync.suggestions_applied,
      memory_records_created: outcome.sync.memory_records_created,
      diagnostics: outcome.scan.diagnostics_summary,
      dependency_gaps: outcome.scan.dependency_gaps,
      stale_declarations: outcome.scan.stale_declarations,
      warn: outcome.warn,
      ai: outcome.ai,
    },
    fill: fillOutcome.result.summary,
  };

  if (ctx.opts.json) return { result };
  if (ctx.opts.quiet) return { result };

  const lines = [];
  lines.push('');
  lines.push(term.header(term.icons.rocket, 'ACC Engine — Init Context', term.theme.primary));
  lines.push(term.hr(60, term.theme.muted));
  lines.push('');

  // 1. ACC scaffold
  lines.push(term.header(term.icons.folder, 'ACC Scaffold', term.theme.secondary));
  for (const c of result.init.created) lines.push(term.indent(`${term.theme.success(term.icons.check)} Created ${c}`));
  for (const e of result.init.existing) lines.push(term.indent(`${term.theme.muted(term.icons.dot)} Exists  ${e}`));
  if (result.init.memory.action === 'created') lines.push(term.indent(`${term.theme.success(term.icons.check)} Created ${result.init.memory.file}`));
  if (result.init.root_agents_created) lines.push(term.indent(`${term.theme.success(term.icons.check)} Created AGENTS.md (root contract template)`));
  else lines.push(term.indent(`${term.theme.muted(term.icons.dot)} Exists  AGENTS.md (root contract)`));
  lines.push('');

  // 2. Contracts from codebase
  lines.push(term.header(term.icons.file, 'Contracts from Codebase', term.theme.info));
  if (result.engine.contracts_created.length) {
    lines.push(term.indent(`${term.theme.success(term.icons.check)} Created ${result.engine.contracts_created.length} missing AGENTS.md file(s):`));
    for (const c of result.engine.contracts_created) lines.push(term.indent(term.indent(`${term.theme.success(term.icons.arrow)} ${c === '' ? 'AGENTS.md' : `${c}/AGENTS.md`}`)));
  } else {
    lines.push(term.indent(`${term.theme.success(term.icons.check)} No missing contracts — the codebase is fully documented.`));
  }
  if (result.engine.suggestions_applied) {
    lines.push(term.indent(`${term.theme.info(term.icons.arrow)} Declared ${result.engine.suggestions_applied} discovered dependency(ies).`));
  }
  lines.push('');

  // 3. Diagnostics
  const diagResult = result.engine.diagnostics;
  lines.push(term.header(term.icons.chart, 'Diagnostics', term.theme.warning));
  lines.push(term.indent(
    `${diagResult.total} total (${term.formatNumber(diagResult.errors, 'error')} errors, ${term.formatNumber(diagResult.warnings, 'warning')} warnings, ${term.formatNumber(diagResult.infos, 'info')} infos)`
  ));
  if (result.engine.dependency_gaps.length || result.engine.stale_declarations.length) {
    lines.push(term.indent(`${term.theme.warning(term.icons.warning)} ACC_WARN.md: ${result.engine.warn.diagnostics} violations, ${result.engine.warn.docs_behind_code} documentation-behind, ${result.engine.warn.docs_ahead_of_code} documentation-ahead`));
  } else {
    lines.push(term.indent(`${term.theme.success(term.icons.check)} ACC_WARN.md updated — clean`));
  }
  lines.push('');

  // 4. AI results
  const aiResult = result.engine.ai;
  lines.push(term.header(term.icons.brain, 'AI', term.theme.secondary));
  if (aiResult && aiResult.enabled) {
    if (aiResult.skipped) {
      lines.push(term.indent(`${term.theme.warning(term.icons.clock)} enabled but waiting (${aiResult.reason}) — run with ${term.theme.accent('--force')}`));
    } else if (aiResult.errors && aiResult.errors.length) {
      lines.push(term.indent(`${term.theme.error(term.icons.cross)} errors — ${aiResult.errors.join('; ')}`));
    } else if (aiResult.provider) {
      const written = aiResult.knowledge_written || 0;
      lines.push(term.indent(`${term.theme.success(term.icons.check)} ${term.theme.primary(aiResult.provider.provider)} / ${term.theme.info(aiResult.provider.model)}`));
      if (written) lines.push(term.indent(`${term.theme.success(term.icons.arrow)} ${written} knowledge entr${written === 1 ? 'y' : 'ies'} written to .acc-memory.md`));
      for (const r of aiResult.results) {
        const parts = [];
        if (r.knowledge.length) parts.push(`${term.theme.success(r.knowledge.length)} knowledge`);
        if (r.drift.length) parts.push(`${term.theme.warning(r.drift.length)} drift`);
        if (r.skill_gaps.length) parts.push(`${term.theme.info(r.skill_gaps.length)} skill gap(s)`);
        lines.push(term.indent(`${term.theme.muted(term.icons.arrow)} ${term.theme.primary(r.dir)}: ${parts.length ? parts.join(', ') : term.theme.muted('no findings')}`));
      }
    } else {
      lines.push(term.indent(`${term.theme.muted(term.icons.dot)} no providers available — deterministic only`));
    }
  } else {
    lines.push(term.indent(`${term.theme.muted(term.icons.dot)} disabled (ai.enabled: false) — deterministic only`));
  }
  lines.push('');

  // 5. Fill results
  const fillResult = result.fill;
  lines.push(term.header(term.icons.check, 'Fill', term.theme.info));
  lines.push(term.indent(
    `${fillResult.total} AGENTS.md file(s) — ${term.theme.warning(fillResult.draft)} draft, ${term.theme.success(fillResult.complete)} complete, ${term.formatNumber(fillResult.placeholder_items, 'warning')} placeholder item(s) to replace.`
  ));
  if (fillResult.draft || fillResult.placeholder_items) {
    // Check if AI was available — the message changes based on that.
    const aiWasAvailable = aiResult && aiResult.enabled && aiResult.provider;
    if (aiWasAvailable) {
      lines.push(term.indent(`${term.theme.success(term.icons.check)} Contracts filled by AI. Run ${term.theme.accent('acc engine --supervisor --force')} to re-score.`));
    } else {
      lines.push(term.indent(`${term.theme.warning(term.icons.warning)} Contracts are templates with placeholder items. To fill them automatically:`));
      lines.push(term.indent(`${term.theme.info('1.')} Configure an AI provider: ${term.theme.accent('acc ai add')}`));
      lines.push(term.indent(`${term.theme.info('2.')} Run ${term.theme.accent('acc engine --init-context')} again — the engine will fill all contracts.`));
    }
  }
  lines.push('');
  lines.push(`${term.theme.success(term.icons.rocket)} Repository initialized with full ACC context.`);
  lines.push(`${term.theme.muted(term.icons.dot)} Snapshot saved (${term.theme.info(snapshotId)}) — run ${term.theme.accent('acc engine --rollback')} to undo.`);
  return { text: lines.join('\n') + '\n' };
}

/**
 * `acc engine --rollback` — undo the last ACC file-modifying operation.
 * Lists snapshots with --list, or restores the most recent (or a
 * specific one with --id). Prompts for confirmation unless --yes.
 */
function runRollback(ctx, values) {
  const readline = require('readline');
  const fs = require('fs');
  const path = require('path');
  const { resolveRoot } = require('../core/config');

  const root = resolveRoot(ctx.rootFlag);
  const snapshots = listSnapshots(root);

  // --list: show available snapshots.
  if (values['--list']) {
    if (!snapshots.length) return { text: 'No snapshots available.\n' };
    const lines = [];
    lines.push(term.header(term.icons.folder, 'Snapshots', term.theme.info));
    lines.push(term.hr(60, term.theme.muted));
    for (const s of snapshots) {
      lines.push(term.indent(
        `${term.theme.info(s.id)}  ${term.theme.muted(s.command)}  ${term.theme.info(s.files.length)} file(s)  ${term.theme.muted(s.created)}`
      ));
    }
    return { text: lines.join('\n') + '\n' };
  }

  if (!snapshots.length) {
    return { text: 'No snapshots available for rollback. Run `acc engine --init-context` first.\n' };
  }

  // Find the target snapshot.
  let target = null;
  if (values['--id']) {
    target = snapshots.find((s) => s.id === values['--id']);
    if (!target) return { error: `no snapshot with id '${values['--id']}' — run with --list to see available snapshots`, exit: 1 };
  } else {
    target = snapshots[0];
  }

  const doRollback = () => {
    const result = restoreSnapshot(root, target);
    const lines = [];
    lines.push('');
    lines.push(term.header(term.icons.rocket, 'Rollback', term.theme.warning));
    lines.push(term.hr(60, term.theme.muted));
    for (const f of target.files) {
      const action = f.existed ? term.theme.success('Restored') : term.theme.error('Removed');
      lines.push(term.indent(`${action} ${f.path}`));
    }
    lines.push('');
    lines.push(result.text);
    return { text: lines.join('\n') };
  };

  // Interactive confirmation.
  if (!values['--yes'] && process.stdin.isTTY && !ctx.opts.json) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      console.log('');
      console.log(term.header(term.icons.warning, 'Rollback Confirmation', term.theme.warning));
      console.log(term.hr(60, term.theme.muted));
      console.log(term.indent(`${term.theme.info('Snapshot:')} ${target.id}`));
      console.log(term.indent(`${term.theme.info('Command:')} ${target.command}`));
      console.log(term.indent(`${term.theme.info('Files:')} ${target.files.length}`));
      console.log(term.indent(`${term.theme.info('Created:')} ${target.created}`));
      console.log('');
      for (const f of target.files) {
        console.log(term.indent(`${f.existed ? term.theme.success(term.icons.check) : term.theme.error(term.icons.cross)} ${f.existed ? 'restore' : 'delete'} ${f.path}`));
      }
      console.log('');
      rl.question(`${term.theme.accent('Proceed?')} [y/N] `, (answer) => {
        rl.close();
        const a = (answer || '').trim().toLowerCase();
        if (a !== 'y' && a !== 'yes') {
          resolve({ text: 'Aborted.\n' });
          return;
        }
        resolve(doRollback());
      });
    });
  }

  return doRollback();
}

/**
 * Live watch mode: a long-running server in the terminal. Re-runs the
 * engine whenever the tree changes (lightweight fs.watch, debounced),
 * streaming phase logs and AI responses to stdout. Ctrl-C exits.
 */
async function runWatch(ctx, opts) {
  const fs = require('fs');
  const path = require('path');
  const { evaluateTrigger } = require('../core/trigger');
  const { DEFAULT_MAX_CONSECUTIVE_FAILURES } = require('../core/engine');

  const logError = (...parts) => process.stdout.write(`${term.theme.error(term.icons.cross)} ${term.theme.error(parts.join(' '))}\n`);
  const logWarning = (...parts) => process.stdout.write(`${term.theme.warning(term.icons.warning)} ${term.theme.warning(parts.join(' '))}\n`);
  const logSuccess = (...parts) => process.stdout.write(`${term.theme.success(term.icons.check)} ${term.theme.success(parts.join(' '))}\n`);
  const logInfo = (...parts) => process.stdout.write(`${term.theme.info(term.icons.info)} ${parts.join(' ')}\n`);
  const logMuted = (...parts) => process.stdout.write(`${term.theme.muted(parts.join(' '))}\n`);

  // How many consecutive AI failures (all providers exhausted) the
  // server tolerates before stopping — configured under engine.ai.
  const aiCfg = (ctx.config.engine && ctx.config.engine.ai) || {};
  const maxFailures = Number.isInteger(aiCfg.max_consecutive_failures) && aiCfg.max_consecutive_failures > 0
    ? aiCfg.max_consecutive_failures
    : DEFAULT_MAX_CONSECUTIVE_FAILURES;
  const retryDelayMs =
    Number.isFinite(aiCfg.retry_delay_ms) && aiCfg.retry_delay_ms >= 0 ? aiCfg.retry_delay_ms : 1000;
  let consecutiveAiFailures = 0;
  let retryTimer = null;

  const run = async (reason) => {
    logInfo(`run triggered: ${term.theme.muted(reason)}`);
    try {
      const outcome = await runEngine({
        root: ctx.root,
        config: ctx.config,
        configPresent: ctx.configPresent,
        configValid: ctx.configValid,
        configError: ctx.configError,
        apply: opts.apply,
        force: opts.force,
        supervisor: opts.supervisor,
        scope: opts.scope,
        modelId: opts.modelId,
      });
      const outcomeTrigger = outcome.trigger;
      logSuccess(`scan: ${term.theme.primary(outcomeTrigger ? String(outcome.scan.stats.boundaries) : '0')} boundaries, ${term.theme.info(outcome.scan.stats.files)} files, ${term.formatNumber(outcome.scan.diagnostics_summary.total, outcome.scan.diagnostics_summary.errors > 0 ? 'error' : 'info')} diagnostics`);
      logMuted(`trigger: ${outcomeTrigger ? outcomeTrigger.mode : 'unknown'} ${outcomeTrigger && outcomeTrigger.current !== null ? term.theme.info(outcomeTrigger.current + '/' + outcomeTrigger.threshold) : ''} ${term.theme.muted(outcomeTrigger ? outcomeTrigger.reason : '')}`);
      if (!outcome.ai.enabled) logMuted('ai: disabled (deterministic only)');
      else if (outcome.ai.skipped) logWarning(`ai: waiting (${outcome.ai.reason})`);
      else if (outcome.ai.errors.length) {
        consecutiveAiFailures++;
        logError(`ai failure ${term.theme.warning(consecutiveAiFailures + '/' + maxFailures)} — all providers exhausted:`);
        for (const e of outcome.ai.errors) logError(`  ${e}`);
        if (outcome.ai.retry_log && outcome.ai.retry_log.length) {
          for (const f of outcome.ai.retry_log) logMuted(`    ${term.theme.error(f.provider)} (${f.model}) attempt ${term.theme.warning(f.attempt)}: ${f.error}`);
        }
        if (consecutiveAiFailures >= maxFailures) {
          logMuted('');
          logError(`FATAL: ${maxFailures} consecutive AI failures — stopping the engine.`);
          logMuted('Fix the AI configuration (api keys / providers) and restart `acc engine --watch`.');
          process.exit(1);
        }
        // Retry the run automatically after a short pause, so a
        // transient provider failure recovers without waiting for a
        // filesystem change.
        if (!retryTimer) {
          retryTimer = setTimeout(() => {
            retryTimer = null;
            run(`retry after AI failure (${consecutiveAiFailures}/${maxFailures})`);
          }, retryDelayMs);
        }
      } else {
        consecutiveAiFailures = 0;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (outcome.ai.retry_log && outcome.ai.retry_log.length) {
          for (const f of outcome.ai.retry_log) logInfo(`ai retry recovered: ${term.theme.primary(f.provider)} (${f.model}) attempt ${term.theme.success(f.attempt)}: ${f.error}`);
        }
        for (const r of outcome.ai.results) {
          logInfo(`ai ${term.theme.primary(r.dir)}: ${term.theme.success(r.knowledge.length)} knowledge, ${term.theme.warning(r.drift.length)} drift`);
          if (r.supervisor && r.supervisor.enabled) {
            const approved = r.supervisor.approved;
            logInfo(`supervisor ${term.theme.primary(r.dir)}: score ${approved ? term.theme.success(r.supervisor.score) : term.theme.error(r.supervisor.score)}/${term.theme.muted(outcome.ai.supervisor.threshold)}${approved ? ' ' + term.theme.success('approved') : ' ' + term.theme.error('rejected')} (${r.supervisor.iterations.length} iteration(s))`);
            for (const it of r.supervisor.iterations) logMuted(`  iteration ${it.iteration}: score ${term.theme.info(it.score)} — ${(it.issues || []).join(' | ') || 'no issues'}`);
          }
        }
      }
      const w = outcome.warn;
      logMuted(`ACC_WARN.md: ${w.diagnostics} diagnostics, ${w.docs_behind_code} documentation-behind, ${w.docs_ahead_of_code} documentation-ahead${w.ai_findings ? `, ${w.ai_findings} AI finding(s)` : ''}`);
    } catch (err) {
      logError(`run failed: ${err.message}`);
    }
  };

  logInfo(`watching ${term.theme.primary(ctx.root)} ${term.theme.muted('(Ctrl-C to stop)')}`);
  await run('initial');

  let timer = null;
  const watcher = fs.watch(ctx.root, { recursive: true }, (eventType, filename) => {
    // Ignore ACC's own derived outputs (the drift report, memory, state)
    // so writing them never re-triggers the loop.
    const name = filename ? String(filename) : '';
    if (/ACC_WARN\.md$/.test(name)) return;
    if (/\.acc-memory\.md$/.test(name)) return;
    if (name.startsWith('.acc' + path.sep) || name.startsWith('.acc/')) return;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      run('filesystem change');
    }, 1500);
  });
  watcher.on('error', (err) => logError(`watcher error: ${err.message}`));

  // Keep the process alive; Ctrl-C exits naturally.
  await new Promise(() => {});
}
