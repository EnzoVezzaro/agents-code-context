#!/usr/bin/env node
/**
 * Bump the ACC version in one place — package.json — and let everything else
 * follow from it:
 *
 *   - The docs landing hero and footer read the version from package.json
 *     at build time (docs/.vitepress/config.ts injects __ACC_VERSION__), so
 *     they can never drift from the released version.
 *   - CHANGELOG.md gets a new [x.y.z] section cut from [Unreleased].
 *
 * Usage:
 *   npm run bump -- 0.5.0          # regular release
 *   npm run bump -- 0.5.0-beta.1   # prerelease (tagged, not cut to CHANGELOG)
 *
 * After bumping:
 *   npm test && npm run build:docs  # then commit + tag, run the Release workflow
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkgPath = path.join(root, 'package.json')
const changelogPath = path.join(root, 'CHANGELOG.md')

const requested = process.argv[2]
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/

function fail(msg) {
  console.error(`bump-version: ${msg}`)
  console.error('Usage: npm run bump -- <version>   e.g. npm run bump -- 0.5.0')
  process.exit(1)
}

if (!requested) fail('missing version argument')
if (!SEMVER.test(requested)) fail(`"${requested}" is not a valid semver version`)

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const previous = pkg.version
if (previous === requested) {
  console.log(`package.json already at ${requested} — nothing to do.`)
  process.exit(0)
}
pkg.version = requested
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`package.json: ${previous} → ${requested}`)

// ---------------------------------------------------------------------------
// CHANGELOG.md — cut [Unreleased] into a dated [x.y.z] section for full
// releases only. Prereleases keep everything under [Unreleased].
// ---------------------------------------------------------------------------
const isPrerelease = requested.includes('-')
if (!isPrerelease) {
  let changelog = readFileSync(changelogPath, 'utf8')
  const date = new Date().toISOString().slice(0, 10)
  const header = `## [${requested}] - ${date}`
  if (changelog.includes(header)) {
    console.log('CHANGELOG.md already has this release section — left unchanged.')
  } else if (changelog.includes('## [Unreleased]')) {
    changelog = changelog.replace(
      '## [Unreleased]',
      `## [${requested}] - ${date}\n\n_This section was cut from [Unreleased] by \`npm run bump\`._\n\n## [Unreleased]`
    )
    writeFileSync(changelogPath, changelog)
    console.log(`CHANGELOG.md: cut [Unreleased] → [${requested}] (${date})`)
  }
}

// ---------------------------------------------------------------------------
// Docs — nothing to edit here by hand. The version is read from package.json
// at build time; a docs redeploy is triggered by the package.json change
// (see .github/workflows/pages.yml trigger paths).
// ---------------------------------------------------------------------------

console.log('\nNext steps:')
console.log(`  git add package.json CHANGELOG.md && git commit -m "chore: bump to ${requested}"`)
console.log(`  git tag v${requested}`)
console.log('  Then run the "Release" workflow with the matching version to publish to npm.')
console.log('  The docs site redeploys automatically (package.json is a deploy trigger).')
