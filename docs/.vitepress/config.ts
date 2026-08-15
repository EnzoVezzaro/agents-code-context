import { defineConfig } from 'vitepress'

/*
 * ACC documentation site.
 *
 * The canonical specification lives here in docs/ — the numbered spec files
 * (01-philosophy.md, ...) ARE the site's pages. `rewrites` strips the numeric
 * prefix for clean URLs, and `srcExclude` keeps README.md and AGENTS.md out
 * of the built site. There is no separate content copy and no sync step.
 */

export default defineConfig({
  title: 'ACC — Agent Code Context',
  description:
    'A framework and CLI for making software repositories agent-native, navigable, and self-describing',

  cleanUrls: true,

  // Bricolage Grotesque + JetBrains Mono — the original landing page fonts.
  head: [
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
    '02-repository-structure.md': 'repository-structure.md',
    '03-epistemology.md': 'epistemology.md',
    '04-cli-commands.md': 'cli-commands.md',
    '05-context-engine.md': 'context-engine.md',
    '06-diagnostic-codes.md': 'diagnostic-codes.md',
    '07-json-schema.md': 'json-schema.md',
    '08-memory-semantics.md': 'memory-semantics.md',
    '09-authoring-guide.md': 'authoring-guide.md',
    '10-multi-agent-orchestration.md': 'multi-agent-orchestration.md',
    '11-tooling.md': 'tooling.md'
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
      { text: 'Repository structure', link: '/repository-structure' },
      { text: 'Epistemology & graph', link: '/epistemology' },
      { text: 'CLI commands', link: '/cli-commands' },
      { text: 'Context engine', link: '/context-engine' },
      { text: 'Diagnostic codes', link: '/diagnostic-codes' },
      { text: 'JSON schema', link: '/json-schema' },
      { text: 'Memory semantics', link: '/memory-semantics' },
      { text: 'AGENTS.md authoring guide', link: '/authoring-guide' },
      { text: 'Multi-agent orchestration', link: '/multi-agent-orchestration' },
      { text: 'Tooling subsystem', link: '/tooling' }
    ],

    footer: {
      message: 'MIT Licensed · Open source · Agent-agnostic'
    }
  }
})
