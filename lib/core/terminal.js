/**
 * Terminal styling module for ACC CLI output.
 *
 * Provides a consistent visual language inspired by OpenCode/Crush:
 * - Adaptive colors (auto-detects terminal capabilities)
 * - Unicode icons for status indicators
 * - Box-drawing helpers for structured sections
 * - Muted/dim text for secondary information
 * - Bold for emphasis
 *
 * All functions gracefully degrade when colors are not supported.
 */
'use strict';

const pc = require('picocolors');

// ── Icons ──────────────────────────────────────────────────────────────
const icons = {
  check: '✓',
  cross: '✗',
  warning: '⚠',
  info: '●',
  spinner: '⟳',
  arrow: '→',
  bullet: '•',
  dot: '·',
  diamond: '◆',
  gear: '⚙',
  brain: '🧠',
  file: '📄',
  folder: '📁',
  rocket: '🚀',
  lock: '🔒',
  unlock: '🔓',
  search: '🔍',
  chart: '📊',
  clock: '⏱',
};

// ── Composable Style Helpers ───────────────────────────────────────────
// picocolors functions are: pc.color(text) or pc.color(pc.bold(text))
// We create helper functions that compose them cleanly.

const bold = (text) => pc.bold(String(text));
const dim = (text) => pc.dim(String(text));

// ── Theme ──────────────────────────────────────────────────────────────
// Color functions that take text and return styled text.
const theme = {
  primary: (text) => pc.cyan(String(text)),
  secondary: (text) => pc.magenta(String(text)),
  accent: (text) => pc.blue(String(text)),
  success: (text) => pc.green(String(text)),
  error: (text) => pc.red(String(text)),
  warning: (text) => pc.yellow(String(text)),
  info: (text) => pc.blue(String(text)),
  muted: (text) => pc.gray(String(text)),
  bold: bold,
  dim: dim,
};

// ── Box Drawing ────────────────────────────────────────────────────────
const boxChars = {
  // Single line
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  // Double line (for emphasis)
  doubleTopLeft: '╔',
  doubleTopRight: '╗',
  doubleBottomLeft: '╚',
  doubleBottomRight: '╝',
  doubleHorizontal: '═',
  doubleVertical: '║',
  // Thick line
  thickTopLeft: '┏',
  thickTopRight: '┓',
  thickBottomLeft: '┗',
  thickBottomRight: '┛',
  thickHorizontal: '━',
  thickVertical: '┃',
};

/**
 * Create a horizontal rule.
 * @param {number} width - Width of the rule
 * @param {Function} color - Color function
 * @returns {string} The horizontal rule
 */
function hr(width = 60, color = theme.muted) {
  return color(boxChars.horizontal.repeat(width));
}

/**
 * Create a section header with an icon and title.
 * @param {string} icon - The icon to use
 * @param {string} title - The section title
 * @param {Function} color - Color function
 * @returns {string} The styled header
 */
function header(icon, title, color = theme.primary) {
  return `${color(icon)} ${pc.bold(color(title))}`;
}

/**
 * Create a status line with an icon and message.
 * @param {string} icon - The icon to use
 * @param {string} message - The status message
 * @param {Function} color - Color function for the icon
 * @returns {string} The styled status line
 */
function status(icon, message, color = theme.muted) {
  return `${color(icon)} ${message}`;
}

/**
 * Create an indented line.
 * @param {string} content - The content
 * @param {number} indent - Number of spaces to indent
 * @returns {string} The indented content
 */
function indent(content, indent = 2) {
  return ' '.repeat(indent) + content;
}

/**
 * Format a number with optional color based on value.
 * @param {number} num - The number to format
 * @param {string} type - The type ('error', 'warning', 'info', 'success')
 * @returns {string} The formatted number
 */
function formatNumber(num, type = 'info') {
  const colorFn = theme[type] || theme.info;
  return colorFn(String(num));
}

/**
 * Create a summary line with multiple values.
 * @param {Array<{label: string, value: string|number, color?: Function}>} items
 * @param {string} separator - Separator between items
 * @returns {string} The formatted summary line
 */
function summary(items, separator = ' · ') {
  return items.map(item => {
    const valueStr = String(item.value);
    const colorFn = item.color || theme.info;
    return `${theme.muted(item.label)}: ${colorFn(valueStr)}`;
  }).join(separator);
}

/**
 * Create a section divider with a label.
 * @param {string} label - The label for the divider
 * @param {number} width - Total width
 * @returns {string} The styled divider
 */
function divider(label = '', width = 60) {
  if (!label) {
    return hr(width, theme.muted);
  }
  const labelStr = ` ${label} `;
  const remaining = width - labelStr.length;
  const left = Math.floor(remaining / 2);
  const right = remaining - left;
  return theme.muted(
    boxChars.horizontal.repeat(left) +
    labelStr +
    boxChars.horizontal.repeat(right)
  );
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} The formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Check if the terminal supports colors.
 * @returns {boolean}
 */
function supportsColor() {
  return process.stdout.isTTY && process.env.TERM !== 'dumb';
}

/**
 * Strip ANSI color codes from a string.
 * @param {string} str - The string to strip
 * @returns {string} The stripped string
 */
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Get the visible width of a string (excluding ANSI codes).
 * @param {string} str - The string
 * @returns {number} The visible width
 */
function visibleWidth(str) {
  return stripAnsi(str).length;
}

module.exports = {
  // Style helpers
  bold,
  dim,

  // Theme
  theme,
  icons,

  // Box drawing
  boxChars,
  hr,
  header,
  status,
  indent,
  formatNumber,
  summary,
  divider,
  formatDuration,

  // Utilities
  supportsColor,
  stripAnsi,
  visibleWidth,
};
