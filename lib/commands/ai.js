/**
 * `acc ai` — CLI-managed AI provider setup (AI SDK v5).
 *
 * Subcommands:
 *   acc ai                          → list configured providers
 *   acc ai add [--provider <id>] [--api-key <key>] [--model <model>]
 *            [--id <id>] [--base-url <url>] [--yes]
 *   acc ai remove <id>
 *   acc ai default <id>
 *   acc ai models [provider-id]     → load available models dynamically
 *
 * The setup flow is: select provider → api key → model. Interactively
 * (no flags) it walks those three steps; with flags it is fully
 * deterministic. Keys are stored in the project's `.env` (gitignored)
 * under `ACC_<ID>_KEY` and referenced from the CLI-managed provider
 * control file `.acc/config/ai.yaml` (loaded on top of config.yaml).
 * The human-written config.yaml is never rewritten.
 *
 * Deterministic: same flags + same input = same file contents. The only
 * network call is `models` / `add --select`, explicitly requested.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { providersOf, listModels, envVarFor, PROVIDER_CATALOG } = require('../core/ai');
const { load, AI_CONFIG_PATH } = require('../core/config');
const yaml = require('../core/yaml');
const { writeEnv, removeEnvKeys } = require('../core/envfile');

function loadAiFile(root) {
  const file = path.join(root, AI_CONFIG_PATH);
  try {
    const parsed = yaml.parse(fs.readFileSync(file, 'utf8'));
    const ai = (parsed && parsed.ai) || {};
    if (!Array.isArray(ai.providers)) ai.providers = [];
    return { file, ai };
  } catch {
    return { file, ai: { providers: [] } };
  }
}

function saveAiFile(root, ai) {
  const file = path.join(root, AI_CONFIG_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Adding a provider enables AI (the user just set one up); removing
  // the last provider disables it. Explicit enabled: false is respected.
  const enabled = ai.providers.length ? ai.enabled !== false : false;
  const doc = { ai: { enabled, providers: ai.providers || [] } };
  if (ai.default) doc.ai.default = ai.default;
  fs.writeFileSync(file, yaml.serialize(doc).join('\n') + '\n');
  return file;
}

/** Ask one question on the terminal (interactive only). */
function ask(question, { echo = true } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Pick from a numbered list; returns the chosen index. */
async function choose(label, options) {
  console.log(label);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
  for (;;) {
    const raw = await ask('Enter a number: ');
    const n = parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
    console.log('Invalid choice — try again.');
  }
}

async function cmdList(ctx) {
  const ai = ctx.config.ai || {};
  const providers = providersOf(ctx.config);
  const result = {
    enabled: !!ai.enabled,
    default: ai.default || null,
    providers: providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      package: p.package,
      model: p.model,
      api_key_env: p.api_key_env,
      api_key_present: p.has_api_key,
      installed: p.installed,
      errors: p.errors,
    })),
  };
  if (ctx.opts.json) return { result };

  const lines = [];
  lines.push(`AI: ${result.enabled ? 'enabled' : 'disabled (set ai.enabled: true to use AI)'}`);
  if (result.default) lines.push(`Default: ${result.default}`);
  if (!providers.length) {
    lines.push('No AI providers configured.');
    lines.push('Run `acc ai add` to set one up: select provider → api key → model.');
  }
  for (const p of providers) {
    const status = p.errors.length
      ? `invalid (${p.errors.join('; ')})`
      : !p.installed
        ? `package '${p.package}' not installed`
        : p.api_key_env && !p.has_api_key
          ? `missing API key (${p.api_key_env})`
          : 'ready';
    lines.push(`  ${p.id}: ${p.provider} / ${p.model} — ${status}`);
  }
  return { text: lines.join('\n') + '\n' };
}

async function cmdAdd(argv, ctx) {
  const { values, positionals } = argv;
  let providerId = values['--provider'] || null;
  let apiKey = values['--api-key'] || null;
  let model = values['--model'] || null;
  let id = values['--id'] || null;
  let baseUrl = values['--base-url'] || null;

  // 1. Select provider.
  const catalogIds = Object.keys(PROVIDER_CATALOG).sort();
  if (!providerId) {
    const idx = await choose('Select a provider:', catalogIds.map((c) => `${c} — ${PROVIDER_CATALOG[c].label}`));
    providerId = catalogIds[idx];
  }
  const catalog = PROVIDER_CATALOG[providerId] || null;
  if (!catalog && !baseUrl) {
    return { error: `unknown provider '${providerId}' — known: ${catalogIds.join(', ')} (or pass --base-url for a custom endpoint)`, exit: 2 };
  }
  if (!id) id = providerId;
  const envVar = envVarFor(id);
  if (!apiKey && process.env[envVar]) apiKey = process.env[envVar];
  if (!apiKey && values['--yes'] !== undefined) {
    return { error: `missing --api-key (stored as ${envVar} in .env)`, exit: 2 };
  }

  // 2. API key.
  if (!apiKey) {
    const hint = catalog ? ` (${catalog.api_key_hint})` : '';
    apiKey = await ask(`API key for ${id}${hint}: `);
    if (!apiKey) return { error: 'API key required', exit: 2 };
  }

  // 3. Model — load dynamically when not given.
  if (!model && catalog && !values['--yes']) {
    try {
      const models = await listModels(providerId, apiKey, baseUrl || catalog.base_url);
      const shown = models.slice(0, 20);
      const idx = await choose(`Select a model for ${id} (${models.length} available):`, shown);
      model = shown[idx];
      if (models.length > shown.length) console.log(`(showing 20 of ${models.length} models — pass --model to pick any)`);
    } catch (err) {
      console.log(`Could not load models: ${err.message}`);
      model = await ask(`Model for ${id} (default: ${catalog.default_model}): `);
      if (!model) model = catalog.default_model;
    }
  }
  if (!model) model = catalog ? catalog.default_model : null;
  if (!model) return { error: 'missing --model', exit: 2 };

  // Write the key to .env and the provider to the CLI-managed ai.yaml.
  writeEnv(ctx.root, { [envVar]: apiKey });
  const { ai } = loadAiFile(ctx.root);
  const existing = (ai.providers || []).find((p) => p.id === id);
  const entry = {
    id,
    provider: catalog ? catalog.provider : (values['--provider'] || 'openai'),
    model,
    api_key_env: envVar,
  };
  if (catalog && catalog.base_url) entry.base_url = catalog.base_url;
  if (baseUrl) entry.base_url = baseUrl;
  if (existing) {
    ai.providers = ai.providers.map((p) => (p.id === id ? { ...p, ...entry } : p));
  } else {
    ai.providers = [...(ai.providers || []), entry];
  }
  const file = saveAiFile(ctx.root, ai);

  const result = {
    provider: entry,
    env_var: envVar,
    env_file: path.join(ctx.root, '.env'),
    control_file: file,
  };
  if (ctx.opts.json) return { result };

  const lines = [];
  lines.push(`Added provider '${id}': ${entry.provider} / ${entry.model}`);
  lines.push(`  API key stored in .env as ${envVar} (gitignored)`);
  lines.push(`  Provider saved to ${AI_CONFIG_PATH}`);
  lines.push(`Run 'acc ai' to verify, or 'acc engine' to use it.`);
  return { text: lines.join('\n') + '\n' };
}

async function cmdRemove(argv, ctx) {
  const { positionals } = argv;
  if (!positionals.length) return { error: 'missing provider id — usage: acc ai remove <id>', exit: 2 };
  const id = positionals[0];
  const { ai, file } = loadAiFile(ctx.root);
  const before = (ai.providers || []).length;
  ai.providers = (ai.providers || []).filter((p) => p.id !== id);
  if (ai.default === id) ai.default = null;
  if (ai.providers.length === before) {
    return { error: `no provider with id '${id}'`, exit: 1 };
  }
  saveAiFile(ctx.root, ai);
  const envVar = envVarFor(id);
  const { removed } = removeEnvKeys(ctx.root, [envVar]);
  const result = { removed: id, env_keys_removed: removed, control_file: file };
  if (ctx.opts.json) return { result };
  return { text: `Removed provider '${id}'.` + (removed.includes(envVar) ? ` Deleted ${envVar} from .env.` : '') + '\n' };
}

async function cmdDefault(argv, ctx) {
  const { positionals } = argv;
  if (!positionals.length) return { error: 'missing provider id — usage: acc ai default <id>', exit: 2 };
  const id = positionals[0];
  const { ai, file } = loadAiFile(ctx.root);
  if (!(ai.providers || []).some((p) => p.id === id)) {
    return { error: `no provider with id '${id}' — run 'acc ai add' first`, exit: 1 };
  }
  ai.default = id;
  saveAiFile(ctx.root, ai);
  const result = { default: id, control_file: file };
  if (ctx.opts.json) return { result };
  return { text: `Default provider set to '${id}'.` + '\n' };
}

async function cmdModels(argv, ctx) {
  const { values, positionals } = argv;
  const id = positionals[0] || values['--provider'] || (ctx.config.ai && ctx.config.ai.default) || null;
  if (!id) return { error: 'missing provider id — usage: acc ai models <provider-id>', exit: 2 };
  const entry = providersOf(ctx.config).find((p) => p.id === id);
  if (!entry) return { error: `no provider with id '${id}' — run 'acc ai add' first`, exit: 1 };
  if (!entry.has_api_key) return { error: `missing API key for '${id}' (${entry.api_key_env})`, exit: 1 };
  const ids = await listModels(id, process.env[entry.api_key_env], entry.base_url);
  const result = { provider: id, models: ids };
  if (ctx.opts.json) return { result };
  const lines = [`Models for ${id} (${ids.length}):`];
  for (const m of ids.slice(0, 30)) lines.push(`  ${m}`);
  if (ids.length > 30) lines.push(`  … and ${ids.length - 30} more`);
  return { text: lines.join('\n') + '\n' };
}

module.exports = {
  name: 'ai',
  summary: 'Manage AI providers (AI SDK v5): list, add (provider → key → model), remove, default, models',
  usage: 'acc ai [add|remove|default|models] [options]',
  booleans: ['--json', '--yes'],
  flags: {
    '--provider': { type: 'string' },
    '--api-key': { type: 'string' },
    '--model': { type: 'string' },
    '--id': { type: 'string' },
    '--base-url': { type: 'string' },
  },

  async run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    const sub = positionals[0];

    // Reload with the CLI-managed ai.yaml merged (ctx.config was loaded
    // at dispatch time — the ai.yaml is loaded in load(), so it is
    // already present; reload keeps state fresh after add/remove).
    const loaded = load(ctx.root);
    const liveCtx = { ...ctx, config: loaded.config, configValid: loaded.configValid, configError: loaded.error };

    if (!sub || sub === 'list') return cmdList(liveCtx);
    if (sub === 'add') return cmdAdd({ ...argv, positionals: positionals.slice(1) }, liveCtx);
    if (sub === 'remove') return cmdRemove({ ...argv, positionals: positionals.slice(1) }, liveCtx);
    if (sub === 'default') return cmdDefault({ ...argv, positionals: positionals.slice(1) }, liveCtx);
    if (sub === 'models') return cmdModels({ ...argv, positionals: positionals.slice(1) }, liveCtx);
    return { error: `unknown subcommand '${sub}' — usage: acc ai [add|remove|default|models]`, exit: 2 };
  },
};
