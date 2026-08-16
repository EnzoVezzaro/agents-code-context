# 02 — "Markdown Is All You Need": Readings & Alignment

> **TLDR:** a growing body of writing argues that Markdown —
> not protocols, not frameworks, not bespoke agents — is becoming the
> interface of the AI era. ACC agrees, and is an attempt to take the
> conversation one step further: make the *repository itself* the
> self-describing surface any agent can read.
>
> The personal origin story is on
> [Medium — Markdown Is All You Need, So I Built ACC](https://medium.com/@enzovezzaro/markdown-is-all-you-need-so-i-built-acc-6f9f7283b758).

The title is a riff on **Vaswani et al., ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) (2017)** —
the paper that gave the world the transformer. Its title was a
provocation dressed as a conclusion: strip away the complexity, and one
mechanism does the work. The writing below applies the same provocation
to agent interfaces: strip away the protocol ceremony, and a plain
Markdown file does the work.

## The Readings

| # | Author / Source | Piece | Core claim |
|---|-----------------|-------|------------|
| 1 | Vaswani et al., 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | One mechanism — attention — is all the transformer needs. The title pattern every later piece riffs on. |
| 2 | Jack Palevich, 2025 | [Markdown is all you need to get LLMs to read your source code](https://jackpal.github.io/2025/03/07/Create_a_prompt_from_your_sources.html) | Walk a source tree, dump it into one Markdown file with named code blocks — file names and structure are context. |
| 3 | Bhavesh Yeole, 2026 | [Markdown is all you need!?](https://medium.com/@byeole88/markdown-is-all-you-need-1b8ffb2c9ab6) | LLMs are pattern machines: curated Markdown context beats tool-fetched slop; everything can be a specification. |
| 4 | Hartley Brody, 2026 | [Markdown is the new source code](https://blog.hartleybrody.com/markdown-research-planning/) | Planning/research docs in `.md` become the source of truth; the code becomes a low-level implementation detail. |
| 5 | York Yong Yeo, 2026 | [Markdown is All You Need](https://www.linkedin.com/pulse/markdown-all-you-need-york-yong-yeo-h6n9c) | Models were trained on Markdown structure; the industry has converged on `.md` (CLAUDE.md, AGENTS.md, SKILL.md, copilot-instructions.md). |
| 6 | Gouri Shankar Swamy, 2026 | [Markdown Is the New Source Code](https://www.linkedin.com/pulse/markdown-new-source-code-gouri-shankar-swamy-nn6cc) | From syntax to structure: specs over scripts; Markdown decouples intent from intelligence and is LLM-agnostic. |
| 7 | Júlio Falbo, 2026 | [Markdown is the New API](https://juliofalbo.medium.com/markdown-is-the-new-api-how-skill-md-and-ai-gateways-unlock-ai-native-organizations-e929d05c0470) | SKILL.md as the interface to tools; a good README can replace an entire integration layer; Markdown + gateways are complementary. |
| 8 | Eric Broda / OpenClaw, 2026 | [Replacing MCP with Skills](https://www.linkedin.com/posts/ericbroda_jochen-madler-is-a-making-a-very-credible-activity-7425247766559469569-gypZ) | "Skills win the hackathon, protocols pass the audit" — velocity vs. governance, both have a place. |
| 9 | JUMON, 2026 | [JUMON.md](https://jumon.md/) | Define, manage, and execute AI workflows in Markdown files — workflow orchestration as Markdown. |
| 10 | N+1 Blog, 2026 | [Scratch: Structured Scratchpads for Coding Agents](https://nikiforovall.blog/ai/2026/06/08/scratch.html) | The context window is finite; agents work better when they externalize memory to durable Markdown files on disk. |
| 11 | BSWEN, 2026 | [What is Spec-Driven Development for AI Coding?](https://docs.bswen.com/blog/2026-04-09-spec-driven-development-explained/) | Six SDD primitives; "Markdown is the new source code, and code is the new assembly"; context is a budget. |
| 12 | Mr. Kelly (SandAgent), 2026 | [Coding Agent is All You Need: Don't Build Agents, Redirect Them](https://github.com/mr-kelly) | Don't build bespoke agents — redirect capable coding agents into domain experts via Markdown templates (~300× less effort). |

## Where We Agree

Every piece above makes a claim ACC is built on:

- **Context is a budget.** Nothing should load by default. (BSWEN;
  Yeo's ~50k-token MCP vs ~200-token SKILL.md comparison.) ACC's
  `acc context` assembles *progressive* context — only what a path needs,
  at the depth you ask for.
- **Curated Markdown beats fetched slop.** (Yeole.) ACC's contracts are
  human-curated, version-controlled files living next to the code — not
  a retrieval result.
- **Structure is the interface.** (Yeole, Yeo, Swamy, Falbo.) Models
  were trained on Markdown; headers, lists, and fences are a dialect
  they speak natively.
- **Memory must live on disk, not in the window.** (N+1 Blog.) ACC's
  `.acc-memory.md` is durable, greppable, diffable agent memory that
  survives context rollovers and agent switches.
- **Plans and specs are first-class artifacts.** (Brody, BSWEN, JUMON.)
  ACC's `AGENTS.md` contracts, workflows, and standards are committed,
  reviewed, versioned Markdown — not chat history.
- **Don't build agents, redirect them.** (Mr. Kelly.) ACC's instruction
  surface steers any capable coding agent; the framework is the
  instructions, not a bespoke agent.
- **The standard surface must stay plain Markdown.** (The whole
  ecosystem.) ACC never forks `AGENTS.md`, never adds a schema, and
  never requires ACC-specific tooling.

## Where ACC Takes It Further

The readings mostly describe *workflows* — how an individual or an
organization uses Markdown with an agent. ACC's bet is that the
**repository** should carry the context, not the workflow, and certainly
not the tool:

- **The repo is the product.** Knowledge lives next to the code it
  describes (`AGENTS.md`, `.acc-memory.md`), so it moves when the code
  moves and never goes stale in a central docs folder.
- **The graph is derived, not maintained.** Rather than asking you to
  maintain `graph.yaml`, ACC derives the architecture graph at query
  time from declared facts (`AGENTS.md`) + discovered facts (source
  imports) + the filesystem. No drift, no hand-maintained artifact.
- **Provenance everywhere.** Every fact carries its kind — declared,
  discovered, inferred. Declared facts win; inferred facts are never
  asserted as authoritative. This is ACC's answer to "how do we trust
  the context we hand the agent?"
- **Deterministic validation.** Stable `ACC0xx` diagnostics and a stable
  JSON schema give you the "gates outside" half of spec-driven
  development — feedback agents can act on without re-interpreting.
- **Agent-agnostic by construction.** ACC is a strict superset of the
  agents.md standard: remove `.acc/` and the CLI and you still have a
  valid `AGENTS.md` repository. Context persistence across agents is a
  property of the repository, not the agent.

### On the skills-vs-MCP debate

ACC does not take a side. The repository is the neutral surface
underneath both:

- **Standard surface, verbatim** — `AGENTS.md` per the agents.md
  standard (root + nested, nearest file wins, no schema).
- **Skills** — interoperates with [SKILL.md](https://agentskills.io/)
  packages from `.agents/skills/`, and manages its own under
  `.acc/config/skills/` in the same format.
- **MCP** — tool bridges reference standard
  [MCP](https://modelcontextprotocol.io/) server configs; ACC does not
  define a competing protocol.

Skills win the hackathon, protocols pass the audit, and the repository —
plain Markdown — is what both sides read.

## The Readings in ACC's Own Documentation

- The philosophy (why the repo, why no lock-in):
  [01 — Philosophy](./01-philosophy.md)
- The graph model and truth categories:
  [04 — Epistemology & Graph](./04-epistemology.md)
- Progressive, provenance-tagged context:
  [06 — Context Engine](./06-context-engine.md)
- Deterministic gates and stable codes:
  [07 — Diagnostic Codes](./07-diagnostic-codes.md)
- Durable, gitignored agent memory:
  [09 — Memory Semantics](./09-memory-semantics.md)
- Writing the contracts agents read:
  [10 — AGENTS.md Authoring Guide](./10-authoring-guide.md)
- Coordinating many agents over the same graph:
  [11 — Multi-Agent Orchestration](./11-multi-agent-orchestration.md)

## Credits

Thanks to every author above, and to the open-source community — the
AGENTS.md ecosystem, the skills authors, the MCP folks, the people
building agents in public — for the revolutionary contributions you're
making. Gracias por los aportes. 🙌
