const path = require('path');
const { execFile } = require('child_process');

/**
 * Parse command-line arguments for the battle command.
 */
function parseArgs(argv) {
  const args = {};
  let i = 0;

  while (i < argv.length) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      printHelp();
      process.exit(0);
    } else if (argv[i] === '--version' || argv[i] === '-V') {
      console.log('aba 0.1.0');
      process.exit(0);
    } else if (argv[i] === '--preserve') {
      args.preserve = true;
      i++;
    } else if (argv[i] === '--network' && i + 1 < argv.length) {
      args.network = argv[++i];
      i++;
    } else if (argv[i] === '--timeout' && i + 1 < argv.length) {
      args.timeout = parseInt(argv[++i], 10);
      i++;
    } else if (argv[i] === '--model' && i + 1 < argv.length) {
      args.model = argv[++i];
      i++;
    } else if (argv[i] === '--agent' && i + 1 < argv.length) {
      if (!args.agents) args.agents = [];
      args.agents.push(argv[++i]);
      i++;
    } else if (argv[i].startsWith('--')) {
      i++;
    } else if (argv[i].startsWith('-')) {
      i++;
    } else {
      // Positional argument - determine context
      if (Object.keys(args).length === 0) {
        args.project = argv[i];
      } else if (Object.keys(args).length === 1) {
        // Could be source or config depending on position
        args.source = argv[i];
      } else {
        args.config = argv[i];
      }
      i++;
    }
  }

  // Set defaults
  if (!args.network) args.network = 'restricted';
  if (!args.timeout) args.timeout = 1800;
  
  return args;
}

/**
 * Print help text for the battle command.
 */
function printHelp() {
  console.log(`\
ACC Battle Arena - Isolated Agent Benchmark

Usage: acc battle [options] [project]

Options:
  --preserve       Preserve sandbox after battle for debugging
  --network policy Set network policy: disabled|restricted|enabled
  --timeout seconds Set benchmark timeout in seconds
  --model model    Specify model to use
  --agent name     Specify agent name (repeatable)
  --help, -h       Show this help message
  --version, -V    Show version

Project sources:
  Local: /path/to/project
  GitHub: user/repo or https://github.com/user/repo
  Git: git URL with optional --revision

Examples:
  acc battle /path/to/my-project
  acc battle user/repo
  acc battle git@github.com:user/project --revision main
  acc battle --preserve user/repo
`);
}

/**
 * Build the full battle configuration from parsed args and defaults.
 */
function buildBattleConfig(args) {
  // Determine source type and details
  let sourceType = 'local';
  let sourcePath = args.project || process.cwd();
  let revision = args.revision;

  // Check if it's a GitHub repo shorthand
  if (sourcePath.includes('/') && !sourcePath.startsWith('/')) {
    sourceType = 'github';
  }

  // Build source spec
  const source = {
    type: sourceType,
    pathOrUrl: sourcePath,
    revision,
  };

  // Build sandbox config
  const networkPolicy = args.network || 'restricted';

  const sandboxConfig = {
    image: 'node:24',
    network: networkPolicy,
    allowedApis: args.allowedApis ? args.allowedApis.split(',') : undefined,
    timeout: args.timeout,
    preserve: args.preserve,
    env: args.env,
    secrets: args.secrets,
  };

  // Build agents list
  const agents = args.agents && args.agents.length > 0
    ? args.agents.map((a) => {
        const parts = a.split(':');
        return { name: parts[0] || 'default', model: parts[1] || 'gpt-4' };
      })
    : [{ name: 'default', model: args.model || 'gpt-4' }];

  // Task - always required
  const task = args.task || 'Complete the assigned software engineering task';

  return {
    source,
    sandbox: sandboxConfig,
    agents,
    task,
  };
}

module.exports = {
  parseArgs,
  buildBattleConfig,
  printHelp,
};