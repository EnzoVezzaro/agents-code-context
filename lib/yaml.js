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
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  return parseBlock(lines[0].indent);
}

module.exports = { parse };
