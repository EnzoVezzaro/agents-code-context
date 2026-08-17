/**
 * `acc review [path]` — on-demand AI compliance review of a scope
 * against the repository's own ACC rules.
 *
 * The engine (`acc engine`) runs the AI phase only when the trigger
 * fires (token-gated, default 3 commits). `review` is the manual,
 * on-demand counterpart: an external agent or developer can ask "is
 * this scope compliant right now?" and get a deterministic scan plus a
 * supervisor-scored verdict (0-100) without touching any state.
 *
 *   - Deterministic scan (always, offline): graph, diagnostics, slices,
 *     dependency gaps — identical to the engine's scan.
 *   - AI phase (only when `ai.enabled` is true): for each scoped
 *     boundary with a contract, reviews the contract against its
 *     derived slice (drift, knowledge, skill/standard gaps) and then
 *     scores the review with the supervisor prompt. The supervisor's
 *     `issues` are the actionable feedback.
 *   - Read-only: never writes AGENTS.md, memory, or ACC_WARN.md.
 *
 * Degradation: AI disabled or missing API key → exit 0 with the
 * deterministic scan and a clean error explaining what to configure
 * (same contract as `acc engine`).
 */
'use strict';

const path = require('path');
const { buildScan, buildPrompt, buildSupervisorPrompt, parseAiJson, parseSupervisorJson, realGenerateText, DEFAULT_SUPERVISOR_THRESHOLD, DEFAULT_SUPERVISOR_MAX_ITERATIONS } = require('../core/engine');
const { getModel } = require('../core/ai');
const { readUtf8 } = require('../core/util');

module.exports = {
  name: 'review',
  summary: 'AI compliance review of a path against ACC rules (score 0-100)',
  usage: 'acc review [path] [--model <id>] [--json]',
  booleans: ['--json'],
  flags: { '--model': { type: 'string' } },

  async run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const scope = positionals[0] ? positionals[0].replace(/\/+$/, '') : null;

    // 1. Deterministic scan — always, offline.
    const scan = buildScan(ctx.root, ctx.config, {
      configPresent: ctx.configPresent,
      configValid: ctx.configValid,
      configError: ctx.configError,
    }, scope);

    const result = {
      command: 'review',
      scope: scan.scope,
      diagnostics: scan.diagnostics_summary,
      dependency_gaps: scan.dependency_gaps,
      stale_declarations: scan.stale_declarations,
      ai: { enabled: false },
    };

    const ai = ctx.config.ai || {};
    if (!ai.enabled) {
      result.ai = { enabled: false, skipped: false, reason: 'AI is disabled — set ai.enabled: true in .acc/config/config.yaml', boundaries: [] };
      if (ctx.opts.json) return { result };
      return { text: renderText(result) };
    }

    const resolved = getModel(ctx.config, values['--model'] || null);
    if (resolved.error) {
      result.ai = { enabled: true, skipped: false, provider: null, errors: [resolved.error], boundaries: [] };
      if (ctx.opts.json) return { result };
      return { text: renderText(result) };
    }
    const { model, meta } = resolved;

    // Supervisor threshold from config (same defaults as the engine).
    const supCfg = (ctx.config.engine && ctx.config.engine.supervisor) || {};
    const threshold = Number.isFinite(supCfg.threshold) ? supCfg.threshold : DEFAULT_SUPERVISOR_THRESHOLD;
    const maxIterations = Number.isInteger(supCfg.max_iterations) && supCfg.max_iterations > 0 ? supCfg.max_iterations : DEFAULT_SUPERVISOR_MAX_ITERATIONS;

    // 2. AI phase: review + supervisor score per scoped boundary.
    const inScope = (id) => !scope || id === scope || id.startsWith(scope + '/');
    const boundaries = scan.slices.map((s) => (s.scope === '.' ? '' : s.scope)).filter(inScope);

    const reviews = [];
    const errors = [];
    for (const dir of boundaries) {
      const contractFile = dir === '' ? 'AGENTS.md' : path.posix.join(dir, 'AGENTS.md');
      const contractText = readUtf8(path.join(ctx.root, dir === '' ? '' : dir, 'AGENTS.md')) || '';
      const slice = scan.slices.find((s) => (s.scope === '.' ? '' : s.scope) === dir);
      const gaps = scan.dependency_gaps.filter((g) => (g.from === '.' ? '' : g.from) === dir);
      try {
        const out = await realGenerateText({
          model,
          prompt: buildPrompt(dir, contractText, slice, gaps, [], ctx.root, null),
        });
        const parsed = parseAiJson(out.text);
        if (!parsed) throw new Error('unparseable AI response');
        const changes = {
          knowledge: (Array.isArray(parsed.knowledge) ? parsed.knowledge : []).map((k) => String(k).trim()).filter(Boolean).slice(0, 5),
          drift: (Array.isArray(parsed.drift) ? parsed.drift : []).map((d) => (typeof d === 'string' ? { fact: d } : d)),
          skill_gaps: (Array.isArray(parsed.skill_gaps) ? parsed.skill_gaps : []).map((s) => String(s).trim()).filter(Boolean),
          standard_gaps: (Array.isArray(parsed.standard_gaps) ? parsed.standard_gaps : []).map((s) => String(s).trim()).filter(Boolean),
        };
        // Supervisor scoring pass (single pass — review is advisory, no
        // write gate, so no iteration loop).
        const supOut = await realGenerateText({
          model,
          prompt: buildSupervisorPrompt(dir, changes, scan.diagnostics_summary, gaps, threshold),
        });
        const review = parseSupervisorJson(supOut.text);
        if (!review) throw new Error('unparseable supervisor response');
        reviews.push({
          dir: dir === '' ? '.' : dir,
          score: review.score,
          approved: review.score >= threshold,
          issues: review.issues || [],
          ...changes,
        });
      } catch (err) {
        errors.push(`AI call failed for ${dir === '' ? '.' : dir}: ${err.message}`);
      }
    }

    result.ai = {
      enabled: true,
      skipped: false,
      provider: meta,
      threshold,
      max_iterations: maxIterations,
      errors,
      boundaries: reviews,
    };
    // Overall verdict: weakest link wins (min boundary score).
    const scores = reviews.map((r) => r.score).filter((s) => Number.isFinite(s));
    result.score = scores.length ? Math.min(...scores) : null;
    result.approved = scores.length ? Math.min(...scores) >= threshold : null;

    if (ctx.opts.json) return { result };
    return { text: renderText(result) };
  },
};

/** Plain-text rendering of a review result (deterministic). */
function renderText(result) {
  const lines = [];
  lines.push(`ACC review — ${result.scope === null ? 'whole repository' : result.scope}`);
  const d = result.diagnostics;
  lines.push(`Scan: ${d.total} diagnostics (${d.errors} errors, ${d.warnings} warnings, ${d.infos} infos) · ${result.dependency_gaps.length} dependency gap(s)`);
  if (result.ai.enabled && result.ai.errors && result.ai.errors.length) {
    lines.push('AI: enabled — errors:');
    for (const e of result.ai.errors) lines.push(`  ✗ ${e}`);
    return lines.join('\n') + '\n';
  }
  if (!result.ai.enabled) {
    lines.push('AI: disabled — deterministic scan only (set ai.enabled: true for a scored review)');
    return lines.join('\n') + '\n';
  }
  const p = result.ai.provider;
  lines.push(`AI: ${p.provider} / ${p.model} (id: ${p.id}) · threshold ${result.ai.threshold}`);
  for (const b of result.ai.boundaries) {
    lines.push('');
    lines.push(`  ${b.dir} — ${b.score}/${result.ai.threshold}${b.approved ? ' ✓ approved' : ' ✗ below threshold'}`);
    if (b.issues.length) {
      lines.push('    supervisor issues:');
      for (const i of b.issues) lines.push(`      - ${i}`);
    }
    if (b.drift.length) lines.push(`    drift: ${b.drift.length}`);
    if (b.knowledge.length) lines.push(`    knowledge: ${b.knowledge.length}`);
    if (b.skill_gaps.length) lines.push(`    skill gaps: ${b.skill_gaps.join(', ')}`);
    if (b.standard_gaps.length) lines.push(`    standard gaps: ${b.standard_gaps.join(', ')}`);
  }
  lines.push('');
  if (result.score !== null) {
    lines.push(`Overall: ${result.score}/${result.ai.threshold} — ${result.approved ? 'COMPLIANT' : 'NOT COMPLIANT'}`);
  } else {
    lines.push('Overall: no boundaries reviewed');
  }
  return lines.join('\n') + '\n';
}
