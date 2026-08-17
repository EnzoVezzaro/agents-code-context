/**
 * AI configuration layer (AI SDK v5).
 *
 * ACC's core is offline, deterministic, and language-agnostic — the
 * automatic graph never needs an LLM. But the repository config can
 * declare one or more AI providers (`ai:` section of
 * `.acc/config/config.yaml`); commands that need a model resolve them
 * through `getModel()`. AI is explicit opt-in:
 *
 *   - `ai.enabled` defaults to `false`. Nothing loads, nothing runs.
 *   - Provider packages are required lazily, only when a model is
 *     actually requested.
 *   - API keys are read from environment variables at request time and
 *     are never stored in the repository.
 *   - No network call happens at config, graph, or list time — only
 *     when a command explicitly invokes the model.
 *
 * Config shape (per provider): id, provider (openai | anthropic |
 * google | npm package name), model, api_key_env (optional), base_url
 * (optional).
 */
'use strict';

/** Built-in provider → AI SDK v5 provider package. */
const KNOWN_PROVIDERS = {
  openai: '@ai-sdk/openai',
  anthropic: '@ai-sdk/anthropic',
  google: '@ai-sdk/google',
};

/**
 * Known provider catalog for `acc ai add` — the CLI-managed setup flow:
 * select provider → api key → model. Each entry knows its AI SDK v5
 * package, default base_url, the models-list endpoint (used to load
 * available models dynamically) and a sensible default model.
 * Custom providers are supported too: any AI SDK v5 package name with a
 * base_url and an explicit model.
 */
const PROVIDER_CATALOG = {
  openai: {
    label: 'OpenAI',
    package: '@ai-sdk/openai',
    provider: 'openai',
    base_url: null,
    models_url: 'https://api.openai.com/v1/models',
    default_model: 'gpt-4o',
    api_key_hint: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic',
    package: '@ai-sdk/anthropic',
    provider: 'anthropic',
    base_url: null,
    models_url: 'https://api.anthropic.com/v1/models',
    default_model: 'claude-sonnet-4-5',
    api_key_hint: 'sk-ant-...',
  },
  google: {
    label: 'Google',
    package: '@ai-sdk/google',
    provider: 'google',
    base_url: null,
    models_url: 'https://generativelanguage.googleapis.com/v1beta/models',
    default_model: 'gemini-2.0-flash',
    api_key_hint: 'AIza...',
  },
  openrouter: {
    label: 'OpenRouter',
    package: '@ai-sdk/openai',
    provider: 'openai',
    base_url: 'https://openrouter.ai/api/v1',
    models_url: 'https://openrouter.ai/api/v1/models',
    default_model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    api_key_hint: 'sk-or-v1-...',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    package: '@ai-sdk/openai',
    provider: 'openai',
    base_url: 'https://integrate.api.nvidia.com/v1',
    models_url: 'https://integrate.api.nvidia.com/v1/models',
    default_model: 'nvidia/nemotron-3-nano-30b-a3b',
    api_key_hint: 'nvapi-...',
  },
  groq: {
    label: 'Groq',
    package: '@ai-sdk/openai',
    provider: 'openai',
    base_url: 'https://api.groq.com/openai/v1',
    models_url: 'https://api.groq.com/openai/v1/models',
    default_model: 'llama-3.3-70b-versatile',
    api_key_hint: 'gsk_...',
  },
  together: {
    label: 'Together AI',
    package: '@ai-sdk/openai',
    provider: 'openai',
    base_url: 'https://api.together.xyz/v1',
    models_url: 'https://api.together.xyz/v1/models',
    default_model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    api_key_hint: '...',
  },
};

/** Default API-key env var for a provider id (ACC_<ID>_KEY). */
function envVarFor(id) {
  return 'ACC_' + String(id).toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_KEY';
}

/**
 * Load available models for a provider from its models endpoint.
 * Network call — only used by `acc ai models` / `acc ai add --select`
 * when the developer explicitly asks. Returns sorted model ids; throws
 * with a readable message on failure. Never called at config/scan time.
 */
async function listModels(providerId, apiKey, baseUrl) {
  const catalog = PROVIDER_CATALOG[providerId];
  if (!catalog) {
    throw new Error(
      `no known models endpoint for provider '${providerId}' — pass --model explicitly`,
    );
  }
  const url = baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}/models` : catalog.models_url;
  const headers = { Accept: 'application/json' };
  if (providerId === 'google') {
    // Google auth is a query param, not a bearer header.
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const fullUrl = providerId === 'google' && apiKey ? `${url}?key=${encodeURIComponent(apiKey)}` : url;
  let res;
  try {
    res = await fetch(fullUrl, { headers, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error(`cannot reach models endpoint for '${providerId}': ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`models endpoint for '${providerId}' returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const raw = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : data.data && data.data.models ? data.data.models : [];
  const ids = raw
    .map((m) => (typeof m === 'string' ? m : m && m.id))
    .filter((id) => typeof id === 'string' && id)
    .sort();
  if (!ids.length) throw new Error(`no models returned for '${providerId}'`);
  return ids;
}

/**
 * Resolve configured providers into descriptors. Pure and offline:
 * resolves the package (no execution) and checks the env var name, but
 * never loads a provider package or contacts a network.
 * Returns [{ id, provider, package, model, api_key_env, base_url,
 *            has_api_key, installed, errors }].
 */
function providersOf(config) {
  const ai = config.ai || {};
  const list = Array.isArray(ai.providers) ? ai.providers : [];
  const out = [];
  for (const p of list) {
    const pkg = KNOWN_PROVIDERS[p.provider] || p.provider || '';
    const errors = [];
    if (!p.id) errors.push('missing id');
    if (!p.model) errors.push('missing model');
    if (!KNOWN_PROVIDERS[p.provider] && !pkg.startsWith('@')) {
      errors.push(`unknown provider '${p.provider}' (expected openai | anthropic | google | <npm package>)`);
    }
    out.push({
      id: p.id,
      provider: p.provider,
      package: pkg,
      model: p.model,
      api_key_env: p.api_key_env || null,
      base_url: p.base_url || null,
      has_api_key: p.api_key_env ? !!process.env[p.api_key_env] : true,
      installed: pkg ? packageInstalled(pkg) : false,
      errors,
    });
  }
  return out;
}

/**
 * Resolve an AI SDK v5 model instance for a configured provider.
 * Returns { model, meta } or { error } — never throws for
 * configuration problems.
 */
function getModel(config, providerId) {
  const ai = config.ai || {};
  if (!ai.enabled) {
    return { error: 'AI is disabled — set ai.enabled: true in .acc/config/config.yaml' };
  }
  const list = providersOf(config);
  if (list.length === 0) {
    return { error: 'no AI providers configured in .acc/config/config.yaml (ai.providers)' };
  }
  const wanted = providerId || ai.default || list[0].id;
  const entry = list.find((p) => p.id === wanted);
  if (!entry) {
    return { error: `no AI provider configured with id '${wanted}'` };
  }
  if (entry.errors.length) {
    return { error: `invalid AI provider '${wanted}': ${entry.errors.join('; ')}` };
  }
  if (!entry.installed) {
    return { error: `provider package '${entry.package}' is not installed — install it to use provider '${wanted}'` };
  }
  if (!entry.has_api_key) {
    return { error: `missing API key for provider '${wanted}': set ${entry.api_key_env}` };
  }
  try {
    const mod = require(entry.package);
    const exportName = entry.provider.split('/').pop();
    // AI SDK v5: provider-level settings (apiKey/baseURL) belong on the
    // create* factory (createOpenAI / createAnthropic / ...), not on the
    // model call. Fall back to the named export for custom packages.
    // Provider-level settings (apiKey/baseURL) belong on the create*
    // factory, whose name is NOT uniform across providers
    // (createOpenAI, createAnthropic, createGoogleGenerativeAI).
    const CREATE_FACTORIES = {
      openai: 'createOpenAI',
      anthropic: 'createAnthropic',
      google: 'createGoogleGenerativeAI',
    };
    const createName =
      CREATE_FACTORIES[entry.provider] ||
      'create' + exportName.charAt(0).toUpperCase() + exportName.slice(1);
    const createFactory = mod[createName];
    const providerSettings = {};
    if (entry.base_url) providerSettings.baseURL = entry.base_url;
    if (entry.api_key_env) providerSettings.apiKey = process.env[entry.api_key_env];
    let provider;
    if (typeof createFactory === 'function') {
      provider = createFactory(providerSettings);
    } else {
      const factory = mod[exportName];
      if (typeof factory !== 'function') {
        return { error: `package '${entry.package}' does not export a '${exportName}' or '${createName}' factory` };
      }
      provider = factory;
    }
    // OpenAI-compatible custom endpoints (base_url set) expose
    // /chat/completions, not the OpenAI responses API → use the chat
    // model. Plain OpenAI keeps the default responses API.
    let model;
    if (entry.provider === 'openai' && entry.base_url && typeof provider.chat === 'function') {
      model = provider.chat(entry.model);
    } else {
      model = provider(entry.model);
    }
    return {
      model,
      meta: { id: entry.id, provider: entry.provider, model: entry.model, package: entry.package },
    };
  } catch (err) {
    return { error: `failed to load AI provider '${wanted}': ${err.message}` };
  }
}

/** Resolve a package path without executing it. */
function packageInstalled(name) {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

module.exports = { providersOf, getModel, listModels, envVarFor, KNOWN_PROVIDERS, PROVIDER_CATALOG };
