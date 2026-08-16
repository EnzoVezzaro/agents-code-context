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
