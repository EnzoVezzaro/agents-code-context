/**
 * `acc fill [path]` — instructions for completing AGENTS.md files.
 *
 * Read-only. Analyzes every AGENTS.md under the project root and reports
 * which sections are missing, empty, or still holding template placeholders.
 * The output is a generic, agent-ready fill directive: an agent reads it
 * together with the source, then replaces the placeholders with accurate
 * content. Nothing is written by this command (per the CLI command spec).
 */
'use strict';

const path = require('path');
const { walkFiles, readUtf8, cmp } = require('../util');

const REQUIRED_SECTIONS = [
  'Purpose',
  'Responsibilities',
  'Ownership',
  'Inputs',
  'Outputs',
  'Dependencies',
  'Constraints',
  'Architecture',
];

const PLACEHOLDER_SENTENCE = /^Describe what .+ does in one sentence\.?$/;
const PLACEHOLDER_OWNER = /Owner\s*:\s*<[^>]*>/i;
const PLACEHOLDER_PROSE = /^<Prose/;

const DIRECTIVE = [
  'Read each AGENTS.md file below and the source code it documents, then',
  'replace every placeholder with accurate, concise content. Keep the',
  'Markdown structure and the section headings exactly as they are. Base',
  'the content on the actual source; do not invent facts. If a section has',
  'nothing to add, write "None." instead of guessing. Work through the list',
  'top to bottom.',
].join(' ');

function isPlaceholder(line) {
  const t = line.replace(/^[-*•]\s*/, '').trim();
  if (!t) return false;
  if (t.includes('<') && t.includes('>')) return true;
  if (PLACEHOLDER_SENTENCE.test(t)) return true;
  if (PLACEHOLDER_OWNER.test(t)) return true;
  if (PLACEHOLDER_PROSE.test(t)) return true;
  return false;
}

/** Parse AGENTS.md into a map of heading -> content lines (raw headings). */
function parseSections(text) {
  const sections = {};
  const order = [];
  let current = null;
  let currentLines = [];
  const flush = () => {
    if (current) {
      sections[current] = currentLines;
      currentLines = [];
    }
  };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (m && m[1]) {
      flush();
      current = m[1].replace(/[*`_]/g, '').trim();
      order.push(current);
    } else if (current) {
      currentLines.push(line);
    }
  }
  flush();
  return { sections, order };
}

function canon(name) {
  const lower = name.toLowerCase();
  return REQUIRED_SECTIONS.find((s) => s.toLowerCase() === lower);
}

function analyzeFile(file) {
  const text = readUtf8(file);
  if (text === null) return null;
  const { sections, order } = parseSections(text);

  const issues = {
    file: null,
    status: 'complete',
    missing: [],
    empty: [],
    placeholders: [],
  };

  for (const section of REQUIRED_SECTIONS) {
    const heading = order.find((h) => canon(h) === section);
    const body = sections[heading];
    const content = (body || []).filter((l) => l.trim() !== '');

    if (!heading) {
      issues.missing.push(section);
      issues.status = 'draft';
      continue;
    }
    if (content.length === 0) {
      issues.empty.push(section);
      issues.status = 'draft';
      continue;
    }
    const ph = content.filter(isPlaceholder);
    if (ph.length) {
      issues.placeholders.push({ section, count: ph.length });
      issues.status = 'draft';
    }
  }
  return issues;
}

module.exports = {
  name: 'fill',
  summary: 'Instructions for completing placeholder AGENTS.md sections',
  usage: 'acc fill [path] [--json]',
  booleans: ['--json'],
  flags: {},

  run(argv, ctx) {
    const { positionals, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length > 1) return { error: 'too many arguments', exit: 2 };

    const scope = positionals[0] ? positionals[0].replace(/\/+$/, '') : null;
    const files = walkFiles(ctx.root, ctx.root, ctx.config.ignore || [], [])
      .filter((rel) => path.posix.basename(rel) === 'AGENTS.md')
      .filter((rel) => !rel.startsWith('.acc/'))
      .filter((rel) => (scope ? rel === scope || rel.startsWith(scope + '/') : true));

    const results = [];
    let placeholderItems = 0;
    for (const rel of files.sort(cmp)) {
      const issue = analyzeFile(path.join(ctx.root, rel));
      if (!issue) continue;
      issue.file = rel;
      placeholderItems += issue.placeholders.reduce((n, p) => n + p.count, 0);
      results.push(issue);
    }

    const draft = results.filter((r) => r.status === 'draft').length;
    const complete = results.filter((r) => r.status === 'complete').length;

    const result = {
      root: ctx.root,
      directive: DIRECTIVE,
      files: results,
      summary: {
        total: results.length,
        draft,
        complete,
        placeholder_items: placeholderItems,
      },
    };

    if (ctx.opts.json) return { result };
    if (ctx.opts.quiet) return { result };

    const lines = ['acc fill — instructions for completing AGENTS.md files', ''];
    lines.push(`Fill directive: ${DIRECTIVE}`, '');
    if (results.length === 0) {
      lines.push('No AGENTS.md files found to fill.');
      return { result, text: lines.join('\n') + '\n' };
    }
    lines.push('Files to fill:');
    results.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.file}`);
      for (const s of r.missing) lines.push(`     - ${s}: section missing — add it`);
      for (const s of r.empty) lines.push(`     - ${s}: section present but empty — add content`);
      for (const p of r.placeholders) {
        lines.push(`     - ${p.section}: ${p.count} placeholder item${p.count === 1 ? '' : 's'}`);
      }
      if (r.status === 'complete') lines.push('     - already complete');
    });
    lines.push('');
    lines.push(
      `Summary: ${draft} of ${results.length} AGENTS.md file${results.length === 1 ? '' : 's'} need filling · ` +
        `${complete} complete · ${placeholderItems} placeholder items`,
    );
    return { result, text: lines.join('\n') + '\n' };
  },
};
