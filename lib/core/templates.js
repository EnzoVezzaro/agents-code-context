/**
 * Template system for ACC file generation.
 *
 * Templates live in `.acc/config/templates/` and are plain Markdown files
 * with `{{variable}}` placeholders. The system resolves templates in this
 * order:
 *
 *   1. Explicit path (via --template flag or config override)
 *   2. `.acc/config/templates/<name>.md` (user-customized)
 *   3. Built-in default (hardcoded in this file)
 *
 * Users can edit the template files directly — the system uses them for
 * all new contracts, memory records, and document generation.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = '.acc/config/templates';

/**
 * Resolve a template file path. Checks (in order):
 *   1. Explicit override path (from --template flag)
 *   2. `.acc/config/templates/<name>.md` in the project
 *   3. Returns null (caller uses built-in default)
 *
 * @param {string} root - project root
 * @param {string} name - template name (e.g. 'agents', 'memory')
 * @param {string|null} overridePath - explicit path from --template flag
 * @returns {string|null} resolved template content, or null for built-in
 */
function resolveTemplate(root, name, overridePath) {
  // 1. Explicit override.
  if (overridePath) {
    const full = path.isAbsolute(overridePath) ? overridePath : path.join(root, overridePath);
    if (fs.existsSync(full)) return fs.readFileSync(full, 'utf8');
    // Fall through — override not found, try defaults.
  }
  // 2. User-customized template in .acc/config/templates/.
  const customPath = path.join(root, TEMPLATES_DIR, `${name}.md`);
  if (fs.existsSync(customPath)) return fs.readFileSync(customPath, 'utf8');
  // 3. Built-in default (null → caller uses hardcoded fallback).
  return null;
}

/**
 * Substitute {{variable}} placeholders in a template string.
 * Variables are passed as an object: { name: 'reforma-50-88', ... }.
 * Unresolved placeholders are left as-is.
 *
 * @param {string} template - template text with {{var}} placeholders
 * @param {object} vars - key/value pairs for substitution
 * @returns {string} substituted text
 */
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match;
  });
}

/**
 * Get the built-in default AGENTS.md template (fallback when no custom
 * template is configured).
 */
function builtinAgentsMdTemplate(name) {
  return `# ${name}

## Purpose

${inferredPurpose(name)}

## Responsibilities

- <Responsibility 1>
- <Responsibility 2>

## Ownership

Owner: <team or module path>

## Inputs

- <Input 1>
- <Input 2>

## Outputs

- <Output 1>

## Dependencies

- <path/to/dependency>

## Constraints

- <Invariant 1>
- <Invariant 2>

## Architecture

<Prose describing the high-level structure.>

## Workflows

- See \`.acc/config/workflows/feature.md\` for the standard feature workflow.
`;
}

function inferredPurpose(name) {
  return `Describe what ${name} does in one sentence.`;
}

/**
 * Get the AGENTS.md template, resolved from config/custom/builtin.
 *
 * Supports both legacy and new calling conventions:
 *   Legacy: agentsMdTemplate(name, inferred) — uses built-in template
 *   New:    agentsMdTemplate(name, config, overridePath, inferred)
 *
 * @param {string} name - project/boundary name
 * @param {object|string|null} configOrInferred - ACC config (new) or inferred deps (legacy)
 * @param {string|null} overridePath - explicit --template path (new only)
 * @param {object|null} inferred - inferred deps/owners (new only)
 * @returns {string} template content with {{name}} resolved
 */
function agentsMdTemplate(name, configOrInferred, overridePath, inferred) {
  // Detect legacy call: agentsMdTemplate(name, { dependencies: [...] })
  const isLegacy = configOrInferred && !configOrInferred.schema_version
    && !configOrInferred._root && !configOrInferred.templates;
  let config, inferredDeps;
  if (isLegacy) {
    config = null;
    inferredDeps = configOrInferred;
    overridePath = null;
  } else {
    config = configOrInferred || null;
    inferredDeps = inferred || null;
  }
  const root = config && config._root ? config._root : process.cwd();
  const configTemplate = config && config.templates && config.templates.agents_md;
  const raw = resolveTemplate(root, 'agents', configTemplate || overridePath)
    || builtinAgentsMdTemplate(name);
  let result = renderTemplate(raw, { name, purpose: inferredPurpose(name) });
  // If inferred dependencies were provided, replace the placeholder.
  if (inferredDeps && inferredDeps.dependencies && inferredDeps.dependencies.length) {
    const depLines = inferredDeps.dependencies.map((d) => `<!-- inferred: ${d} -->\n- ${d}`).join('\n');
    result = result.replace('- <path/to/dependency>', depLines);
    result = result.replace('- <path/to/dependency>', depLines);
  }
  return result;
}

/**
 * Minimal `.acc/config/config.yaml` written by `acc init`.
 */
function configYaml(name) {
  return `# ${name} — ACC configuration
#
# Optional. When absent, ACC uses sensible defaults and every command
# still works. See the repository-structure spec.
schema_version: 1

# Templates — the system uses these to create and modify ACC files.
# Edit the .md files in .acc/config/templates/ to customize output.
# Uncomment to override a template path (relative to project root).
# templates:
#   agents_md: .acc/config/templates/agents.md

# Engine (AI-powered, token-gated). The AI phase only runs when the
# trigger fires — that is the token budget control. mode: commits |
# changes | always. commits → count git commits since the last
# triggered run; changes → content-hash snapshot of changed files.
# Default: 3 commits.
# engine:
#   trigger:
#     mode: commits
#     threshold: 3
#   supervisor:
#     # Second AI pass that scores proposed changes against ACC rules
#     # (0-100) before anything is written; iterates until compliant.
#     enabled: false
#     threshold: 85
#     max_iterations: 3

# AI configuration (optional, AI SDK v5). Core ACC stays offline and
# deterministic — AI is explicit opt-in and never required. Uncomment
# and edit to configure one or more providers. API keys are read from
# the environment (api_key_env), never stored in the repository.
# ai:
#   enabled: false
#   default: main
#   providers:
#     - id: main
#       provider: openai            # openai | anthropic | google | <npm package>
#       model: gpt-4o
#       api_key_env: OPENAI_API_KEY
#       base_url: null              # optional override (e.g. NVIDIA, OpenRouter)
`;
}

module.exports = {
  configYaml,
  agentsMdTemplate,
  resolveTemplate,
  renderTemplate,
  builtinAgentsMdTemplate,
  TEMPLATES_DIR,
};
