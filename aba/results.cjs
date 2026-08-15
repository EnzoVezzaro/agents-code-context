const { execSync } = require('child_process');
const { createHash, randomBytes } = require('crypto');
const { readFileSync, statSync, writeFileSync, mkdirSync } = require('fs');
const { join, basename, dirname } = require('path');

function execSyncP(args, options) {
  return execSync(args, { ...options, stdio: 'pipe' });
}

/**
 * Diff range structure
 */
function DiffRange() {
  this.added = [];
  this.removed = [];
  this.changed = [];
}

/**
 * Collect final state from a completed benchmark run.
 */
async function collectBenchmarkResult(battleId, sourceDir, sandboxPreserved) {
  const id = randomBytes(4).toString('hex');
  const timestamp = new Date().toISOString();

  let diffRange = new DiffRange();
  let changedFiles = [];
  let createdFiles = [];
  let deletedFiles = [];
  let testsPassed = 0;
  let testsFailed = 0;
  let buildSuccessful = false;
  let buildOutput = '';
  let agentTrace = '';

  try {
    // Try to get git diff from the source directory
    const gitDir = require('path').join(sourceDir, '.git');
    if (statSync(gitDir).isDirectory()) {
      try {
        const gitDiff = execSyncP(['diff', 'HEAD'], {
          cwd: sourceDir,
          stdio: 'pipe',
        }).toString();

        // Get list of changed files
        const changedOutput = execSyncP(['diff', '--name-only', 'HEAD'], {
          cwd: sourceDir,
          stdio: 'pipe',
        }).toString();
        changedFiles = changedOutput.split('\n').filter(f => f.trim());

        // Differentiate created vs deleted based on diff signs
        // ... (simplified parsing)
      } catch (e) {
        // Git diff failed, continue without it
      }
    }
  } catch (err) {
    // Continue with whatever we could collect
  }

  // Build diff range
  diffRange = {
    added: createdFiles.length > 0 ? createdFiles : [],
    removed: deletedFiles.length > 0 ? deletedFiles : [],
    changed: changedFiles.length > 0 ? changedFiles : [],
  };

  // Record environment fingerprint
  const envInfo = await recordEnvironmentFingerprint();

  return {
    battleId: `battle-${id}`,
    source: { type: 'local' },
    snapshot: {
      commitSha: '',
      snapshotHash: '',
    },
    status: 'completed',
    agents: [],
    diff: diffRange,
    environment: envInfo,
    timestamp,
    preserveSandbox: sandboxPreserved,
  };
}

/**
 * Record environment fingerprint for reproducibility.
 */
async function recordEnvironmentFingerprint() {
  const hash = createHash('sha256');
  const now = new Date();

  return {
    image: `aba-benchmark-${now.getTime()}`,
    digest: hash.update(now.toString()).digest('hex'),
    os: process.platform,
    arch: process.arch,
    runtimeVersions: {
      node: process.version,
    },
  };
}

/**
 * Generate a diff report showing what changed between the base commit
 * and the benchmark result.
 */
function generateDiffReport(result) {
  const lines = [];

  lines.push(`# Battle Result: ${result.battleId}`);
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push('');

  lines.push('## Source');
  lines.push(`- Type: ${result.source.type}`);
  if (result.source.revision) lines.push(`- Requested Revision: ${result.source.revision}`);
  if (result.source.resolvedRevision) lines.push(`- Resolved Revision: ${result.source.resolvedRevision}`);
  lines.push('');

  lines.push('## Snapshot');
  lines.push(`- Commit SHA: ${result.snapshot.commitSha}`);
  lines.push(`- Snapshot Hash: ${result.snapshot.snapshotHash}`);
  lines.push('');

  lines.push('## Agents');
  for (const agent of result.agents) {
    lines.push(`### ${agent.name} (${agent.model})`);
    lines.push(`- Success: ${agent.success}`);
    lines.push(`- Metrics: ${JSON.stringify(agent.metrics)}`);
    if (agent.trace) {
      lines.push(`- Trace: ${agent.trace.substring(0, 200)}...`);
    }
    if (agent.diff) {
      lines.push('- Files changed:');
      if (agent.diff.added.length > 0) {
        lines.push(`  Added: ${agent.diff.added.join(', ')}`);
      }
      if (agent.diff.removed.length > 0) {
        lines.push(`  Removed: ${agent.diff.removed.join(', ')}`);
      }
      if (agent.diff.changed.length > 0) {
        lines.push(`  Changed: ${agent.diff.changed.join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push('## Environment');
  lines.push(`- Image: ${result.environment.image}`);
  lines.push(`- Digest: ${result.environment.digest}`);
  lines.push(`- OS: ${result.environment.os}`);
  lines.push(`- Arch: ${result.environment.arch}`);
  lines.push(`- Runtime Versions: ${JSON.stringify(result.environment.runtimeVersions)}`);
  lines.push('');

  lines.push('## Diff');
  lines.push(`- Added files: ${result.diff.added.length}`);
  lines.push(`- Removed files: ${result.diff.removed.length}`);
  lines.push(`- Changed files: ${result.diff.changed.length}`);
  lines.push('');

  return lines.join('\n');
}

function BattleResult() {}

/**
 * Parse a GitHub shorthand or URL into owner/repo.
 */
function parseGithubRepo(input) {
  let clean = input;
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.replace(/^github\.com\//, '');
  const parts = clean.split('/').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  throw new Error(`Invalid GitHub repository specification: ${input}`);
}

module.exports = {
  collectBenchmarkResult,
  generateDiffReport,
  DiffRange,
  parseGithubRepo,
};