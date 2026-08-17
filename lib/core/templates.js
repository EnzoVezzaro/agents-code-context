/**
 * Conservative templates for `acc init` and `acc document`.
 *
 * AGENTS.md templates use the standard Markdown sections from the
 * authoring guide — no ACC-specific schema.
 */
'use strict';

/** Minimal `.acc/config/config.yaml` written by `acc init`. */
function configYaml(name) {
  return `# ${name} — ACC configuration
#
# Optional. When absent, ACC uses sensible defaults and every command
# still works. See the repository-structure spec.
schema_version: 1

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

/** Canonical AGENTS.md template (per the authoring guide). */
function agentsMdTemplate(name, inferred = {}) {
  const inf = (label, values) => {
    if (!values || values.length === 0) return '';
    return values
      .map((v) => `<!-- inferred: ${v} -->\n- ${v}`)
      .join('\n');
  };

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

${inf('dependencies', inferred.dependencies) || '- <path/to/dependency>'}

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

module.exports = { configYaml, agentsMdTemplate };
