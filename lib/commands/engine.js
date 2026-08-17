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
const initCommand = require('./init');
const fillCommand = require('./fill');

module.exports = {
  name: 'engine',
  summary: 'Always-on AI intelligence engine — automatically maintains the ACC files (deterministic + AI)',
  usage: 'acc engine [path] [--apply] [--force] [--supervisor] [--init-context] [--watch] [--model <id>] [--json]',
  booleans: ['--apply', '--force', '--supervisor', '--init-context', '--watch', '--json'],
  flags: { '--model': { type: 'string' } },

  async run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const scope = positionals[0] ? positionals[0].replace(/\/+$/, '') : null;

    // --init-context: bootstrap the repository — scaffold ACC (init),
    // create every missing AGENTS.md contract from the codebase, declare
    // discovered dependencies, write the drift report, and report what
    // still needs human attention (fill).
    if (values['--init-context']) {
      return runInitContext(ctx, { scope, modelId: values['--model'] || null, supervisor: !!values['--supervisor'] });
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
    lines.push('ACC engine — deterministic scan');
    lines.push(
      `Boundaries: ${scan.stats.boundaries} · Files: ${scan.stats.files} · Tests: ${scan.stats.tests} · ` +
        `Skills: ${scan.stats.skills} · Standards: ${scan.stats.standards}`,
    );
    lines.push(
      `Edges: ${scan.stats.edges_declared} declared, ${scan.stats.edges_discovered} discovered · Cycles: ${scan.stats.cycles}`,
    );
    const d = scan.diagnostics_summary;
    lines.push(`Diagnostics: ${d.total} (${d.errors} errors, ${d.warnings} warnings, ${d.infos} infos)`);
    lines.push(`Slices: ${scan.slices.length} · Dependency gaps: ${scan.dependency_gaps.length}`);
    if (scan.dependency_gaps.length) {
      for (const g of scan.dependency_gaps) lines.push(`  gap: ${g.from} → ${g.to} (${g.source})`);
    }

    lines.push('');
    if (sync.applied) {
      lines.push(
        `Sync applied: ${sync.contracts_created.length} contract(s) created, ` +
          `${sync.suggestions_applied} suggestion(s) applied, ${sync.memory_records_created.length} memory record(s) created`,
      );
    } else {
      lines.push(
        `Sync (dry-run): ${sync.contracts_missing.length} contract(s) missing, ${sync.suggestions} suggestion(s) — run with --apply to apply`,
      );
    }

    lines.push('');
    const t = outcome.trigger;
    if (t.current !== null) {
      lines.push(`Trigger: ${t.mode} ${t.current}/${t.threshold} — ${t.reason}`);
    } else {
      lines.push(`Trigger: ${t.mode} (threshold ${t.threshold}) — ${t.reason}`);
    }
    lines.push('');
    if (!ai.enabled) {
      lines.push('AI: disabled (ai.enabled: false) — deterministic only');
    } else if (ai.skipped) {
      lines.push(`AI: enabled but waiting (${ai.reason}) — run with --force to trigger now`);
    } else if (ai.errors.length) {
      lines.push('AI: enabled — errors (all providers exhausted):');
      for (const e of ai.errors) lines.push(`  ✗ ${e}`);
      if (ai.retry_log && ai.retry_log.length) {
        lines.push('  failed attempts:');
        for (const f of ai.retry_log) lines.push(`    ${f.provider} (${f.model}) attempt ${f.attempt}: ${f.error}`);
      }
    } else {
      const p = ai.provider;
      const written = ai.knowledge_written || 0;
      const status = written
        ? ` — ${written} knowledge entr${written === 1 ? 'y' : 'ies'} written`
        : ai.applied
          ? ' — nothing written (empty or rejected)'
          : '';
      lines.push(`AI: ${p.provider} / ${p.model} (id: ${p.id})${status}`);
      if (ai.provider_notes && ai.provider_notes.length) {
        for (const n of ai.provider_notes) lines.push(`  skipped provider '${n.id}': ${n.error}`);
      }
      if (ai.retry_log && ai.retry_log.length) {
        lines.push(`  retries needed: ${ai.retry_log.length} failed attempt(s) recovered`);
        for (const f of ai.retry_log) lines.push(`    ${f.provider} (${f.model}) attempt ${f.attempt}: ${f.error}`);
      }
      for (const r of ai.results) {
        const parts = [];
        if (r.knowledge.length) parts.push(`${r.knowledge.length} knowledge`);
        if (r.drift.length) parts.push(`${r.drift.length} drift`);
        if (r.skill_gaps.length) parts.push(`${r.skill_gaps.length} skill gap(s)`);
        if (r.standard_gaps.length) parts.push(`${r.standard_gaps.length} standard gap(s)`);
        if (r.supervisor && r.supervisor.enabled) {
          parts.push(`supervisor ${r.supervisor.score}/${ai.supervisor.threshold}${r.supervisor.approved ? ' ✓' : ' ✗'}`);
        }
        lines.push(`  ${r.dir}: ${parts.length ? parts.join(', ') : 'no findings'}`);
      }
    }
    if (ai.changed_files && ai.changed_files.length) {
      lines.push('');
      lines.push(`Changed files evaluated: ${ai.changed_files.join(', ')}`);
    }
    lines.push('');
    const w = outcome.warn;
    if (w.diagnostics || w.docs_behind_code || w.docs_ahead_of_code || w.ai_findings) {
      lines.push(`⚠️  ACC_WARN.md updated — ${w.diagnostics} diagnostics, ${w.docs_behind_code} documentation-behind, ${w.docs_ahead_of_code} documentation-ahead${w.ai_findings ? `, ${w.ai_findings} AI finding(s)` : ''}`);
    } else {
      lines.push('ACC_WARN.md updated — clean');
    }
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
async function runInitContext(ctx, { scope, modelId, supervisor = false }) {
  const fs = require('fs');
  const path = require('path');
  const { resolveRoot } = require('../core/config');
  const { agentsMdTemplate } = require('../core/templates');
  const root = resolveRoot(ctx.rootFlag);
  const loaded = require('../core/config').load(root);
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
  const initOutcome = await initCommand.run(
    { positionals: [], values: { '--scan': true }, unknown: [], errors: [] },
    localCtx,
  );

  // 1b. The root AGENTS.md is the project's top contract. init only
  // prints a template when absent; init-context creates it (the root
  // has no direct source files, so `acc build` never generates it).
  let rootContractCreated = false;
  const rootAgents = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(rootAgents)) {
    fs.writeFileSync(rootAgents, agentsMdTemplate(path.basename(root)));
    rootContractCreated = true;
  }

  // 2. engine --apply: create contracts + declare discovered deps. With
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
    },
    fill: fillOutcome.result.summary,
  };

  if (ctx.opts.json) return { result };
  if (ctx.opts.quiet) return { result };

  const lines = [];
  lines.push('ACC engine — init-context');
  lines.push('');
  lines.push('1. ACC scaffold:');
  for (const c of result.init.created) lines.push(`   Created ${c}`);
  for (const e of result.init.existing) lines.push(`   Exists  ${e}`);
  if (result.init.memory.action === 'created') lines.push(`   Created ${result.init.memory.file}`);
  if (result.init.root_agents_created) lines.push('   Created AGENTS.md (root contract template)');
  else lines.push('   Exists  AGENTS.md (root contract)');
  lines.push('');
  lines.push('2. Contracts from codebase:');
  if (result.engine.contracts_created.length) {
    lines.push(`   Created ${result.engine.contracts_created.length} missing AGENTS.md file(s):`);
    for (const c of result.engine.contracts_created) lines.push(`   - ${c === '' ? 'AGENTS.md' : `${c}/AGENTS.md`}`);
  } else {
    lines.push('   No missing contracts — the codebase is fully documented.');
  }
  if (result.engine.suggestions_applied) {
    lines.push(`   Declared ${result.engine.suggestions_applied} discovered dependency(ies).`);
  }
  lines.push('');
  const d = result.engine.diagnostics;
  lines.push(
    `3. Diagnostics: ${d.total} (${d.errors} errors, ${d.warnings} warnings, ${d.infos} infos)`,
  );
  if (result.engine.dependency_gaps.length || result.engine.stale_declarations.length) {
    lines.push(`   ACC_WARN.md: ${result.engine.warn.diagnostics} violations, ${result.engine.warn.docs_behind_code} documentation-behind, ${result.engine.warn.docs_ahead_of_code} documentation-ahead — see ACC_WARN.md`);
  } else {
    lines.push('   ACC_WARN.md updated — clean');
  }
  lines.push('');
  const f = result.fill;
  lines.push(`4. Fill: ${f.total} AGENTS.md file(s) — ${f.draft} draft, ${f.complete} complete, ${f.placeholder_items} placeholder item(s) to replace.`);
  if (f.draft || f.placeholder_items) {
    lines.push('   Run `acc fill` for per-file instructions, or `acc engine --supervisor --force`');
    lines.push('   with AI enabled to draft the remaining context.');
  }
  lines.push('');
  lines.push('Repository initialized with full ACC context.');
  return { text: lines.join('\n') + '\n' };
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

  const log = (...parts) => process.stdout.write(`[engine watch] ${parts.join(' ')}
`);
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
    log(`run triggered: ${reason}`);
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
      const t = outcome.trigger;
      log(`scan: ${outcome.scan.stats.boundaries} boundaries, ${outcome.scan.stats.files} files, ${outcome.scan.diagnostics_summary.total} diagnostics`);
      log(`trigger: ${t.mode} ${t.current === null ? '' : t.current + '/' + t.threshold + ' '}${t.reason}`);
      if (!outcome.ai.enabled) log('ai: disabled (deterministic only)');
      else if (outcome.ai.skipped) log(`ai: waiting (${outcome.ai.reason})`);
      else if (outcome.ai.errors.length) {
        consecutiveAiFailures++;
        log(`ai failure ${consecutiveAiFailures}/${maxFailures} — all providers exhausted:`);
        for (const e of outcome.ai.errors) log(`  ✗ ${e}`);
        if (outcome.ai.retry_log && outcome.ai.retry_log.length) {
          for (const f of outcome.ai.retry_log) log(`    ${f.provider} (${f.model}) attempt ${f.attempt}: ${f.error}`);
        }
        if (consecutiveAiFailures >= maxFailures) {
          log('');
          log(`FATAL: ${maxFailures} consecutive AI failures — stopping the engine.`);
          log('Fix the AI configuration (api keys / providers) and restart `acc engine --watch`.');
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
          for (const f of outcome.ai.retry_log) log(`ai retry recovered: ${f.provider} (${f.model}) attempt ${f.attempt}: ${f.error}`);
        }
        for (const r of outcome.ai.results) {
          log(`ai ${r.dir}: ${r.knowledge.length} knowledge, ${r.drift.length} drift`);
          if (r.supervisor && r.supervisor.enabled) {
            log(`supervisor ${r.dir}: score ${r.supervisor.score}/${outcome.ai.supervisor.threshold}${r.supervisor.approved ? ' approved' : ' rejected'} (${r.supervisor.iterations.length} iteration(s))`);
            for (const it of r.supervisor.iterations) log(`  iteration ${it.iteration}: score ${it.score} — ${(it.issues || []).join(' | ') || 'no issues'}`);
          }
        }
      }
      const w = outcome.warn;
      log(`ACC_WARN.md: ${w.diagnostics} diagnostics, ${w.docs_behind_code} documentation-behind, ${w.docs_ahead_of_code} documentation-ahead${w.ai_findings ? `, ${w.ai_findings} AI finding(s)` : ''}`);
    } catch (err) {
      log(`run failed: ${err.message}`);
    }
  };

  log(`watching ${ctx.root} (Ctrl-C to stop)`);
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
  watcher.on('error', (err) => log(`watcher error: ${err.message}`));

  // Keep the process alive; Ctrl-C exits naturally.
  await new Promise(() => {});
}
