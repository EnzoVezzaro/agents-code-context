const { execSync } = require('child_process');
const { createHash } = require('crypto');
const { readFileSync, statSync, rmSync, mkdirSync, copyFileSync } = require('fs');
const { join, basename, dirname } = require('path');

// Detect git path
const gitPath = execSync('which git', { stdio: 'pipe' }).toString().trim();

// Helper: run a git command and return stdout
function runGit(args, cwd) {
  return execSync(gitPath + ' ' + args, { cwd, stdio: 'pipe' }).toString().trim();
}

// Helper: run a git command, throw if non-zero
function runGitSync(args, cwd) {
  execSync(gitPath + ' ' + args, { cwd, stdio: 'pipe' });
}

// Minimal exports - no TypeScript annotations
function createSnapshotHash(projectDir, commitSha) {
  const content = `${commitSha}`;
  return createHash('sha256').update(content).digest('hex');
}

function copyDirectory(src, dest) {
  if (!statSync(src).isDirectory()) return;
  mkdirSync(dest, { recursive: true });
  const entries = require('fs').readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

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

/**
 * Import a project from various sources and create an isolated snapshot.
 * The original project is never modified.
 */
async function importProject(spec) {
  const { type, pathOrUrl, revision, sandboxDir } = spec;
  let originalDir;
  let snapshotDir;

  try {
    switch (type) {
      case 'local': {
        originalDir = pathOrUrl;
        const absPath = originalDir.startsWith('/') ? originalDir : join(process.cwd(), originalDir);
        
        if (!statSync(absPath).isDirectory()) {
          throw new Error(`Local project directory not found: ${absPath}`);
        }
        
        snapshotDir = await createLocalSnapshot(absPath, sandboxDir);
        break;
      }
      
      case 'github': {
        const repoInfo = parseGithubRepo(pathOrUrl);
        originalDir = await cloneGithubRepo(repoInfo.owner, repoInfo.repo, sandboxDir);
        break;
      }
      
      case 'git': {
        originalDir = await cloneGitRepo(pathOrUrl, revision, sandboxDir);
        break;
      }
      
      default:
        throw new Error(`Unsupported source type: ${type}`);
    }

    // Get commit SHA and create snapshot hash
    const commitSha = await getCommitSha(originalDir, revision);
    const snapshotHash = createSnapshotHash(originalDir, commitSha);
    
    const snapshotInfo = {
      sourceType: type,
      sourceUrl: type === 'github' ? `https://github.com/${pathOrUrl}` : type === 'git' ? pathOrUrl : undefined,
      sourcePath: type === 'local' ? pathOrUrl : undefined,
      commitSha,
      snapshotHash,
      revision,
    };

    return { snapshotDir, snapshotInfo, originalDir };
  } catch (err) {
    if (snapshotDir && statSync(snapshotDir).isDirectory()) {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
    throw err;
  }
}

/**
 * Create a local project snapshot using git worktree or archive.
 */
async function createLocalSnapshot(projectDir, sandboxDir) {
  const snapshotDir = join(sandboxDir, 'snapshots', basename(projectDir));
  mkdirSync(snapshotDir, { recursive: true });

  try {
    // Try git worktree first
    try {
      runGit('worktree add ' + snapshotDir + ' HEAD', projectDir);
      return snapshotDir;
    } catch (e) {
      // Fall back to archive
    }
    
    // Archive fallback
    runGit('archive HEAD', projectDir);
    // Extract archive to snapshot dir (simplified)
    copyDirectory(projectDir, snapshotDir);
    return snapshotDir;
  } catch (err) {
    // Fallback: simple copy
    copyDirectory(projectDir, snapshotDir);
    return snapshotDir;
  }
}

/**
 * Clone a GitHub repository into the sandbox.
 */
async function cloneGithubRepo(owner, repo, sandboxDir) {
  const repoUrl = 'https://github.com/' + owner + '/' + repo + '.git';
  const targetDir = join(sandboxDir, 'repos', owner + '-' + repo);
  mkdirSync(dirname(targetDir), { recursive: true });

  runGit('clone ' + repoUrl + ' ' + targetDir);
  return targetDir;
}

/**
 * Clone a Git repository with optional revision.
 */
async function cloneGitRepo(gitUrl, revision, sandboxDir) {
  const targetDir = join(sandboxDir, 'repos', basename(gitUrl.replace('.git', '')));
  mkdirSync(dirname(targetDir), { recursive: true });

  const args = 'clone ' + gitUrl + ' ' + targetDir;
  if (revision) {
    args += ' --branch=' + revision;
  }
  runGit(args);
  return targetDir;
}

/**
 * Get the commit SHA for a project directory.
 */
async function getCommitSha(projectDir, revision) {
  if (revision) {
    try {
      runGit('rev-parse ' + revision, projectDir);
      return runGit('rev-parse ' + revision, projectDir);
    } catch {
      return runGit('rev-parse HEAD', projectDir);
    }
  }
  
  return runGit('rev-parse HEAD', projectDir);
}

/**
 * Create a snapshot hash that captures the state of the snapshot.
 */
function createSnapshotHash2(projectDir, commitSha) {
  const content = `${commitSha}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Parse a GitHub shorthand or URL into owner/repo.
 */
function parseGithubRepo2(input) {
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
  importProject,
  createSnapshotHash: createSnapshotHash2,
  parseGithubRepo: parseGithubRepo2,
  createLocalSnapshot,
  cloneGithubRepo,
  cloneGitRepo,
  getCommitSha,
};