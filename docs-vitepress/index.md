---
title: ACC — Agent Code Context
layout: home
description: A framework and CLI for making software repositories agent-native, navigable, and self-describing
hero:
  name: ACC
  text: A framework and CLI for making software repositories agent-native
  tagline: Give any codebase a map any agent can read
  actions:
    - context: /reference/what-is-acc
      text: What is ACC?
      primary: true
    - context: /reference/navigation
      text: How agents navigate
---
# ACC — Agent Code Context

A framework and CLI that makes any repository agent-native, navigable, and self-describing — without requiring an ACC-specific agent.

<article>
<h2>What is ACC?</h2>
<p>ACC is a convention layered on top of the standard <code>AGENTS.md</code> ecosystem. It adds a project-level control plane (<code>.agents/acc/</code>), provenance-tagged context, and a deterministic CLI — but the repository itself stays fully readable by any coding agent that can read Markdown.</p>
<ul>
<li><strong>Agent-agnostic.</strong> No ACC-specific agent, wrapper, or runtime required. Code agents read <code>AGENTS.md</code> and follow the framework as plain Markdown.</li>
<li><strong>Hard invariant.</strong> Removing <code>.agents/</code> or the <code>acc</code> CLI leaves a perfectly valid <code>AGENTS.md</code> repository. ACC augments; it never replaces.</li>
<li><strong>Derived graph.</strong> The architecture graph is computed on demand — declared in <code>AGENTS.md</code>, discovered from code. No hand-maintained <code>graph.yaml</code> to go stale.</li>
<li><strong>Provenance everywhere.</strong> Every fact carries a source tag: declared, discovered, or inferred. Nothing is asserted without provenance.</li>
<li><strong>Offline & safe.</strong> No telemetry, no uploads, no executed scripts. Safe to run on untrusted repositories.</li>
</ul>
</article>

<article>
<h2>How agents navigate</h2>
<p>Every ACC repo tells the same story top to bottom. An agent starts at the root <code>AGENTS.md</code>, walks down into the functionality it needs, reads that boundary's contract and memory, and only then touches source. No special client, no protocol — just files in an order that makes sense.</p>
<ol style="font-family:var(--sf-mono),monospace;font-size:13px;color:#111;line-height:1.7;padding-left:20px;max-width:42ch">
<li><strong>Read</strong> the root <code>AGENTS.md</code> for project-wide context.</li>
<li><strong>Open</strong> the functionality's <code>AGENTS.md</code> for its boundaries and constraints.</li>
<li><strong>Check</strong> <code>.acc-memory.md</code> for hard-won knowledge from prior sessions.</li>
<li><strong>Understand</strong> relationships from the derived graph.</li>
<li><strong>Make</strong> the change, then <strong>validate</strong> with <code>acc check</code> / <code>acc impact</code>.</li>
</ol>
</article>

<article>
<h2>What the CLI does</h2>
<p>The <code>acc</code> CLI provides deterministic context, validation, and graph derivation — but the framework doesn't depend on it. An agent can understand an ACC repo by reading files alone. Use the CLI for speed and guarantees.</p>

<ul>
<li><code>acc context <path></code> — Generate focused, progressive context for a path. Supports <code>--depth 0..N</code>.</li>
<li><code>acc check</code> — Validate broken references, missing contracts, forbidden dependencies, duplicate ownership, stale docs. Returns stable <code>ACC0xx</code> codes.</li>
<li><code>acc graph [path]</code> — Generates the derived architecture graph (text, mermaid, dot, json).</li>
<li><code>acc impact <path></code> — Returns affected tests, direct/transitive dependents, and constraints.</li>
<li><code>acc discover</code> — Generates architectural suggestions based on diffs between declared contracts and discovered code (dry-run by default).</li>
<li><code>acc document <path></code> — Generates a conservative <code>AGENTS.md</code> template for undocumented features.</li>
</ul>
</article>

<article>
<h2>Reference</h2>
<nav>
<h4>Documentation</h4>
<ul>
<li><a href="/reference/what-is-acc">What is ACC?</a></li>
<li><a href="/reference/navigation">How agents navigate</a></li>
<li><a href="/reference/cli">CLI reference</a></li>
<li><a href="/reference/epistemology">Epistemology & provenance</a></li>
<li><a href="/reference/diagnostics">Diagnostic codes</a></li>
<li><a href="/reference/memory">Memory semantics</a></li>
</ul>
</nav>
<nav>
<h4>Docs</h4>
<ul>
<li><a href="philosophy">Philosophy</a></li>
<li><a href="repository-structure">Repository structure</a></li>
<li><a href="epistemology">Epistemology</a></li>
<li><a href="cli-commands">CLI commands</a></li>
<li><a href="context-engine">Context engine</a></li>
<li><a href="diagnostic-codes">Diagnostic codes</a></li>
<li><a href="json-schema">JSON schema</a></li>
<li><a href="memory-semantics">Memory semantics</a></li>
<li><a href="authoring-guide">AGENTS.md authoring guide</a></li>
</ul>
</ul>
</nav>
</article>
---
title: Home
description: ACC homepage
---