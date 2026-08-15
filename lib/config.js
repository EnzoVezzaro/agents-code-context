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
const { detectProjectRoot } = require('./util');

const CONFIG_PATH = '.acc/config/config.yaml';

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
  context: { default_depth: 1, default_max_bytes: 65536 },
  graph: { default_format: 'text', default_provenance: true },
  memory: { warn_bytes: 65536, timestamp_format: 'rfc3339' },
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
        config.warn_only = config.diagnostics?.warn_only || [];
      }
    } catch (err) {
      configValid = false;
      error = err.message;
    }
  }

  return { root, config, configPath, configPresent, configValid, error };
}

/** Resolve the project root: --root flag wins, otherwise detect upward. */
function resolveRoot(flag) {
  return flag ? path.resolve(flag) : detectProjectRoot(process.cwd());
}

module.exports = { load, resolveRoot, CONFIG_PATH, DEFAULTS };
