/**
 * `acc battle <project>` — launch the ACC Battle Arena benchmark (ABA).
 *
 * ABA is a separate application used to benchmark the ACC framework; the
 * framework never requires it and works without it. This command is the
 * convenience launcher: it locates ABA (npm-installed `acc-battle-arena`,
 * a local `aba/` checkout, or a cached clone) and, when ABA is missing,
 * INSTALLS it — clones the aba-arena repository into the cache and
 * installs its dependencies — then runs it against the given project.
 *
 * Docker is optional for ABA: it runs benchmarks on an isolated snapshot
 * copy, using a container when Docker is available and the host otherwise
 * (`--local` forces host mode).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const ABA_REPO = 'https://github.com/EnzoVezzaro/aba-arena.git';
const ABA_PKG = 'acc-battle-arena';

/** Where ABA is installed when not already present (per-user cache). */
function abaCacheDir() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'acc', 'aba-arena');
}

/**
 * Locate ABA's entry point: the npm-installed package (a dependency of
 * acc-code-context, so `acc battle` works out of the box), a local `aba/`
 * checkout, then the cached clone. Returns the index.cjs path or null.
 */
function findAbaEntry() {
  const candidates = [
    path.join(__dirname, '..', '..', 'node_modules', ABA_PKG, 'index.cjs'),
    path.join(__dirname, '..', '..', 'aba', 'index.cjs'),
    path.join(process.cwd(), 'aba', 'index.cjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return require.resolve(`${ABA_PKG}/index.cjs`, { paths: [process.cwd(), __dirname] });
  } catch {
    /* fall through to the cache */
  }
  return abaEntryIn(abaCacheDir());
}

/** Resolve ABA's entry point inside an installed/cached checkout. */
function abaEntryIn(dir) {
  if (!dir) return null;
  // Prefer the package's declared entry (main / bin) — the repo layout
  // differs from the published package (e.g. src/index.cjs).
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    if (pkg.bin && typeof pkg.bin === 'object') {
      for (const p of Object.values(pkg.bin)) {
        const abs = path.join(dir, p);
        if (fs.existsSync(abs)) return abs;
      }
    }
    if (typeof pkg.main === 'string') {
      const abs = path.join(dir, pkg.main);
      if (fs.existsSync(abs)) return abs;
    }
  } catch {
    /* no package.json — fall through */
  }
  for (const rel of ['index.cjs', 'src/index.cjs', 'cli.cjs']) {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Install ABA into the cache: clone the repository (shallow) and install
 * its dependencies (the prepare script builds the bundled UI). Returns
 * the entry path, or null when installation fails.
 */
function installAba() {
  const dir = abaCacheDir();
  if (abaEntryIn(dir)) return abaEntryIn(dir);

  process.stdout.write(`acc battle: ABA not found — installing ACC Battle Arena from ${ABA_REPO}\n`);
  process.stdout.write(`  → ${dir}\n`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const clone = spawnSync('git', ['clone', '--depth', '1', ABA_REPO, dir], { stdio: 'inherit' });
    if (clone.status !== 0) {
      process.stderr.write('acc battle: git clone failed — is git installed and the network reachable?\n');
      return null;
    }
    process.stdout.write('acc battle: installing ABA dependencies (npm install)\n');
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
    if (install.status !== 0) {
      process.stderr.write('acc battle: npm install failed — see the output above\n');
      return null;
    }
    const entry = abaEntryIn(dir);
    if (!entry) {
      process.stderr.write('acc battle: cloned repository has no recognizable entry point — unexpected layout\n');
      return null;
    }
    return entry;
  } catch (err) {
    process.stderr.write(`acc battle: installation failed: ${err.message}\n`);
    return null;
  }
}

module.exports = {
  name: 'battle',
  summary: 'Launch (and install if missing) the standalone ACC Battle Arena benchmark (ABA)',
  booleans: ['--preserve', '--local', '--headless'],
  flags: {
    '--network': { type: 'string' },
    '--timeout': { type: 'string' },
    '--model': { type: 'string' },
    '--agent': { type: 'string', repeatable: true },
  },
  usage: 'acc battle <project> [--local] [--network policy] [--preserve] [--timeout s] [--agent name:model]',

  run(argv, ctx) {
    const { positionals, values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };
    if (positionals.length !== 1) return { error: 'expected exactly one project path or repository', exit: 2 };

    // Locate ABA, installing it on first use when missing.
    let abaEntry = findAbaEntry();
    if (!abaEntry) {
      abaEntry = installAba();
    }
    if (!abaEntry) {
      return {
        error:
          'ABA (ACC Battle Arena) could not be located or installed. ' +
          `Install it manually (npm install -g ${ABA_PKG}) or clone ${ABA_REPO} and run node index.cjs <project> from it.`,
        exit: 1,
      };
    }

    // Forward the battle arguments to the standalone ABA.
    const args = [abaEntry, positionals[0]];
    for (const [flag, val] of Object.entries(values)) {
      if (flag === '--agent') {
        for (const a of val) args.push('--agent', a);
      } else if (val !== undefined && val !== false) {
        args.push(flag, String(val));
      } else if (val === true) {
        args.push(flag);
      }
    }

    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    // Keep the process alive until the child exits; return exit code via
    // a deferred exit signal handled by the dispatcher.
    return { spawn: child };
  },
};

module.exports.abaCacheDir = abaCacheDir;
module.exports.findAbaEntry = findAbaEntry;
module.exports.installAba = installAba;
module.exports.abaEntryIn = abaEntryIn;
