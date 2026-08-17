/**
 * Heuristic parser for `AGENTS.md` files.
 *
 * ACC imposes no schema on AGENTS.md. This parser looks for conventional
 * section headings (`Purpose`, `Ownership`, `Dependencies`, ...) and
 * extracts what it can. The raw file remains the source of truth — the
 * parsed structure is advisory, never authoritative.
 */
'use strict';

const CONVENTIONAL = [
  'Purpose',
  'Responsibilities',
  'Ownership',
  'Inputs',
  'Outputs',
  'Dependencies',
  'Constraints',
  'Architecture',
  'Workflows',
];

/**
 * Parse AGENTS.md text.
 * Returns { sections: {Name: text}, deps: [string], owners: [string],
 *           hasRecognizedSections: boolean, purpose: string|null }
 */
function parse(text) {
  const lines = text.split(/\r?\n/);
  const sections = {};
  const order = [];
  let current = null;
  let currentLines = [];

  const heading = /^(#{1,6})\s+(.+?)\s*$/;

  const flush = () => {
    if (current) {
      const body = currentLines.join('\n').trim();
      sections[current] = body;
      currentLines = [];
    }
  };

  for (const line of lines) {
    const m = line.match(heading);
    if (m && m[2]) {
      flush();
      current = m[2].replace(/[*`_]/g, '').trim();
      order.push(current);
    } else if (current) {
      currentLines.push(line);
    }
  }
  flush();

  // Match conventional sections case-insensitively and by prefix.
  const matched = {};
  for (const [name, body] of Object.entries(sections)) {
    const canon = CONVENTIONAL.find((c) => name.toLowerCase() === c.toLowerCase());
    if (canon && body !== '') matched[canon] = body;
  }

  const deps = extractDeps(matched.Dependencies || '');
  const owners = extractOwners(matched.Ownership || '');
  const purpose = extractPurpose(matched.Purpose || '');

  const hasRecognizedSections = CONVENTIONAL.some((c) => matched[c] !== undefined);

  return { sections: matched, deps, owners, purpose, hasRecognizedSections };
}

function extractDeps(depText) {
  const out = [];
  for (const raw of depText.split(/\r?\n/)) {
    const line = raw.replace(/^[-*•]\s*/, '').trim();
    if (!line || line.startsWith('#')) continue;
    // Split on commas/semicolons, then take the first token of each part
    // (dropping inline annotations like a parenthesized note).
    const parts = line.split(/[,;]/);
    for (const part of parts) {
      // Strip inline code backticks and wrapping parens/brackets so
      // `` `.claude-plugin/` `` and `(skills/acc)` resolve as real paths
      // — prose deps are often written with backticks or annotations.
      const token = part
        .trim()
        .replace(/[`*_]/g, '')
        .replace(/^[(\[]+|[)\]]+$/g, '')
        .split(/\s+/)[0];
      if (!token) continue;
      // Require a slash (path-like, e.g. src/database) or a ./../ prefix.
      // Bare prose words are never extracted — ACC imposes no schema.
      if (token.includes('/') || /^\.{1,2}\//.test(token)) {
        out.push(token.replace(/\/+$/, ''));
      }
    }
  }
  return dedupe(out);
}

function extractOwners(ownText) {
  const out = [];
  for (const raw of ownText.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^Owner\s*:\s*(.+)$/i);
    if (m) out.push(m[1].trim());
    else if (line.startsWith('-') || line.startsWith('*')) {
      const item = line.replace(/^[-*•]\s*/, '').trim();
      if (item && !item.startsWith('#')) out.push(item);
    }
  }
  return dedupe(out);
}

function extractPurpose(purposeText) {
  const first = purposeText.split(/\r?\n/)[0] || '';
  return first.replace(/^[-*•]\s*/, '').trim() || null;
}

function dedupe(arr) {
  return [...new Set(arr)];
}

module.exports = { parse, CONVENTIONAL };
