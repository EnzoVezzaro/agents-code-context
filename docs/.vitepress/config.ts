import { defineConfig } from 'vitepress'

/*
 * ACC documentation site.
 *
 * The canonical specification lives here in docs/ — the numbered spec files
 * (01-philosophy.md, ...) ARE the site's pages. `rewrites` strips the numeric
 * prefix for clean URLs, and `srcExclude` keeps README.md and AGENTS.md out
 * of the built site. There is no separate content copy and no sync step.
 */

// Deployed to GitHub Pages at /agents-code-context/ (see .github/workflows/pages.yml).
const base = '/agents-code-context/'

export default defineConfig({
  title: 'ACC — Agent Code Context',
  description:
    'A framework and CLI for making software repositories agent-native, navigable, and self-describing',

  cleanUrls: true,

  base,

  // Terminal examples in the landing templates rely on literal newlines
  // inside .term / .term-block — Vue's default whitespace condensation
  // collapses them into single lines, so preserve whitespace in SFCs.
  vue: {
    template: {
      compilerOptions: {
        whitespace: 'preserve'
      }
    }
  },

  // Bricolage Grotesque + JetBrains Mono — the original landing page fonts.
  head: [
    // Base-prefixed: VitePress does not rewrite head hrefs, and the site
    // is served from a sub-path on GitHub Pages.
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=JetBrains+Mono:wght@400;500;600&display=swap'
      }
    ]
  ],

  // Numbered spec files become clean page names: 01-philosophy.md → /philosophy
  rewrites: {
    '01-philosophy.md': 'philosophy.md',
    '03-repository-structure.md': 'repository-structure.md',
    '04-epistemology.md': 'epistemology.md',
    '05-cli-commands.md': 'cli-commands.md',
    '06-context-engine.md': 'context-engine.md',
    '07-diagnostic-codes.md': 'diagnostic-codes.md',
    '08-json-schema.md': 'json-schema.md',
    '09-memory-semantics.md': 'memory-semantics.md',
    '10-authoring-guide.md': 'authoring-guide.md',
    '11-multi-agent-orchestration.md': 'multi-agent-orchestration.md',
    '12-tooling.md': 'tooling.md',
    '02-markdown-is-all-you-need.md': 'markdown-is-all-you-need.md',
    '13-security.md': 'security.md'
  },

  // Repo meta files — not site pages.
  srcExclude: ['README.md', 'AGENTS.md'],

  markdown: {
    lineNumbers: false
  },

  themeConfig: {
    siteTitle: 'ACC — Agent Code Context',

    nav: [{ text: 'Docs', link: '/philosophy', activeMatch: '/.*' }],

    sidebar: [
      { text: 'Philosophy', link: '/philosophy' },
      { text: '"Markdown is all you need"', link: '/markdown-is-all-you-need' },
      { text: 'Repository structure', link: '/repository-structure' },
      { text: 'Epistemology & graph', link: '/epistemology' },
      { text: 'CLI commands', link: '/cli-commands' },
      { text: 'Context engine', link: '/context-engine' },
      { text: 'Diagnostic codes', link: '/diagnostic-codes' },
      { text: 'JSON schema', link: '/json-schema' },
      { text: 'Memory semantics', link: '/memory-semantics' },
      { text: 'AGENTS.md authoring guide', link: '/authoring-guide' },
      { text: 'Multi-agent orchestration', link: '/multi-agent-orchestration' },
      { text: 'Tooling subsystem', link: '/tooling' },
      { text: 'Security model', link: '/security' }
    ],

    footer: {
      message: 'MIT Licensed · Open source · Agent-agnostic · made with ❤️ from 🇩🇴'
    }
  }
})
