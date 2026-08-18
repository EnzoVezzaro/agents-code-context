/**
 * The ACC engine.
 *
 * The engine keeps the ACC files and knowledge of a repository in sync
 * with its changes, in two phases:
 *
 *   1. DETERMINISTIC (always, offline): derives the graph, runs the
 *      diagnostic scan, computes per-boundary graph slices, and reports
 *      the deterministic sync plan (missing contracts, discovered
 *      dependencies not yet declared). With --apply it performs that
 *      sync by reusing the CLI commands (`acc build`, `acc discover`)
 *      — additive only, never rewriting existing content.
 *
 *   2. AI (only when `ai.enabled` is true and a provider is configured):
 *      for each scoped boundary with a local contract, asks the model
 *      (AI SDK v5, via lib/ai.js getModel) to review the contract
 *      against the derived slice and produce durable knowledge entries
 *      and drift proposals. With --apply, knowledge entries are written
 *      to `.acc-memory.md` (gitignored, safe); contract rewrites and
 *      skill/standard gaps are always reported as proposals, never
 *      auto-applied to committed files.
 *
 * The engine output is deterministic whenever the AI phase is disabled
 * or skipped; AI results are advisory (provenance: memory/inferred).
 *
 * The AI phase is injectable for tests: pass `resolveModel` and
 * `generateText` to replace the network call with a fake.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph, graphSlice } = require('./graph');
const { check } = require('./diagnostics');
const { getModel } = require('./ai');
const { evaluateTrigger, persistTrigger } = require('./trigger');
const memory = require('./memory');
const buildCommand = require('../commands/build');
const discoverCommand = require('../commands/discover');
const { buildWarnFile, writeWarnFile, warnSummary, WARN_FILE } = require('./warnfile');
const { readUtf8, cmp } = require('./util');

const MAX_CONTRACT_CHARS = 4000;
const MAX_SLICE_CHARS = 1500;
const MAX_CHANGED_FILES = 10;
const MAX_CODE_CHARS = 6000;
const MAX_KNOWLEDGE_ENTRIES = 5;
const AI_TIMEOUT_MS = 45000;
const DEFAULT_SUPERVISOR_THRESHOLD = 85;
const DEFAULT_SUPERVISOR_MAX_ITERATIONS = 3;
const DEFAULT_AI_RETRIES = 3;
const DEFAULT_AI_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Run the engine.
 * opts: { root, config, configPresent, configValid, configError,
 *         apply, scope, modelId, resolveModel, generateText }
 * Returns { scan, sync, ai } — all deterministic except ai.results
 * (which are advisory, provenance memory/inferred).
 */
async function runEngine(opts) {
  const {
    root,
    config,
    configPresent = false,
    configValid = true,
    configError = null,
    apply = false,
    scope = null,
    modelId = null,
    force = false,
    supervisor = false,
  } = opts;
  const resolveModel = opts.resolveModel || getModel;
  const generate = opts.generateText || realGenerateText;

  const scan = buildScan(root, config, { configPresent, configValid, configError }, scope);
  const sync = await buildSyncPlan(root, config, scan, { apply, scope });
  // Trigger gates the token-consuming AI phase (default: 3 commits) and
  // exposes the changed files the AI must evaluate.
  const trigger = evaluateTrigger(root, config, { force });
  const ai = await runAiPhase(root, config, scan, { apply, scope, modelId, resolveModel, generate, trigger, supervisor });
  // Persist the baseline only after a triggered AI run, so the count
  // restarts (never after a skipped run).
  if (ai.enabled && !ai.skipped) persistTrigger(root, trigger);
  // The drift report is regenerated on EVERY run so the developer always
  // sees the current state in the project root (ACC_WARN.md, gitignored).
  const warnReport = buildWarnFile({ scan, ai, sync });
  writeWarnFile(root, warnReport);
  const warn = warnSummary(scan, ai);
  return { scan, sync, trigger, ai, warn };
}

/* ------------------------------------------------------------------ */
/* 1. Deterministic scan                                              */
/* ------------------------------------------------------------------ */

function buildScan(root, config, meta, scope) {
  const graph = buildGraph(root, config);
  const diags = check(root, config, meta);

  const stats = {
    boundaries: graph.nodes.length,
    files: graph.items.filter((n) => n.type === 'file').length,
    tests: graph.items.filter((n) => n.type === 'test').length,
    skills: graph.items.filter((n) => n.type === 'skill').length,
    standards: graph.items.filter((n) => n.type === 'standard').length,
    edges_declared: graph.edges.filter((e) => e.provenance.kind === 'declared').length,
    edges_discovered: graph.edges.filter((e) => e.provenance.kind === 'discovered').length,
    links: graph.links.length,
    cycles: graph.cycles.length,
  };

  const inScope = (id) => !scope || id === scope || id.startsWith(scope + '/');

  const slices = graph.nodes
    .filter((n) => n.has_local_contract && inScope(n.id))
    .map((n) => graphSlice(graph, n.id === '' ? '.' : n.id))
    .sort((a, b) => cmp(a.scope, b.scope));

  // Deterministic dependency gaps: discovered edges with no declared
  // counterpart (a declared dep on a parent covers its children).
  const declaredPairs = new Set(
    graph.edges
      .filter((e) => e.kind === 'dependency' && e.provenance.kind === 'declared')
      .map((e) => `${e.from}\u0000${e.to}`),
  );
  const covers = (from, to) => {
    let t = to;
    for (;;) {
      if (declaredPairs.has(`${from}\u0000${t}`)) return true;
      if (!t.includes('/')) break;
      t = t.slice(0, t.lastIndexOf('/'));
    }
    return false;
  };
  const dependency_gaps = graph.edges
    .filter((e) => e.kind === 'dependency' && e.provenance.kind === 'discovered' && inScope(e.from))
    .filter((e) => !covers(e.from, e.to))
    .map((e) => ({
      from: e.from === '' ? '.' : e.from,
      to: e.to === '' ? '.' : e.to,
      source: e.provenance.source,
    }))
    .sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));

  // Docs-ahead drift: declared dependency edges that no code references
  // (the documentation promises something the code no longer does). The graph
  // exposes the code-backed pairs (including references to
  // sub-boundaries); declared facts still win in the graph, this is a
  // drift signal for ACC_WARN.md, not an assertion.
  const backed = new Set((graph.codeBacked || []).map((p) => `${p.from}\u0000${p.to}`));
  const stale_declarations = graph.edges
    .filter((e) => e.kind === 'dependency' && e.provenance.kind === 'declared' && inScope(e.from))
    .filter((e) => !backed.has(`${e.from}\u0000${e.to}`))
    .map((e) => ({
      from: e.from === '' ? '.' : e.from,
      to: e.to === '' ? '.' : e.to,
      source: e.provenance.source,
    }))
    .sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));

  const summary = {
    errors: diags.filter((d) => d.severity === 'error').length,
    warnings: diags.filter((d) => d.severity === 'warn').length,
    infos: diags.filter((d) => d.severity === 'info').length,
    total: diags.length,
  };

  return { stats, diagnostics: diags, diagnostics_summary: summary, slices, dependency_gaps, stale_declarations, scope: scope || null };
}

/* ------------------------------------------------------------------ */
/* 2. Deterministic sync (reuses the CLI commands)                    */
/* ------------------------------------------------------------------ */

async function buildSyncPlan(root, config, scan, { apply, scope }) {
  // json: true → the command modules return their structured `result`.
  const ctx = { root, config, opts: { json: true, quiet: true } };
  const positionals = scope ? [scope] : [];

  const buildOutcome = buildCommand.run(
    { positionals, values: apply ? { '--yes': true } : {}, unknown: [], errors: [] },
    ctx,
  );
  // Sync is additive-only: create missing contracts and declare
  // discovered dependencies, but NEVER auto-remove declared facts
  // (stale-dependency) or inject placeholder owners (unknown-owner).
  // Declared facts win; removals are human decisions.
  const ADDITIVE_KINDS = 'missing-contract,missing-dependency,orphan-code';
  const discoverOutcome = discoverCommand.run(
    {
      positionals,
      values: apply ? { '--apply': true, '--yes': true, '--kind': ADDITIVE_KINDS } : { '--kind': ADDITIVE_KINDS },
      unknown: [],
      errors: [],
    },
    ctx,
  );

  return {
    applied: !!apply,
    contracts_missing: buildOutcome.result.missing,
    contracts_created: buildOutcome.result.created,
    memory_records_created: buildOutcome.result.memory_created,
    suggestions: discoverOutcome.result.suggestions.length,
    suggestions_applied: discoverOutcome.result.applied_count,
    dependency_gaps: scan.dependency_gaps,
  };
}

/* ------------------------------------------------------------------ */
/* 3. AI phase                                                        */
/* ------------------------------------------------------------------ */

async function runAiPhase(root, config, scan, { apply, scope, modelId, resolveModel, generate, trigger, supervisor }) {
  const ai = config.ai || {};
  if (!ai.enabled) return { enabled: false, skipped: false, results: [], applied: false, errors: [] };
  if (!trigger.triggered) {
    return {
      enabled: true,
      skipped: true,
      reason: trigger.reason,
      results: [],
      applied: false,
      errors: [],
    };
  }

  // Provider candidates in priority order (requested → default → config
  // order). All are resolved up front so a failing provider can fall
  // back to the next one — and every resolution problem is reported to
  // the developer instead of silently succeeding or failing.
  const engineAi = (config.engine && config.engine.ai) || {};
  const retries = Number.isInteger(engineAi.retries) && engineAi.retries >= 0 ? engineAi.retries : DEFAULT_AI_RETRIES;
  const retryDelayMs =
    Number.isFinite(engineAi.retry_delay_ms) && engineAi.retry_delay_ms >= 0
      ? engineAi.retry_delay_ms
      : DEFAULT_AI_RETRY_DELAY_MS;
  const fallback = engineAi.fallback !== false;

  const list = (ai.providers || []).map((p) => p && p.id).filter(Boolean);
  const wanted = modelId || ai.default || list[0];
  const orderedIds = [wanted, ...list.filter((id) => id !== wanted)];
  const candidates = [];
  const providerNotes = [];
  for (const id of orderedIds) {
    const r = resolveModel(config, id);
    if (r.error) {
      providerNotes.push({ id, error: r.error });
      continue;
    }
    candidates.push({ id, model: r.model, meta: r.meta });
  }
  if (!candidates.length) {
    return {
      enabled: true,
      skipped: false,
      provider: null,
      results: [],
      applied: apply,
      errors: providerNotes.map((n) => n.error),
    };
  }

  // Resolve supervisor-specific provider/model when configured separately.
  // Falls back to the engine's candidates when not set.
  const supCfgRaw = supervisor ? (config.engine && config.engine.supervisor) || {} : null;
  let supCandidates = null;
  if (supCfgRaw && (supCfgRaw.provider || supCfgRaw.model)) {
    const supId = supCfgRaw.provider || supCfgRaw.model;
    const supModelId = supCfgRaw.model || null;
    // Try resolving with the supervisor's provider id.
    const r = supModelId ? resolveModel(config, supId) : resolveModel(config, supId);
    if (!r.error) {
      supCandidates = [{ id: supId, model: r.model, meta: r.meta }];
    }
    // If model is specified separately, try to find it in providers list.
    if (supCfgRaw.model && supCfgRaw.provider) {
      const r2 = resolveModel(config, supCfgRaw.provider);
      if (!r2.error) {
        supCandidates = [{ id: supCfgRaw.provider, model: r2.model, meta: r2.meta }];
      }
    }
  }

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const retryLog = [];
  let usedProvider = null;
  // callModel: per-provider retries (engine.ai.retries) with a pause
  // between attempts, then falls back to the next configured provider.
  // Every failed attempt is recorded in retryLog and reported; the call
  // only throws when every provider is exhausted.
  const callModel = async (prompt) => {
    const usable = fallback ? candidates : candidates.slice(0, 1);
    const failures = [];
    for (const cand of usable) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const out = await generate({ model: cand.model, prompt });
          usedProvider = cand.meta;
          return { text: out.text };
        } catch (err) {
          const failure = { provider: cand.id, model: cand.meta.model, attempt: attempt + 1, error: err.message };
          failures.push(failure);
          retryLog.push(failure);
          if (attempt < retries && retryDelayMs > 0) await sleep(retryDelayMs);
        }
      }
    }
    const e = new Error(
      failures.map((f) => `${f.provider} (${f.model}) attempt ${f.attempt}: ${f.error}`).join(' | '),
    );
    throw e;
  };

  // callSupervisorModel: uses the supervisor's dedicated provider/model
  // when configured (engine.supervisor.provider/model). Falls back to
  // the engine's callModel when not configured.
  const callSupervisorModel = supCandidates
    ? async (prompt) => {
        const failures = [];
        for (const cand of supCandidates) {
          for (let attempt = 0; attempt <= retries; attempt++) {
            try {
              const out = await generate({ model: cand.model, prompt });
              return { text: out.text };
            } catch (err) {
              failures.push({ provider: cand.id, model: cand.meta.model, attempt: attempt + 1, error: err.message });
              if (attempt < retries && retryDelayMs > 0) await sleep(retryDelayMs);
            }
          }
        }
        throw new Error(
          failures.map((f) => `[supervisor] ${f.provider} (${f.model}) attempt ${f.attempt}: ${f.error}`).join(' | '),
        );
      }
    : callModel;

  const inScope = (id) => !scope || id === scope || id.startsWith(scope + '/');
  const boundaries = scan.slices.map((s) => (s.scope === '.' ? '' : s.scope)).filter(inScope);

  // The code the AI must evaluate: files that changed since the last
  // triggered run (trigger.changedFiles), narrowed to this run's scope.
  const changedFiles = (trigger.changedFiles || []).filter(inScope);

  const supCfg = supervisor ? (config.engine && config.engine.supervisor) || {} : null;
  const supThreshold =
    supCfg && Number.isFinite(supCfg.threshold) ? supCfg.threshold : DEFAULT_SUPERVISOR_THRESHOLD;
  const supMaxIter =
    supCfg && Number.isInteger(supCfg.max_iterations) && supCfg.max_iterations > 0
      ? supCfg.max_iterations
      : DEFAULT_SUPERVISOR_MAX_ITERATIONS;

  const results = [];
  const errors = [];
  const iterations = [];
  let knowledgeWritten = 0;

  for (const dir of boundaries) {
    const contractFile = dir === '' ? 'AGENTS.md' : path.posix.join(dir, 'AGENTS.md');
    const contractText = readUtf8(path.join(root, dir === '' ? '' : dir, 'AGENTS.md')) || '';
    const slice = scan.slices.find((s) => (s.scope === '.' ? '' : s.scope) === dir);
    const gaps = scan.dependency_gaps.filter((g) => (g.from === '.' ? '' : g.from) === dir);
    const dirChanged = changedFiles.filter((rel) => rel === contractFile || rel.startsWith(dir === '' ? '' : dir + '/'));

    let knowledge = [];
    let drift = [];
    let skillGaps = [];
    let standardGaps = [];
    let approved = null;
    const boundaryIterations = [];

    const runReview = async (feedback) => {
      const prompt = buildPrompt(dir, contractText, slice, gaps, dirChanged, root, feedback);
      const out = await callModel(prompt);
      const parsed = parseAiJson(out.text);
      if (!parsed) throw new Error('unparseable AI response');
      // Parse contract fill — the AI returns section content to replace
      // placeholder items in AGENTS.md.
      const rawContract = parsed.contract && typeof parsed.contract === 'object' ? parsed.contract : null;
      const contractFill = rawContract ? {
        purpose: String(rawContract.purpose || '').trim(),
        responsibilities: Array.isArray(rawContract.responsibilities) ? rawContract.responsibilities.map(String).map((s) => s.trim()).filter(Boolean) : [],
        ownership: String(rawContract.ownership || '').trim(),
        inputs: Array.isArray(rawContract.inputs) ? rawContract.inputs.map(String).map((s) => s.trim()).filter(Boolean) : [],
        outputs: Array.isArray(rawContract.outputs) ? rawContract.outputs.map(String).map((s) => s.trim()).filter(Boolean) : [],
        dependencies: Array.isArray(rawContract.dependencies) ? rawContract.dependencies.map(String).map((s) => s.trim()).filter(Boolean) : [],
        constraints: Array.isArray(rawContract.constraints) ? rawContract.constraints.map(String).map((s) => s.trim()).filter(Boolean) : [],
        architecture: String(rawContract.architecture || '').trim(),
      } : null;
      return {
        knowledge: (Array.isArray(parsed.knowledge) ? parsed.knowledge : [])
          .map((k) => String(k).trim())
          .filter((k) => k && k.length < 500)
          .slice(0, MAX_KNOWLEDGE_ENTRIES),
        drift: (Array.isArray(parsed.drift) ? parsed.drift : []).map((d) =>
          typeof d === 'string' ? { fact: d } : d,
        ),
        skill_gaps: (Array.isArray(parsed.skill_gaps) ? parsed.skill_gaps : []).map((s) => String(s).trim()).filter(Boolean),
        standard_gaps: (Array.isArray(parsed.standard_gaps) ? parsed.standard_gaps : []).map((s) => String(s).trim()).filter(Boolean),
        contract: contractFill,
      };
    };

    try {
      let current = await runReview(null);
      let review = null;

      if (supCfg) {
        for (let i = 0; i <= supMaxIter; i++) {
          const supOut = await callSupervisorModel(
            buildSupervisorPrompt(dir, current, scan.diagnostics_summary, gaps, supThreshold),
          );
          review = parseSupervisorJson(supOut.text);
          if (!review) throw new Error('unparseable supervisor response');
          boundaryIterations.push({
            iteration: i + 1,
            score: review.score,
            issues: review.issues || [],
            changes: { knowledge: current.knowledge.length, drift: current.drift.length },
          });
          approved = review.score >= supThreshold;
          if (approved) break;
          if (i === supMaxIter) break;
          current = await runReview((review.issues || []).join('\n'));
        }
      } else {
        approved = true;
      }

      knowledge = current.knowledge;
      drift = current.drift;
      skillGaps = current.skill_gaps;
      standardGaps = current.standard_gaps;
      const contractFill = current.contract;

      // Write durable knowledge only when the supervisor approved (or no
      // supervisor is configured). Never write rejected proposals.
      if (apply && approved) {
        for (const k of knowledge) {
          memory.add(root, dir, k);
          knowledgeWritten++;
        }
        // Write filled AGENTS.md contract when the AI provides section content.
        if (contractFill && (contractFill.purpose || contractFill.responsibilities.length)) {
          writeFilledContract(root, dir, contractText, contractFill);
        }
      }

      results.push({
        dir: dir === '' ? '.' : dir,
        knowledge,
        drift,
        skill_gaps: skillGaps,
        standard_gaps: standardGaps,
        supervisor: supCfg ? { enabled: true, approved, score: review ? review.score : null, issues: review ? review.issues || [] : [], iterations: boundaryIterations } : { enabled: false },
      });
    } catch (err) {
      errors.push(`AI call failed for ${dir === '' ? '.' : dir}: ${err.message}`);
      continue;
    }
  }

  return {
    enabled: true,
    skipped: false,
    provider: usedProvider || (candidates[0] && candidates[0].meta) || null,
    results,
    applied: apply,
    knowledge_written: knowledgeWritten,
    errors,
    changed_files: changedFiles,
    iterations,
    retry_log: retryLog,
    provider_notes: providerNotes,
    supervisor: supCfg ? { enabled: true, threshold: supThreshold, max_iterations: supMaxIter } : { enabled: false },
  };
}

/** Read changed source files (budgeted) for the AI to evaluate. */
function readChangedCode(root, rels) {
  const out = [];
  let budget = MAX_CODE_CHARS;
  for (const rel of rels.slice(0, MAX_CHANGED_FILES)) {
    const text = readUtf8(path.join(root, rel));
    if (text === null) continue;
    const piece = text.slice(0, Math.min(budget, text.length));
    if (!piece.trim()) continue;
    out.push(`--- ${rel} ---\n${piece}`);
    budget -= piece.length;
    if (budget <= 0) break;
  }
  return out;
}

function buildPrompt(dir, contractText, slice, gaps, changedFiles, root, feedback) {
  const contract = (contractText || '').slice(0, MAX_CONTRACT_CHARS);
  const sliceJson = JSON.stringify(slice).slice(0, MAX_SLICE_CHARS);
  const gapList = gaps.map((g) => `${g.from} → ${g.to}`).join(', ') || '(none)';
  const code = readChangedCode(root, changedFiles || []);
  const lines = [
    `You are the ACC engine. Keep the ACC files of this repository in sync with its code.`,
    `Boundary: ${dir === '' ? '(project root)' : dir}`,
    ``,
    `AGENTS.md contract:`,
    contract,
    ``,
    `Derived graph slice (machine-generated index, relationships only):`,
    sliceJson,
    ``,
    `Discovered-but-undeclared dependencies: ${gapList}`,
  ];
  if (code.length) {
    lines.push('', `Changed code to evaluate (source of truth — base your review on this):`, '', ...code);
  } else {
    lines.push('', 'No changed files in this boundary — review the contract against the derived slice.');
  }
  if (feedback) {
    lines.push('', `Supervisor feedback — address every point and re-emit the JSON:`, '', feedback);
  }
  lines.push(
    '',
    `Respond with ONLY a single JSON object (no markdown, no prose) with these keys:`,
    `- "contract": object with keys: purpose (one sentence), responsibilities (array of 2-5 strings), ownership (string), inputs (array of strings), outputs (array of strings), dependencies (array of path strings), constraints (array of strings), architecture (2-3 sentence prose). Fill each based on the codebase — replace any placeholder text with real facts.`,
    `- "drift": array of { "fact": string, "evidence": string } — contract statements that no longer match the code`,
    `- "knowledge": array of short strings — durable lessons worth recording in .acc-memory.md (gotchas, invariants, design notes). Max 5.`,
    `- "skill_gaps": array of strings — reusable capability names this boundary lacks`,
    `- "standard_gaps": array of strings — standard names this boundary should follow`,
    `Never invent facts. If a section has nothing to report, use an empty array or empty string.`,
  );
  return lines.join('\n');
}

/** Supervisor prompt: score the engine's proposals against ACC rules. */
function buildSupervisorPrompt(dir, changes, diagSummary, gaps, threshold) {
  return [
    `You are the ACC supervisor. Score the engine's proposed changes for correctness and compliance with ACC rules.`,
    `Boundary: ${dir === '' ? '(project root)' : dir}`,
    ``,
    `Proposed changes:`,
    JSON.stringify(changes, null, 2).slice(0, 4000),
    ``,
    `Current diagnostics: ${diagSummary.total} total (${diagSummary.errors} errors, ${diagSummary.warnings} warnings, ${diagSummary.infos} infos)`,
    `Discovered-but-undeclared dependencies: ${gaps.map((g) => `${g.from} → ${g.to}`).join(', ') || '(none)'}`,
    ``,
    `Rules to enforce:`,
    `- Declared facts win over discovered facts; never assert inferred facts as authoritative.`,
    `- Never invent facts: every drift/evidence must reference real repository files or relationships.`,
    `- Knowledge entries must be durable, specific lessons — no generic filler, max 5.`,
    `- Proposals must not contradict the repository's own AGENTS.md constraints.`,
    `- A discovered dependency that is not declared is a drift item, not a knowledge entry.`,
    ``,
    `Respond with ONLY a JSON object: { "score": number 0-100, "issues": [string] }.`,
    `A score >= ${threshold} means the changes are approved for writing.`,
  ].join('\n');
}

/** Parse the supervisor's { score, issues } JSON. */
function parseSupervisorJson(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const score = Number(obj.score);
    if (!Number.isFinite(score)) return null;
    return { score, issues: Array.isArray(obj.issues) ? obj.issues.map(String) : [] };
  } catch {
    return null;
  }
}

/** Tolerant JSON extraction from an LLM response (strips markdown fences). */
function parseAiJson(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Real AI SDK v5 generateText with a timeout. */
async function realGenerateText({ model, prompt }) {
  const { generateText } = require('ai');
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI call timed out after ${AI_TIMEOUT_MS / 1000}s`)), AI_TIMEOUT_MS);
  });
  try {
    // Force JSON output for OpenAI-compatible providers (NVIDIA, OpenRouter,
    // Groq, Together, etc.) so the model returns structured data instead of
    // freeform text. Anthropic and Google handle JSON mode differently.
    const result = await Promise.race([
      generateText({
        model,
        prompt,
        providerOptions: {
          openai: { responseFormat: { type: 'json_object' } },
        },
      }),
      timeout,
    ]);
    return { text: result.text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Write a filled AGENTS.md contract from AI-generated section content.
 * Replaces placeholder lines (e.g. "<Responsibility 1>") with real facts.
 * Only touches sections where the AI provided non-empty content.
 */
function writeFilledContract(root, dir, contractText, fill) {
  const agentsPath = path.join(root, dir === '' ? '' : dir, 'AGENTS.md');
  const existing = readUtf8(agentsPath) || '';
  let lines = existing.split('\n');

  // Helper: replace the first placeholder line after a ## heading.
  const replaceSection = (heading, items) => {
    if (!items || !items.length) return;
    const idx = lines.findIndex((l) => l.trim() === heading);
    if (idx === -1) return;
    // Find the first placeholder or empty line after the heading.
    let insertAt = -1;
    for (let i = idx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('## ') || t.startsWith('---')) break;
      if (t.startsWith('- <') || t === '' || t.startsWith('- ')) {
        insertAt = i;
        break;
      }
    }
    if (insertAt === -1) return;
    // Remove existing placeholder lines after heading.
    let end = insertAt;
    while (end < lines.length && !lines[end].trim().startsWith('## ') && lines[end].trim() !== '---') end++;
    const newLines = items.map((item) => `- ${item}`);
    lines.splice(insertAt, end - insertAt, ...newLines);
  };

  // Helper: replace a single-line value after a heading.
  const replaceValue = (heading, value) => {
    if (!value) return;
    const idx = lines.findIndex((l) => l.trim() === heading);
    if (idx === -1) return;
    // Replace the next non-empty, non-heading line.
    for (let i = idx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('## ') || t.startsWith('---')) break;
      if (t && !t.startsWith('#')) {
        lines[i] = value;
        return;
      }
    }
  };

  // Replace the Purpose section (first non-heading line after ## Purpose).
  if (fill.purpose) {
    const idx = lines.findIndex((l) => l.trim() === '## Purpose');
    if (idx !== -1) {
      for (let i = idx + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.startsWith('## ') || t.startsWith('---')) break;
        if (t && !t.startsWith('#')) {
          lines[i] = fill.purpose;
          break;
        }
      }
    }
  }

  replaceSection('## Responsibilities', fill.responsibilities);
  replaceValue('## Ownership', fill.ownership || null);
  replaceSection('## Inputs', fill.inputs);
  replaceSection('## Outputs', fill.outputs);
  replaceSection('## Dependencies', fill.dependencies);
  replaceSection('## Constraints', fill.constraints);

  // Replace Architecture prose.
  if (fill.architecture) {
    const idx = lines.findIndex((l) => l.trim() === '## Architecture');
    if (idx !== -1) {
      // Find the placeholder or empty line(s) after heading.
      let start = -1;
      let end = lines.length;
      for (let i = idx + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.startsWith('## ') || t.startsWith('---')) { end = i; break; }
        if (t.startsWith('<') || t === '' || (!t.startsWith('#') && start === -1)) {
          if (start === -1) start = i;
        }
      }
      if (start !== -1) {
        lines.splice(start, end - start, fill.architecture);
      }
    }
  }

  fs.writeFileSync(agentsPath, lines.join('\n'));
}

module.exports = {
  runEngine,
  buildScan,
  buildPrompt,
  parseAiJson,
  parseSupervisorJson,
  buildSupervisorPrompt,
  readChangedCode,
  realGenerateText,
  DEFAULT_SUPERVISOR_THRESHOLD,
  DEFAULT_SUPERVISOR_MAX_ITERATIONS,
  DEFAULT_AI_RETRIES,
  DEFAULT_AI_RETRY_DELAY_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
};
