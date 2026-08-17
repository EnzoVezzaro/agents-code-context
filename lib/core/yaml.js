/**
 * Minimal YAML-subset parser.
 *
 * Supports exactly what the ACC config file needs: nested mappings,
 * sequences, inline sequences, quoted and plain scalars, comments and
 * empty lines. It intentionally does not implement the full YAML spec —
 * the config file is optional and a parse failure degrades to defaults
 * (see the repository-structure spec).
 */
'use strict';

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseInlineSeq(v) {
  const inner = v.trim().slice(1, -1);
  if (inner === '') return [];
  return inner.split(',').map((s) => parseScalar(s));
}

class Line {
  constructor(raw, index) {
    this.raw = raw;
    this.index = index;
    this.indent = (raw.match(/^\s*/) || [''])[0].length;
    this.text = raw.slice(this.indent);
  }
}

/**
 * Parse a YAML string into a plain object. Returns null when the document
 * is empty, and throws on syntax ACC cannot interpret.
 */
function parse(text) {
  const lines = text
    .split(/\r?\n/)
    .map((raw, i) => new Line(raw, i))
    .filter((l) => {
      const t = l.text.trim();
      return t !== '' && !t.startsWith('#') && !t.startsWith('---');
    });

  if (lines.length === 0) return null;

  let pos = 0;
  function next() {
    return lines[pos];
  }

  function parseBlock(indent) {
    const obj = {};
    while (pos < lines.length) {
      const line = next();
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error('unexpected indentation at line ' + (line.index + 1));

      // "- " sequence item at this level
      if (/^-\s+/.test(line.text) || line.text === '-') {
        return parseSeq(indent);
      }

      const m = line.text.match(/^([^:#]+):\s*(.*)$/);
      if (!m) throw new Error('cannot parse line ' + (line.index + 1) + ': ' + line.text);
      const key = m[1].trim().replace(/^['"]|['"]$/g, '');
      const rest = m[2].trim();
      pos++;

      if (rest === '') {
        // Nested block or empty value
        if (pos < lines.length && next().indent > line.indent) {
          obj[key] = parseBlock(next().indent);
        } else {
          obj[key] = null;
        }
      } else if (rest.startsWith('[') && rest.endsWith(']')) {
        obj[key] = parseInlineSeq(rest);
      } else if (rest.startsWith('#') || rest.startsWith('|') || rest.startsWith('>')) {
        obj[key] = null;
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }

  function parseSeq(indent) {
    const arr = [];
    while (pos < lines.length) {
      const line = next();
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error('unexpected indentation at line ' + (line.index + 1));
      const m = line.text.match(/^-\s*(.*)$/);
      if (!m) break;
      const rest = m[1].trim();
      pos++;
      if (rest === '') {
        if (pos < lines.length && next().indent > line.indent) {
          arr.push(parseBlock(next().indent));
        } else {
          arr.push(null);
        }
      } else if (rest.startsWith('[') && rest.endsWith(']')) {
        arr.push(parseInlineSeq(rest));
      } else if (/^[^:#]+:\s*/.test(rest)) {
        // "- key: value" mapping item — the first key shares the dash
        // line; the item's remaining keys are indented under it.
        arr.push(parseSeqItem(indent, line.indent, rest));
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  /** Parse a sequence item that is a mapping ("- key: value"). */
  function parseSeqItem(seqIndent, dashIndent, firstRest) {
    const obj = {};
    let first = true;
    let line = { indent: dashIndent, index: -1 };
    let rest = firstRest;
    for (;;) {
      if (!first) {
        if (pos >= lines.length) break;
        line = next();
        // Item ends when indentation drops back to the dash level or
        // the next dash item begins.
        if (line.indent <= dashIndent || /^-\s*/.test(line.text)) break;
        rest = line.text;
        pos++;
      }
      first = false;
      const m = rest.match(/^([^:#]+):\s*(.*)$/);
      if (!m) throw new Error('cannot parse line ' + (line.index + 1) + ': ' + rest);
      const key = m[1].trim().replace(/^['"]|['"]$/g, '');
      const value = m[2].trim();
      if (value === '') {
        if (pos < lines.length && next().indent > line.indent) {
          obj[key] = parseBlock(next().indent);
        } else {
          obj[key] = null;
        }
      } else if (value.startsWith('[') && value.endsWith(']')) {
        obj[key] = parseInlineSeq(value);
      } else if (value.startsWith('#') || value.startsWith('|') || value.startsWith('>')) {
        obj[key] = null;
      } else {
        obj[key] = parseScalar(value);
      }
    }
    return obj;
  }

  return parseBlock(lines[0].indent);
}

/**
 * Serialize a plain object into the YAML subset ACC writes.
 *
 * Used by the CLI-managed `ai` control file (`.acc/config/ai.yaml`):
 * nested mappings, sequences of scalars, and sequences of mappings.
 * Scalars are quoted only when needed (contains ':', '#', leading
 * specials, or is empty). Deterministic key order = insertion order.
 */
function serialize(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    const k = quoteKey(key);
    if (value === null || value === undefined) {
      lines.push(`${pad}${k}: null`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${pad}${k}:`);
      lines.push(...serialize(value, indent + 2));
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${k}: []`);
      } else {
        lines.push(`${pad}${k}:`);
        for (const item of value) {
          if (item !== null && typeof item === 'object') {
            lines.push(`${pad}  -`);
            for (const [ik, iv] of Object.entries(item)) {
              if (iv === null || iv === undefined) {
                lines.push(`${pad}    ${quoteKey(ik)}: null`);
              } else if (typeof iv === 'object') {
                lines.push(`${pad}    ${quoteKey(ik)}:`);
                lines.push(...serialize(iv, indent + 6));
              } else {
                lines.push(`${pad}    ${quoteKey(ik)}: ${scalar(iv)}`);
              }
            }
          } else {
            lines.push(`${pad}  - ${scalar(item)}`);
          }
        }
      }
    } else {
      lines.push(`${pad}${k}: ${scalar(value)}`);
    }
  }
  return lines;
}

function quoteKey(key) {
  const s = String(key);
  return /^[A-Za-z0-9_.-]+$/.test(s) ? s : JSON.stringify(s);
}

function scalar(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const s = String(value);
  if (s === '') return "''";
  if (/^\d+$/.test(s) || /^[-+\d.]/.test(s) || s === 'null' || s === 'true' || s === 'false' || /[:#]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

module.exports = { parse, serialize };
