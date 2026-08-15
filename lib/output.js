/**
 * Deterministic output: the JSON envelope (docs/07) and terminal helpers.
 *
 * JSON rules: object keys sorted, arrays sorted per command, 2-space
 * indent, no trailing whitespace, UTF-8. No timestamps, no random data.
 */
'use strict';

const ACC_VERSION = require('../package.json').version;

/** Recursively sort object keys (arrays untouched). */
function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
    return out;
  }
  return obj;
}

/** Build the standard envelope (docs/07 §2). */
function envelope(command, root, result, opts = {}) {
  return {
    schema_version: 1,
    command,
    acc_version: ACC_VERSION,
    root,
    result,
    diagnostics: opts.diagnostics || [],
    truncated: opts.truncated || false,
    truncated_bytes_omitted: opts.truncatedBytesOmitted || 0,
  };
}

/** Error envelope (docs/07 §7). */
function errorEnvelope(command, root, kind, message, exitCode) {
  return {
    schema_version: 1,
    command,
    acc_version: ACC_VERSION,
    root: root || null,
    result: null,
    diagnostics: [],
    error: { kind, message, exit_code: exitCode },
    truncated: false,
    truncated_bytes_omitted: 0,
  };
}

/** Render JSON deterministically. */
function json(obj) {
  return JSON.stringify(sortKeys(obj), null, 2) + '\n';
}

/** Human "Source:" provenance tag. */
function sourceTag(provenance) {
  if (!provenance) return '';
  return `Source: ${provenance.source}${provenance.detail ? ` (${provenance.detail})` : ''}`;
}

module.exports = { envelope, errorEnvelope, json, sourceTag };
