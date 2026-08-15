import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

/* The landing page is index.md (front-matter: layout: home).
   Docs are under /reference/*, /guides/, /epistemology/, etc.
   We enable mermaid for graph diagrams. */

/* theme config */
export default defineConfig({
  title: 'ACC — Agent Code Context',
  description: 'A framework and CLI for making software repositories agent-native, navigable, and self-describing',

  /* Enable mermaid for graph diagrams (ACC graph, provenance diagrams) */
  markdown: {
    mermaid: true
  },

  /* Define nav and sidebar structures */
  themeConfig: {
    siteTitle: 'ACC — Agent Code Context',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Reference', link: '/reference/what-is-acc' },
      { text: 'Docs', link: '/docs/philosophy', items: [
        { text: 'Philosophy', link: '/docs/philosophy' },
        { text: 'Repository structure', link: '/docs/repository-structure' },
        { text: 'Epistemology', link: '/docs/epistemology' },
        { text: 'CLI commands', link: '/docs/cli-commands' },
        { text: 'Context engine', link: '/docs/context-engine' },
        { text: 'Diagnostic codes', link: '/docs/diagnostic-codes' },
        { text: 'JSON schema', link: '/docs/json-schema' },
        { text: 'Memory semantics', link: '/docs/memory-semantics' },
        { text: 'Authoring guide', link: '/docs/authoring-guide' }
      ]}
    ],
    sidebar: {
      '/reference/': [
        { text: 'What is ACC?', link: '/reference/what-is-acc' },
        { text: 'How agents navigate', link: '/reference/navigation' },
        { text: 'CLI reference', link: '/reference/cli' }
      ],
      '/docs/': [
        { text: 'Philosophy', link: '/docs/philosophy' },
        { text: 'Repository structure', link: '/docs/repository-structure' },
        { text: 'Epistemology', link: '/docs/epistemology' },
        { text: 'CLI commands', link: '/docs/cli-commands' },
        { text: 'Context engine', link: '/docs/context-engine' },
        { text: 'Diagnostic codes', link: '/docs/diagnostic-codes' },
        { text: 'JSON schema', link: '/docs/json-schema' },
        { text: 'Memory semantics', link: '/docs/memory-semantics' },
        { text: 'Authoring guide', link: '/docs/authoring-guide' }
      ]
    }
  }
})