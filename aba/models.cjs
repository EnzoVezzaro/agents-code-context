/**
 * Core data models and types for ABA.
 * CommonJS compatible - no TypeScript syntax.
 */

// Type-like exports as plain objects/strings

const SourceType = { LOCAL: 'local', GITHUB: 'github', GIT: 'git' };
const Revision = { BRANCH: 'branch', TAG: 'tag', SHA: 'sha' };
const NetworkPolicy = { DISABLED: 'disabled', RESTRICTED: 'restricted', ENABLED: 'enabled' };
const SandboxImage = { NODE: 'node', PYTHON: 'python', RUST: 'rust', GOLANG: 'golang', CUSTOM: 'custom' };

/**
 * Source specification for a benchmark project.
 */
function SourceSpec(type, pathOrUrl, revision) {
  this.type = type;
  this.pathOrUrl = pathOrUrl;
  this.revision = revision;
}

/**
 * Snapshot information captured from a project import.
 */
function SnapshotInfo(sourceType, sourceUrl, sourcePath, commitSha, snapshotHash, revision) {
  this.sourceType = sourceType;
  this.sourceUrl = sourceUrl;
  this.sourcePath = sourcePath;
  this.commitSha = commitSha;
  this.snapshotHash = snapshotHash;
  this.revision = revision;
}

/**
 * Sandbox configuration for benchmark execution.
 */
function SandboxConfig(image, network, allowedApis, timeout, preserve, env, secrets, memLimit, cpus) {
  this.image = image;
  this.network = network;
  this.allowedApis = allowedApis || [];
  this.timeout = timeout;
  this.preserve = preserve;
  this.env = env;
  this.secrets = secrets;
  this.memLimit = memLimit;
  this.cpus = cpus;
}

/**
 * Battle configuration for a benchmark run.
 */
function BattleConfig(source, sandbox, agents, task, environment) {
  this.source = source;
  this.sandbox = sandbox;
  this.agents = agents;
  this.task = task;
  this.environment = environment;
}

/**
 * Evaluation metric types.
 */
const EvaluationMetric = {
  SUCCESS: 'success',
  TOKEN_COUNT: 'token_count',
  EXECUTION_TIME: 'execution_time',
  COST: 'cost',
  FILES_CHANGED: 'files_changed',
  TESTS_PASSED: 'tests_passed',
  TESTS_FAILED: 'tests_failed',
};

/**
 * Diff range structure.
 */
function DiffRange() {
  this.added = [];
  this.removed = [];
  this.changed = [];
};

/**
 * Benchmark result structure.
 */
function BenchmarkResult(battleId, source, snapshot, status, agents, diff, environment, timestamp, preserveSandbox) {
  this.battleId = battleId;
  this.source = source;
  this.snapshot = snapshot;
  this.status = status;
  this.agents = agents;
  this.diff = diff;
  this.environment = environment;
  this.timestamp = timestamp;
  this.preserveSandbox = preserveSandbox;
};

/**
 * Agent result structure.
 */
function AgentResult(name, model, success, metrics, trace, diff) {
  this.name = name;
  this.model = model;
  this.success = success;
  this.metrics = metrics;
  this.trace = trace;
  this.diff = diff;
};

/**
 * Container state structure.
 */
function ContainerState(id, name, status) {
  this.id = id;
  this.name = name;
  this.status = status;
};

/**
 * Network policy values.
 */
module.exports = {
  SourceType,
  Revision,
  NetworkPolicy,
  SandboxImage,
  SourceSpec,
  SnapshotInfo,
  SandboxConfig,
  BattleConfig,
  EvaluationMetric,
  DiffRange,
  BenchmarkResult,
  AgentResult,
  ContainerState,
};