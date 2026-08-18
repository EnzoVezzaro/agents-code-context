/**
 * `acc uninstall` — remove all ACC-generated files from the repository.
 *
 * Removes:
 *   - .acc/ directory (config, state, ai.yaml)
 *   - AGENTS.md at root (only if it matches the generated template)
 *   - ACC_WARN.md
 *   - .acc-memory.md at root
 *   - .env entries for ACC AI keys (ACC_*_KEY)
 *   - .gitignore entries added by ACC
 *
 * Asks for confirmation interactively. --yes skips the prompt.
 * Never removes source code, user-written AGENTS.md in subdirectories,
 * or files outside the ACC footprint.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { resolveRoot, load, AI_CONFIG_PATH } = require('../core/config');
const { agentsMdTemplate } = require('../core/templates');
const { WARN_FILE } = require('../core/warnfile');

module.exports = {
  name: 'uninstall',
  summary: 'Remove all ACC-generated files from the repository',
  usage: 'acc uninstall [--yes]',
  booleans: ['--yes'],
  flags: {},

  run(argv, ctx) {
    const { values, unknown } = argv;
    if (unknown.length) return { error: `unknown option: ${unknown[0]}`, exit: 2 };

    const root = resolveRoot(ctx.rootFlag);
    const removed = [];
    const skipped = [];
    const notFound = [];

    // 1. .acc/ directory
    const accDir = path.join(root, '.acc');
    if (fs.existsSync(accDir)) {
      removed.push('.acc/');
    } else {
      notFound.push('.acc/');
    }

    // 2. AGENTS.md at root (only if it matches the template)
    const rootAgents = path.join(root, 'AGENTS.md');
    if (fs.existsSync(rootAgents)) {
      const content = fs.readFileSync(rootAgents, 'utf8');
      const template = agentsMdTemplate(path.basename(root));
      // Remove the template's placeholder lines for comparison.
      const normalize = (s) => s.replace(/<!--.*?-->/gs, '').replace(/\n{3,}/g, '\n\n').trim();
      if (normalize(content) === normalize(template)) {
        removed.push('AGENTS.md');
      } else {
        skipped.push('AGENTS.md (user-modified, keeping)');
      }
    } else {
      notFound.push('AGENTS.md');
    }

    // 3. ACC_WARN.md
    const warnPath = path.join(root, WARN_FILE);
    if (fs.existsSync(warnPath)) {
      removed.push(WARN_FILE);
    } else {
      notFound.push(WARN_FILE);
    }

    // 4. .acc-memory.md at root
    const rootMemory = path.join(root, '.acc-memory.md');
    if (fs.existsSync(rootMemory)) {
      removed.push('.acc-memory.md');
    } else {
      notFound.push('.acc-memory.md');
    }

    // 5. .env ACC keys
    const envPath = path.join(root, '.env');
    let envCleaned = false;
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      const kept = [];
      const removedKeys = [];
      for (const line of lines) {
        if (/^ACC_\w+_KEY=/.test(line.trim())) {
          removedKeys.push(line.split('=')[0]);
        } else {
          kept.push(line);
        }
      }
      if (removedKeys.length) {
        fs.writeFileSync(envPath, kept.join('\n'));
        envCleaned = true;
        removed.push(`.env (${removedKeys.join(', ')})`);
      }
    }

    // 6. .gitignore cleanup — remove ACC-added entries
    const gitignorePath = path.join(root, '.gitignore');
    let gitignoreCleaned = false;
    if (fs.existsSync(gitignorePath)) {
      let content = fs.readFileSync(gitignorePath, 'utf8');
      const before = content;
      // Remove .acc-memory.md entry
      content = content.replace(/^\.acc-memory\.md\s*$/m, '');
      // Remove ACC_WARN.md entry
      content = content.replace(/^ACC_WARN\.md\s*$/m, '');
      // Remove .env entry (only if it's the ACC-added one — last line pattern)
      content = content.replace(/^\.env\s*$/m, '');
      // Clean up multiple blank lines
      content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
      if (content !== before) {
        fs.writeFileSync(gitignorePath, content);
        gitignoreCleaned = true;
        removed.push('.gitignore (ACC entries)');
      }
    }

    // 7. .acc-memory.md in subdirectories
    const memoryFiles = findMemoryFiles(root, accDir);
    for (const mf of memoryFiles) {
      removed.push(mf);
    }

    const result = {
      root,
      removed: removed.sort(),
      skipped,
      not_found: notFound,
      env_cleaned: envCleaned,
      gitignore_cleaned: gitignoreCleaned,
    };

    if (ctx.opts.json) return { result };

    // Interactive confirmation.
    if (!values['--yes'] && process.stdin.isTTY && removed.length) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => {
        console.log('ACC uninstall — the following will be removed:\n');
        for (const r of removed) console.log(`  - ${r}`);
        if (skipped.length) {
          console.log('\nSkipped:');
          for (const s of skipped) console.log(`  - ${s}`);
        }
        console.log('');
        rl.question('Proceed? [y/N] ', (answer) => {
          rl.close();
          const a = (answer || '').trim().toLowerCase();
          if (a !== 'y' && a !== 'yes') {
            resolve({ text: 'Aborted.\n' });
            return;
          }
          resolve(doRemove(root, result));
        });
      });
    }

    if (!removed.length) {
      return { text: 'Nothing to remove — no ACC files found.\n' };
    }

    return doRemove(root, result);
  },
};

function findMemoryFiles(root, excludeDir) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (e.name === '.acc-memory.md') {
        const full = path.join(dir, e.name);
        files.push(path.relative(root, full));
      }
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (path.join(dir, e.name) === excludeDir) continue;
      if (e.name === '.git' || e.name === 'node_modules') continue;
      walk(path.join(dir, e.name));
    }
  };
  walk(root);
  return files;
}

function doRemove(root, result) {
  const lines = [];

  // Remove .acc/ directory
  const accDir = path.join(root, '.acc');
  if (fs.existsSync(accDir)) {
    fs.rmSync(accDir, { recursive: true, force: true });
    lines.push('Removed .acc/');
  }

  // Remove root AGENTS.md
  const rootAgents = path.join(root, 'AGENTS.md');
  if (result.removed.includes('AGENTS.md') && fs.existsSync(rootAgents)) {
    fs.unlinkSync(rootAgents);
    lines.push('Removed AGENTS.md');
  }

  // Remove ACC_WARN.md
  const warnPath = path.join(root, WARN_FILE);
  if (result.removed.includes(WARN_FILE) && fs.existsSync(warnPath)) {
    fs.unlinkSync(warnPath);
    lines.push(`Removed ${WARN_FILE}`);
  }

  // Remove .acc-memory.md at root
  const rootMemory = path.join(root, '.acc-memory.md');
  if (result.removed.includes('.acc-memory.md') && fs.existsSync(rootMemory)) {
    fs.unlinkSync(rootMemory);
    lines.push('Removed .acc-memory.md');
  }

  // Remove .acc-memory.md in subdirectories
  for (const r of result.removed) {
    if (r.endsWith('/.acc-memory.md') && r !== '.acc-memory.md') {
      const full = path.join(root, r);
      if (fs.existsSync(full)) fs.unlinkSync(full);
      lines.push(`Removed ${r}`);
    }
  }

  lines.push('');
  lines.push('ACC removed. Your source code and git history are untouched.');
  return { text: lines.join('\n') + '\n' };
}
