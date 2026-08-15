#!/usr/bin/env node
/**
 * Sync the canonical specification docs (../docs/) into the VitePress site
 * content directory (docs/).
 *
 * The repository docs are the single source of truth. This script:
 *   1. Removes previously generated pages from the site content directory.
 *   2. Copies every numbered spec file (NN-name.md) into the site with a
 *      clean page name (name.md).
 *   3. Rewrites internal cross-links (./NN-name.md → ./name.md) so the
 *      clean URLs resolve.
 *
 * Usage: node scripts/sync-docs.mjs
 * Run automatically by `npm run build` and `npm run dev`.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoDocs = path.resolve(scriptDir, '../../docs') // repository docs (source of truth)
const siteDocs = path.resolve(scriptDir, '../docs') // vitepress content directory

const PAGE_RE = /^(\d{2})-(.+)\.md$/
const LINK_RE = /\.\/(\d{2})-([a-z0-9-]+)\.md/g

async function main() {
  const entries = await fs.readdir(repoDocs)

  // 1. Clear previously generated pages (keep the home page and .vitepress).
  const existing = await fs.readdir(siteDocs)
  for (const file of existing) {
    if (file.endsWith('.md') && file !== 'index.md') {
      await fs.rm(path.join(siteDocs, file), { force: true })
    }
  }

  // 2. Copy numbered spec pages with clean names.
  let copied = 0
  for (const file of entries.sort()) {
    const match = file.match(PAGE_RE)
    if (!match) continue // skip README.md, AGENTS.md, etc.

    const [, , name] = match
    const source = await fs.readFile(path.join(repoDocs, file), 'utf8')

    // 3. Rewrite internal cross-links to the clean page names.
    const content = source.replace(LINK_RE, (_m, _num, slug) => `./${slug}.md`)

    await fs.writeFile(path.join(siteDocs, `${name}.md`), content)
    copied++
  }

  console.log(`docs:synced ${copied} pages from ${path.relative(process.cwd(), repoDocs)}`)
}

main().catch((err) => {
  console.error('docs:sync failed:', err.message)
  process.exit(1)
})
