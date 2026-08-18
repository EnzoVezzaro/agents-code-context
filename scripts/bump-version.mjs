#!/usr/bin/env node
/**
 * Bump the ACC version everywhere — package.json, CHANGELOG, host manifests,
 * package-lock.json, and skill copies.
 *
 * Usage:
 *   npm run bump -- 0.5.0          # regular release
 *   npm run bump -- 0.5.0-beta.1   # prerelease (tagged, not cut to CHANGELOG)
 *
 * After bumping:
 *   npm test && npm run build:docs  # then commit + tag, run the Release workflow
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
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
// Host adapter manifests — every version-bearing manifest must agree with
// package.json (enforced by `npm run check:versions`). Keep them in sync
// here so a bump can never ship hosts that advertise a stale version.
// ---------------------------------------------------------------------------
const HOST_MANIFESTS = [
  '.claude-plugin/plugin.json', // Claude Code plugin
  '.codex-plugin/plugin.json',  // Codex plugin
  'gemini-extension.json',      // Gemini CLI extension
  'plugin.json',                // generic plugin manifest
  'plugin.yaml',                // Hermes Agent plugin manifest
]

function bumpVersion(relPath) {
  const abs = path.join(root, relPath)
  if (!existsSync(abs)) return
  let text = readFileSync(abs, 'utf8')
  const next = text
    .replace(/("version"\s*:\s*")[^"]+(")/g, `$1${requested}$2`)
    .replace(/(^version:\s*).+$/m, `$1${requested}`)
  if (next !== text) {
    writeFileSync(abs, next)
    console.log(`${relPath}: ${previous} → ${requested}`)
  }
}

for (const rel of HOST_MANIFESTS) bumpVersion(rel)

// ---------------------------------------------------------------------------
// package-lock.json — regenerate via npm install so the lockfile matches.
// ---------------------------------------------------------------------------
try {
  execSync('npm install --package-lock-only --ignore-scripts', { cwd: root, stdio: 'pipe' })
  console.log('package-lock.json: regenerated')
} catch {
  // Fallback: sed if npm fails.
  const lockPath = path.join(root, 'package-lock.json')
  if (existsSync(lockPath)) {
    let lock = readFileSync(lockPath, 'utf8')
    lock = lock.replace(new RegExp(`"version":\\s*"${previous.replace(/\./g, '\\.')}"`, 'g'), `"version": "${requested}"`)
    writeFileSync(lockPath, lock)
    console.log('package-lock.json: sed updated')
  }
}

// ---------------------------------------------------------------------------
// Skill copies — resolve __ACC_VERSION__ in all agent SKILL.md files.
// Uses `acc install` which reads the canonical skills/acc/SKILL.md (with
// __ACC_VERSION__ placeholder) and writes the resolved version to every
// target location.
// ---------------------------------------------------------------------------
const AGENT_TARGETS = [
  { flag: '', label: '.agents' },
  { flag: '--agent claude', label: '.claude' },
  { flag: '--agent codex', label: '.codex' },
  { flag: '--agent cursor', label: '.cursor' },
  { flag: '--agent opencode', label: '.opencode' },
  { flag: '--agent gemini', label: '.gemini' },
  { flag: '--agent vscode', label: '.vscode' },
]

const accBin = path.join(root, 'bin', 'acc.js')
for (const { flag, label } of AGENT_TARGETS) {
  try {
    execSync(`node "${accBin}" install ${flag} --force`, { cwd: root, stdio: 'pipe' })
    console.log(`skill copy: ${label}/skills/acc/SKILL.md ✓`)
  } catch {
    console.warn(`skill copy: ${label}/skills/acc/SKILL.md — FAILED (install manually)`)
  }
}

// ---------------------------------------------------------------------------
// Docs — nothing to edit here by hand. The version is read from package.json
// at build time; a docs redeploy is triggered by the package.json change
// (see .github/workflows/pages.yml trigger paths).
// ---------------------------------------------------------------------------

console.log('\nNext steps:')
console.log(`  git add -A && git commit -m "chore: bump to ${requested}"`)
console.log(`  git tag v${requested}`)
console.log('  Then push — the Release workflow publishes to npm automatically.')
console.log('  The docs site redeploys automatically (package.json is a deploy trigger).')
