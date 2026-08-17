# The Over-Feeding Problem (and how ACC avoids it)

**The problem:** a large repository, fed to an agent whole, overwhelms
it. Every extra irrelevant file competes with the relevant one for
attention — and for tokens. Models degrade on tasks when the prompt is
padded with unrelated context, and the cost grows linearly with what
you feed. This is the over-feeding problem: context explosion that
makes agents slower, more expensive, and less accurate at once.

**ACC's answer is structural:**

1. **The graph is a routing index, not a context dump.** It stores
   ids, types, hashes and provenance — never prose, never code, never
   descriptions (~180 bytes/item, flat across sizes).
2. **Context is assembled per scope, on demand.** `acc context` and
   `acc slice` return only what a path needs. The engine reviews one
   boundary at a time with a hard budget (see `engine-limits.md`).
3. **The engine is trigger-gated.** The AI phase runs only after
   enough real change accumulates (default 3 commits), and only on the
   changed code.
4. **Determinism is the floor.** The scan, graph and dependency gaps
   are deterministic and catch drift at every scale regardless of the
   AI.

**As the agent:** prefer `acc context <path>` / `acc slice <path>` over
reading whole directories; let ACC tell you what is related before you
open files.
