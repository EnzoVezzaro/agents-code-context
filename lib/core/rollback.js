/**
 * Rollback snapshots — save and restore ACC file states.
 *
 * Before each write operation (engine --init-context, build --yes,
 * discover --apply), ACC saves a snapshot of the files that will be
 * changed into `.acc/state/rollback/`. `acc engine --rollback` restores
 * the most recent snapshot.
 *
 * Only the last 5 snapshots are kept.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROLLBACK_DIR = path.join('.acc', 'state', 'rollback');

/**
 * Save a snapshot before a write operation.
 * @param {string} root - project root
 * @param {string} command - the command being run (e.g. "engine --init-context")
 * @param {string[]} files - relative paths of files that will be modified
 * @returns {string} snapshot id
 */
function saveSnapshot(root, command, files) {
  const rollbackDir = path.join(root, ROLLBACK_DIR);
  fs.mkdirSync(rollbackDir, { recursive: true });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshotDir = path.join(rollbackDir, id);
  fs.mkdirSync(snapshotDir, { recursive: true });

  const manifest = {
    id,
    command,
    created: new Date().toISOString(),
    files: [],
  };

  for (const rel of files) {
    const full = path.join(root, rel);
    const snapshotFile = path.join(snapshotDir, rel.replace(/\//g, '__'));
    const exists = fs.existsSync(full);
    manifest.files.push({
      path: rel,
      snapshot: path.relative(snapshotDir, snapshotFile),
      existed: exists,
    });
    if (exists) {
      fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
      fs.copyFileSync(full, snapshotFile);
    }
  }

  fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Keep only the last 5 snapshots.
  pruneSnapshots(rollbackDir, 5);

  return id;
}

/**
 * List available snapshots, newest first.
 * @param {string} root - project root
 * @returns {object[]}
 */
function listSnapshots(root) {
  const rollbackDir = path.join(root, ROLLBACK_DIR);
  if (!fs.existsSync(rollbackDir)) return [];
  const entries = fs.readdirSync(rollbackDir).sort().reverse();
  const snapshots = [];
  for (const entry of entries) {
    const manifestPath = path.join(rollbackDir, entry, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      snapshots.push(manifest);
    } catch {
      // corrupt snapshot — skip
    }
  }
  return snapshots;
}

/**
 * Restore a snapshot, undoing the changes it recorded.
 * @param {string} root - project root
 * @param {object} snapshot - manifest object from listSnapshots()
 * @returns {{ text: string, files: string[] }}
 */
function restoreSnapshot(root, snapshot) {
  const snapshotDir = path.join(root, ROLLBACK_DIR, snapshot.id);
  const restored = [];

  for (const f of snapshot.files) {
    const full = path.join(root, f.path);
    const snapshotFile = path.join(snapshotDir, f.snapshot);

    if (f.existed) {
      if (fs.existsSync(snapshotFile)) {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.copyFileSync(snapshotFile, full);
        restored.push(f.path);
      }
    } else {
      if (fs.existsSync(full)) {
        fs.unlinkSync(full);
        restored.push(f.path);
      }
    }
  }

  // Remove the snapshot after restoring.
  fs.rmSync(snapshotDir, { recursive: true, force: true });

  return {
    text: `Rollback complete — ${restored.length} file(s) restored.\n`,
    files: restored,
  };
}

function pruneSnapshots(rollbackDir, keep) {
  const entries = fs.readdirSync(rollbackDir).sort();
  while (entries.length > keep) {
    const oldest = entries.shift();
    fs.rmSync(path.join(rollbackDir, oldest), { recursive: true, force: true });
  }
}

module.exports = { saveSnapshot, listSnapshots, restoreSnapshot, ROLLBACK_DIR };
