/**
 * `acc tools` — the capability manifest for external agents and
 * developers. Two explicit tiers keep the separation unambiguous:
 *
 *   - CLI tier (`tier: "cli"`): deterministic, offline, zero-intelligence.
 *     Same repo + same flags = byte-identical output. No network, no API
 *     keys, safe on untrusted repositories. Usable by any agent or
 *     developer directly.
 *   - Engine tier (`tier: "engine"`): the intelligence subsystem —
 *     `engine` (sync; AI phase requires `ai.enabled` + provider API
 *     key, token-gated by the trigger), `ai` (offline provider control),
 *     and `review` (on-demand AI compliance scoring, requires a key for
 *     the AI phase).
 *
 * The manifest is derived from per-command metadata below, kept in sync
 * with the dispatcher by tests (every registered command must appear
 * here with the right tier). `battle` is listed as a `launcher`: it
 * installs (on first use) and launches the standalone ABA benchmark — a
 * separate product with its own repo — so it is exposed with its own
 * tier, never confused with the deterministic CLI or the engine.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Per-command metadata: tier (cli|engine), whether it is deterministic,
// whether it needs a network/API key, and its capabilities. Keep in sync
// with the command registry in the dispatcher — the tools tests enforce it.
const COMMANDS = [
  {
    name: 'init',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Initialize ACC structure in a directory',
    capabilities: ['scaffold', 'gitignore', 'memory_init'],
  },
  {
    name: 'check',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Validate repository against ACC rules',
    capabilities: ['diagnostics', 'severity_filter', 'exit_codes'],
  },
  {
    name: 'inspect',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Inspect roles, owners, dependencies, constraints, memory for a path',
    capabilities: ['roles', 'owners', 'dependencies', 'constraints', 'memory'],
  },
  {
    name: 'context',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Generate focused, progressive agent context for a path',
    capabilities: ['progressive_depth', 'provenance', 'byte_budget'],
  },
  {
    name: 'graph',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Derive the architecture graph (text, mermaid, dot, json)',
    capabilities: ['text', 'mermaid', 'dot', 'json'],
  },
  {
    name: 'slice',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Compact AI-optimized graph slice for a path (context router)',
    capabilities: ['scope', 'governed_by', 'depends_on', 'dependents', 'tested_by', 'impact'],
  },
  {
    name: 'dependencies',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'List dependencies of a path',
    capabilities: ['declared', 'discovered', 'transitive'],
  },
  {
    name: 'dependents',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'List what depends on a path',
    capabilities: ['reverse_edges', 'impact'],
  },
  {
    name: 'impact',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Estimate the impact of changing a path',
    capabilities: ['closure', 'boundaries', 'tests', 'contracts'],
  },
  {
    name: 'search',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Architecture-aware search across contracts, edges, and code',
    capabilities: ['contracts', 'edges', 'code', 'regex'],
  },
  {
    name: 'discover',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Suggest architectural improvements (dry-run by default)',
    capabilities: ['missing_contract', 'missing_dependency', 'stale_dependency', 'unknown_owner', 'orphan_code'],
  },
  {
    name: 'document',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Generate a conservative AGENTS.md template for a directory',
    capabilities: ['template', 'from_discovery'],
  },
  {
    name: 'build',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Create missing AGENTS.md contract files for undocumented code',
    capabilities: ['missing_contracts', 'from_discovery'],
  },
  {
    name: 'fill',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Instructions for completing placeholder AGENTS.md sections',
    capabilities: ['placeholders', 'missing_sections'],
  },
  {
    name: 'memory',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Read and update functionality-local .acc-memory.md files',
    capabilities: ['read', 'write', 'clear'],
  },
  {
    name: 'install',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'Install the ACC skill into an agent environment',
    capabilities: ['skill_deploy', 'agent_targets', 'idempotent'],
  },
  {
    name: 'ai',
    tier: 'engine',
    deterministic: true,
    requires_api_key: false,
    summary: 'Manage AI providers (AI SDK v5): list, add (provider → key → model), remove, default, models',
    capabilities: ['provider_list', 'provider_add', 'provider_remove', 'provider_default', 'models_list', 'offline', 'key_status'],
  },
  {
    name: 'tools',
    tier: 'cli',
    deterministic: true,
    requires_api_key: false,
    summary: 'List available tools and capabilities (this manifest)',
    capabilities: ['manifest', 'tiers', 'categories'],
  },
  {
    name: 'engine',
    tier: 'engine',
    deterministic: false,
    requires_api_key: true,
    summary: 'Always-on AI intelligence engine — automatically maintains the ACC files so the coding agent can ignore them',
    capabilities: [
      'deterministic_scan',
      'sync_apply',
      'trigger_commits',
      'trigger_changes',
      'ai_review',
      'supervisor',
      'watch_always_on',
      'init_context',
      'warn_report',
    ],
  },
  {
    name: 'review',
    tier: 'engine',
    deterministic: false,
    requires_api_key: true,
    summary: 'On-demand AI compliance review of a scope (score 0-100, read-only)',
    capabilities: ['offline_scan', 'compliance_score', 'supervisor_feedback'],
  },
  {
    name: 'battle',
    tier: 'launcher',
    deterministic: false,
    requires_api_key: false,
    summary: 'Launch (and install on first use) the standalone ACC Battle Arena benchmark (ABA) — a separate product, not part of the ACC capability surface',
    capabilities: ['aba_launcher', 'auto_install', 'headless', 'local_sandbox', 'network_policy'],
  },
];

// Legacy capability groups (unchanged shape for compat).
const CORE = [
  { name: 'filesystem', capabilities: ['read', 'write', 'glob'] },
  { name: 'search', capabilities: ['contracts', 'edges', 'code'] },
  { name: 'context', capabilities: ['progressive_depth', 'provenance'] },
  { name: 'graph', capabilities: ['text', 'mermaid', 'dot', 'json'] },
  { name: 'check', capabilities: ['diagnostics', 'severity_filter'] },
  { name: 'memory', capabilities: ['read', 'write'] },
  { name: 'inspect', capabilities: ['roles', 'owners', 'dependencies'] },
  { name: 'impact', capabilities: ['dependents', 'tests', 'constraints'] },
];

module.exports = {
  name: 'tools',
  summary: 'List available tools and capabilities',
  usage: 'acc tools [--json] [--category core|detected|plugins|commands|all]',
  booleans: ['--json'],
  flags: { '--category': { type: 'string' } },

  run(argv, ctx) {
    const { values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    const category = values['--category'] || 'all';
    if (!['core', 'detected', 'plugins', 'commands', 'all'].includes(category)) {
      return { error: `invalid category: ${category}`, exit: 2 };
    }

    // Config control plane: tools.auto_discover gates package.json
    // script discovery; tools.plugins.{enabled,directory} gates plugin
    // listing. Both default to enabled/'.acc/config/tools'.
    const tcfg = ctx.config.tools || {};
    const autoDiscover = tcfg.auto_discover !== false;
    const pluginsCfg = tcfg.plugins || {};
    const pluginsEnabled = pluginsCfg.enabled !== false;
    const pluginsDir = pluginsCfg.directory || '.acc/config/tools';

    // Detected project tools from package.json scripts (offline,
    // read-only). Sorted by name — package.json key order is NOT a
    // determinism guarantee.
    const detected = [];
    if (autoDiscover) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(ctx.root, 'package.json'), 'utf8'));
        if (pkg.scripts) {
          for (const name of Object.keys(pkg.scripts).sort()) {
            detected.push({ name, command: pkg.scripts[name], source: 'package.json scripts' });
          }
        }
      } catch {
        /* no package.json — fine */
      }
    }

    // Plugins from the configured tools directory (declared but not
    // executed). readdirSync order is filesystem-dependent — always sort.
    const plugins = [];
    if (pluginsEnabled) {
      const toolsDir = path.join(ctx.root, pluginsDir);
      if (fs.existsSync(toolsDir)) {
        for (const entry of fs.readdirSync(toolsDir).sort()) {
          if (fs.statSync(path.join(toolsDir, entry)).isDirectory()) {
            plugins.push({ name: entry, path: `${pluginsDir.replace(/\/+$/, '')}/${entry}` });
          }
        }
      }
    }

    const result = {
      tiers: {
        cli: {
          description: 'Deterministic, offline, zero-intelligence. Same repo + same flags = byte-identical output. No network, no API keys.',
          commands: COMMANDS.filter((c) => c.tier === 'cli').map((c) => c.name),
        },
        engine: {
          description: 'Intelligence subsystem: engine (sync, AI phase requires ai.enabled + provider API key, token-gated by trigger), ai (offline provider control), review (on-demand AI compliance scoring).',
          commands: COMMANDS.filter((c) => c.tier === 'engine').map((c) => c.name),
        },
        launcher: {
          description: 'External product launcher: battle installs (on first use) and launches the standalone ABA benchmark — a separate repo/package, never part of the ACC capability surface.',
          commands: COMMANDS.filter((c) => c.tier === 'launcher').map((c) => c.name),
        },
      },
      commands: COMMANDS,
      core: CORE,
      detected,
      plugins,
      note: 'CLI commands are deterministic and safe for any agent. Engine commands are the intelligence subsystem: the AI phase requires API keys and never runs offline by default. battle (ABA) is a launcher for a separate product: it installs the aba-arena repository on first use and runs it — never part of the ACC capability surface.',
    };

    if (ctx.opts.json) return { result };

    const lines = [];
    if (category === 'core' || category === 'all') {
      lines.push('Core tools');
      for (const t of CORE) lines.push(`  ✓ ${t.name} (${t.capabilities.join(', ')})`);
    }
    if (category === 'commands' || category === 'all') {
      lines.push('');
      lines.push('CLI — deterministic (offline, no API key)');
      for (const t of COMMANDS.filter((c) => c.tier === 'cli')) {
        lines.push(`  ✓ ${t.name.padEnd(14)} ${t.summary}`);
      }
      lines.push('');
      lines.push('Engine — intelligence subsystem (AI phase requires API key)');
      for (const t of COMMANDS.filter((c) => c.tier === 'engine')) {
        lines.push(`  ⚡ ${t.name.padEnd(14)} ${t.summary}`);
      }
    }
    if ((category === 'detected' || category === 'all') && detected.length) {
      lines.push('');
      lines.push('Detected project tools');
      for (const t of detected) lines.push(`  ✓ ${t.name} — ${t.command}`);
    }
    if ((category === 'plugins' || category === 'all') && plugins.length) {
      lines.push('');
      lines.push('Plugins');
      for (const t of plugins) lines.push(`  ○ ${t.name}`);
    }
    return { text: lines.join('\n') + '\n' };
  },
};
