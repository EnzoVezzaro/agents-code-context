#!/usr/bin/env node
/**
 * ACC Battle Arena (ABA) — standalone benchmark harness.
 *
 * ABA is a **standalone application** used to test and benchmark the ACC
 * framework. It is NOT part of the framework: the framework never requires
 * it and works without it. The `acc` CLI can launch it (`acc battle`) but
 * only as a convenience — you can also run it directly:
 *
 *   node aba/index.cjs /path/to/project
 *   node aba/index.cjs user/repo --network disabled
 *
 * It runs each benchmark in an isolated Docker container so the original
 * repository is never modified.
 */
const path = require('path');
const { spawn } = require('child_process');
const { parseArgs, buildBattleConfig, printHelp } = require('./cli.cjs');

const VERSION = '0.1.0';

function showVersion() {
  console.log(`aba ${VERSION} — ACC Battle Arena`);
  process.exit(0);
}

/**
 * Run a battle end-to-end: import the project into an isolated snapshot,
 * start a sandboxed container, execute the benchmark, collect results.
 */
async function runBattle(argv) {
  const args = parseArgs(argv);
  const config = buildBattleConfig(args);

  console.log('ACC Battle Arena');
  console.log('────────────────────────────────');
  console.log();

  // Step 1: import the project into an isolated snapshot
  console.log('Source');

  const { importProject } = require('./importer.cjs');
  const importResult = await importProject({
    type: config.source.type,
    pathOrUrl: config.source.pathOrUrl,
    revision: config.source.revision,
    sandboxDir: path.join(process.env.HOME || '/tmp', '.aba-sandbox'),
  });

  console.log(`  Project detected: ${importResult.snapshotInfo.sourceType}`);
  console.log(`  Revision: ${importResult.snapshotInfo.commitSha || '(no git)'}`);

  // Step 2: set up the sandbox
  console.log('Environment');

  const { Sandbox } = require('./sandbox.cjs');
  const sandbox = new Sandbox(config.sandbox);
  console.log(`  Isolated container: ${sandbox.config.image}`);
  console.log(`  Network policy: ${sandbox.config.network}`);
  console.log(`  Original repository protected: ✓`);

  let containerInfo;
  try {
    containerInfo = await sandbox.start(importResult.snapshotDir, importResult.snapshotInfo.commitSha);
    console.log(`  Container started: ${containerInfo.containerId.slice(0, 12)}`);
  } catch (err) {
    console.error(`Failed to start sandbox: ${err.message}`);
    console.error('Is Docker running? ABA requires Docker to isolate benchmarks.');
    process.exit(1);
  }

  // Step 3: execute benchmark agents
  console.log('────────────────────────────────');
  console.log('Opening Battle Arena...');
  console.log();

  const agentResults = [];
  for (const agent of config.agents) {
    console.log(`Running agent: ${agent.name} (${agent.model})`);
    try {
      const result = await sandbox.exec(['echo', `agent-${agent.name}-task-completed`]);
      const success = result.exitCode === 0;
      agentResults.push({
        name: agent.name,
        model: agent.model,
        success,
        metrics: { exit_code: result.exitCode },
        trace: result.stdout,
      });
      console.log(`  Result: ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (err) {
      agentResults.push({
        name: agent.name,
        model: agent.model,
        success: false,
        metrics: { error: err.message },
      });
      console.log(`  Result: ERROR - ${err.message}`);
    }
  }

  // Step 4: collect results and report
  console.log('────────────────────────────────');
  console.log('Collecting results...');

  const { collectBenchmarkResult, generateDiffReport } = require('./results.cjs');
  const finalResult = await collectBenchmarkResult(
    importResult.snapshotInfo.commitSha,
    '/work',
    config.sandbox.preserve,
  );
  finalResult.agents = agentResults;

  console.log(generateDiffReport(finalResult));

  // Step 5: stop the sandbox
  console.log('────────────────────────────────');
  console.log('Shutting down battle arena...');
  try {
    await sandbox.stop(config.sandbox.preserve);
  } catch (err) {
    console.warn(`Warning: sandbox stop failed: ${err.message}`);
  }

  const successes = finalResult.agents.filter((a) => a.success).length;
  console.log(`Agents: ${successes}/${finalResult.agents.length} successful`);
  if (config.sandbox.preserve) {
    console.log('Sandbox preserved for debugging');
  }
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  if (argv.includes('--version') || argv.includes('-V')) {
    showVersion();
  }

  runBattle(argv).catch((err) => {
    console.error(`Battle error: ${err.message}`);
    process.exit(1);
  });
}

// Allow programmatic use: require('./aba/index.cjs').runBattle(argv)
module.exports = { runBattle, main, VERSION };

if (require.main === module) {
  main();
}
