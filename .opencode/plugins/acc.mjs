// acc — OpenCode plugin.
//
// Exposes the deterministic `acc` CLI as a native OpenCode tool, so the
// agent can run ACC commands (context, graph, slice, check, ...) without
// leaving the tool interface. Falls back to `npx acc-code-context` when the CLI
// is not installed globally.
//
// OpenCode loads this via opencode.json:
//   { "plugin": ["./.opencode/plugins/acc.mjs"] }

import { tool } from "@opencode-ai/plugin";
import { execSync } from "node:child_process";

const MAX_OUTPUT = 10 * 1024 * 1024; // 10 MB

function runAcc(args, cwd) {
  const command = `acc ${args}`;
  const fallback = `npx --yes acc-code-context ${args}`;
  try {
    return execSync(command, { cwd, encoding: "utf8", maxBuffer: MAX_OUTPUT });
  } catch (err) {
    try {
      return execSync(fallback, { cwd, encoding: "utf8", maxBuffer: MAX_OUTPUT });
    } catch (err2) {
      throw new Error(
        `acc failed (${command}): ${err2.stderr || err2.message}\n` +
          "Install the CLI with: npm install -g acc-code-context",
      );
    }
  }
}

export const ACCPlugin = async ({ directory, worktree }) => {
  const cwd = directory || worktree || process.cwd();
  return {
    tool: {
      acc: tool({
        description:
          "Run a deterministic ACC CLI command against the repository. " +
          "ACC understands AGENTS.md repositories: context <path> (what owns/governs/depends on a scope), " +
          "graph (architecture), slice <path> (compact AI-optimized slice), dependencies/dependents/impact <path>, " +
          "search <query>, inspect <path>, check (ACC0xx violations), tools (capability manifest). " +
          "Same repo + same flags = byte-identical output. Offline, no API keys.",
        args: {
          command: tool.schema.string().describe(
            "The acc command and its arguments, e.g. \"context src/payments --json\" or \"check\"",
          ),
        },
        async execute(args) {
          try {
            const out = runAcc(args.command, cwd);
            return out.length ? out : "(no output)";
          } catch (err) {
            return `ERROR: ${err.message}`;
          }
        },
      }),
    },
  };
};
