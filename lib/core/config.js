/**
 * Project root detection and `.acc/config/config.yaml` loading.
 *
 * The config file is optional. When absent or malformed, ACC degrades to
 * sensible defaults (the framework never requires configuration).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('./yaml');
const { loadEnv } = require('./envfile');
const { detectProjectRoot } = require('./util');

const CONFIG_PATH = '.acc/config/config.yaml';
// CLI-managed AI providers (`acc ai add/remove/default`). Kept in a
// separate file so the human-written config.yaml (comments and all) is
// never rewritten. Loaded on top of config.yaml — CLI wins.
const AI_CONFIG_PATH = '.acc/config/ai.yaml';

const DEFAULTS = {
  schema_version: 1,
  language_analyzers: { rust: true, typescript: true, go: true, python: true },
  ignore: [],
  diagnostics: { warn_only: [] },
  ownership: { strict: false },
  multi_agent: {
    enabled: false,
    max_concurrency: 4,
    max_depth: 1,
    task_timeout: 300,
    isolation_mode: 'git_worktree',
    conflict_policy: 'sequentialize',
  },
  tools: { auto_discover: true },
  context: { default_depth: 1, default_max_bytes: 65536, default_include: null },
  graph: { default_format: 'json', default_provenance: true },
  memory: { warn_bytes: 65536, timestamp_format: 'rfc3339' },
  discover: {
    default_kinds: ['missing-contract', 'missing-dependency', 'stale-dependency', 'unknown-owner', 'orphan-code'],
  },
  // Forbidden dependency rules: [{ from, to }] — a declared or
  // discovered edge under both prefixes emits ACC024. A rule that never
  // matches is inert (ACC025); a rule naming a missing path is ACC065.
  forbidden_deps: [],
  // AI configuration (AI SDK v5). Core ACC stays offline and
  // deterministic — AI is explicit opt-in, never required.
  ai: {
    enabled: false,
    default: null,
    providers: [],
  },
  // Engine trigger: how much change the engine waits for before running
  // the (token-consuming) AI phase. Default: 3 commits since the last
  // triggered run. mode: commits | changes | always.
  engine: {
    trigger: {
      mode: 'commits',
      threshold: 3,
    },
    // Supervisor: a second AI pass that scores the engine's proposed
    // changes against the rules and compliance before anything is
    // written. `threshold` is the minimum approval score (0-100) the
    // changes must reach; below it, the engine iterates on its own
    // proposals until compliant or max_iterations is hit.
    supervisor: {
      enabled: false,
      threshold: 85,
      max_iterations: 3,
    },
    // AI resilience: how the engine's AI phase handles failing
    // providers. `retries` is the number of attempts per provider call
    // before giving up on it; `fallback` tries the next configured
    // provider when one fails; `retry_delay_ms` is the pause between
    // attempts. `max_consecutive_failures` stops `acc engine --watch`
    // with a clear error after that many consecutive runs where every
    // provider was exhausted.
    ai: {
      retries: 3,
      retry_delay_ms: 1000,
      fallback: true,
      max_consecutive_failures: 3,
    },
  },
};

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function mergeDeep(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = mergeDeep(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Load the ACC configuration for a project root.
 * Returns { root, config, configPath, configPresent, configValid, error }.
 */
function load(root) {
  // API keys live in the project's .env (gitignored), never in the
  // config file. Load it so ai.api_key_env resolves from the file.
  loadEnv(root);
  const configPath = path.join(root, CONFIG_PATH);
  let config = { ...DEFAULTS, ignore: [...DEFAULTS.ignore] };
  let configPresent = false;
  let configValid = true;
  let error = null;

  if (fs.existsSync(configPath)) {
    configPresent = true;
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = yaml.parse(raw);
      if (parsed) {
        config = mergeDeep(config, pick(parsed, Object.keys(DEFAULTS)));
        if (!Array.isArray(config.ignore)) config.ignore = [];
        if (!Array.isArray(config.ai.providers)) config.ai.providers = [];
        if (!Array.isArray(config.forbidden_deps)) config.forbidden_deps = [];
        config.warn_only = config.diagnostics?.warn_only || [];
      }
    } catch (err) {
      configValid = false;
      error = err.message;
    }
  }

  // Merge the CLI-managed AI control file (acc ai add/remove/default)
  // on top of config.yaml — CLI-managed providers win.
  const aiPath = path.join(root, AI_CONFIG_PATH);
  if (fs.existsSync(aiPath)) {
    try {
      const aiParsed = yaml.parse(fs.readFileSync(aiPath, 'utf8'));
      if (aiParsed && aiParsed.ai) {
        config = mergeDeep(config, { ai: aiParsed.ai });
        if (!Array.isArray(config.ai.providers)) config.ai.providers = [];
      }
    } catch (err) {
      if (configValid) {
        configValid = false;
        error = err.message;
      }
    }
  }

  return { root, config, configPath, configPresent, configValid, error };
}

/** Resolve the project root: --root flag wins, otherwise detect upward. */
function resolveRoot(flag) {
  return flag ? path.resolve(flag) : detectProjectRoot(process.cwd());
}

module.exports = { load, resolveRoot, CONFIG_PATH, AI_CONFIG_PATH, DEFAULTS };
