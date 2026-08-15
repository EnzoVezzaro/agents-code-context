import { defineConfig } from 'vitepress'

/*
 * ACC documentation site.
 *
 * Content comes from the repository's canonical docs/ directory via
 * `npm run docs:sync` (see scripts/sync-docs.mjs). Page names are the
 * spec files with the numeric prefix stripped (philosophy.md, ...).
 */

export default defineConfig({
  title: 'ACC — Agent Code Context',
  description:
    'A framework and CLI for making software repositories agent-native, navigable, and self-describing',

  cleanUrls: true,

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
