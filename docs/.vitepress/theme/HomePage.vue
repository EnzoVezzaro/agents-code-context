<script setup>
// Progressive reveal — gated on IntersectionObserver, skipped on reduced motion.
import { onMounted } from 'vue'
import { withBase } from 'vitepress'

onMounted(() => {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const els = document.querySelectorAll('.reveal')
  if (!els.length || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in')
          io.unobserve(en.target)
        }
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )
  els.forEach((e) => io.observe(e))
})
</script>

<template>
  <div class="site">
    <!-- TOP BAR -->
    <div class="topbar">
      <div class="wrap">
        <a :href="withBase('/')" class="brand"><span class="glyph">acc</span>Agent&nbsp;Code&nbsp;Context</a>
        <nav class="nav-links" aria-label="Primary">
          <a href="#cli">Commands</a>
          <a href="#flow">Navigation</a>
          <a href="#layers">Layers</a>
          <a href="#diagnostics">Diagnostics</a>
        </nav>
        <div class="nav-actions">
          <a class="btn btn-ghost" :href="withBase('/philosophy')">Docs</a>
          <a class="btn btn-primary" href="https://github.com/EnzoVezzaro/agents-code-context" target="_blank" rel="noopener">GitHub<span class="arr">↗</span></a>
        </div>
      </div>
    </div>

    <!-- HERO -->
    <header class="hero">
      <div class="wrap">
        <div class="hero-grid">
          <div>
            <div class="hero-eyebrow">v0.1 · specification</div>
            <h1>Give any codebase <em>a map</em> any agent can read.</h1>
            <p class="lede">ACC is a framework that makes a repository <strong>self-describing</strong>: its boundaries, dependencies, owners, and constraints become plain files any coding agent can understand. A CLI is included, but the repository itself is the product — not the tool.</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#what">What is ACC?<span class="arr">→</span></a>
              <a class="btn btn-ghost" href="#flow">How agents navigate</a>
            </div>
            <div class="hero-meta-row">
              <span><b>AGENTS.md</b> native</span>
              <span><b>Any</b> agent</span>
              <span><b>0</b> lock-in</span>
              <span><b>Offline</b> by design</span>
            </div>
          </div>

          <figure class="schematic reveal">
            <figcaption class="schematic-head">
              <span><span class="dot"></span>derived graph · <code style="color:var(--ink)">acc graph</code></span>
              <span>oklch 355 · 155</span>
            </figcaption>
            <svg viewBox="0 0 360 280" role="img" aria-label="Derived architecture graph: audio depends on database and logging; app depends on audio; tests depend on audio.">
              <g stroke-width="1.25" fill="none">
                <line x1="80" y1="70" x2="200" y2="140" stroke="var(--primary)" />
                <line x1="80" y1="70" x2="200" y2="210" stroke="var(--primary)" />
                <line x1="80" y1="210" x2="80" y2="70" stroke="var(--cool)" stroke-dasharray="4 3" />
                <line x1="280" y1="70" x2="80" y2="70" stroke="var(--cool)" stroke-dasharray="4 3" />
              </g>
              <g font-family="var(--mono)" font-size="11" text-anchor="middle">
                <rect x="44" y="54" width="72" height="32" rx="5" fill="var(--bg)" stroke="var(--ink)" />
                <text x="80" y="73" fill="var(--ink)" font-weight="600">audio</text>
                <rect x="44" y="194" width="72" height="32" rx="5" fill="var(--bg)" stroke="var(--ink)" />
                <text x="80" y="213" fill="var(--ink)">app</text>
                <rect x="164" y="124" width="86" height="32" rx="5" fill="var(--bg)" stroke="var(--primary)" stroke-width="1.5" />
                <text x="207" y="143" fill="var(--primary)" font-weight="600">database</text>
                <rect x="164" y="194" width="86" height="32" rx="5" fill="var(--bg)" stroke="var(--primary)" stroke-width="1.5" />
                <text x="207" y="213" fill="var(--primary)" font-weight="600">logging</text>
                <rect x="244" y="54" width="64" height="32" rx="5" fill="var(--bg)" stroke="var(--cool)" stroke-width="1.5" stroke-dasharray="4 3" />
                <text x="276" y="73" fill="var(--cool)">tests</text>
              </g>
              <g font-family="var(--mono)" font-size="9" fill="var(--muted)">
                <text x="150" y="100">declared</text>
                <text x="150" y="246">declared</text>
                <text x="100" y="148" fill="var(--cool)">discovered</text>
                <text x="178" y="50" fill="var(--cool)">discovered</text>
              </g>
            </svg>
            <figcaption>Declared edges (red) come from <b>AGENTS.md</b>. Discovered edges (cool dashed) come from <b>code imports</b>. ACC never asserts the latter as authoritative architecture.</figcaption>
          </figure>
        </div>
      </div>
    </header>

    <!-- WHAT IS ACC -->
    <section class="caps" id="what">
      <div class="wrap">
        <div class="section-head" style="margin-bottom:40px">
          <div class="label">what acc is</div>
          <h2>A convention for repos, not an agent you install.</h2>
          <p>ACC is a way of organizing a repository so that <strong>any</strong> coding agent — Codex, Claude Code, Cursor, Gemini, a local model, a future tool — can walk in and understand the architecture without a manual. It layers on the files agents already read: <code>AGENTS.md</code> contracts, a <code>.acc/config/</code> control plane, and local memory. An optional <code>acc</code> CLI accelerates the work, but the repository is intelligible on its own.</p>
        </div>
        <div class="caps-grid">
          <div class="cap">
            <h3><span class="mark">◆</span>Agent-agnostic</h3>
            <p>No ACC agent, wrapper, or runtime required. Any agent reads <code>AGENTS.md</code> and follows the framework as plain Markdown. Switch agents tomorrow; your accumulated context stays in the repo.</p>
          </div>
          <div class="cap">
            <h3><span class="mark">◆</span>Hard invariant</h3>
            <p>Remove <code>.acc/</code> and the <code>acc</code> CLI, and you still have a perfectly valid <code>AGENTS.md</code> repository. ACC augments the ecosystem; it never replaces it.</p>
          </div>
          <div class="cap">
            <h3><span class="mark">◆</span>Derived graph</h3>
            <p>The architecture graph is computed on demand — declared in <code>AGENTS.md</code>, discovered from code. No hand-maintained <code>graph.yaml</code> to go stale.</p>
          </div>
          <div class="cap">
            <h3><span class="mark">◆</span>Provenance everywhere</h3>
            <p>Every fact carries a source: declared, discovered, or inferred. Nothing is asserted without provenance, so authority and suggestion are never confused.</p>
          </div>
          <div class="cap">
            <h3><span class="mark">◆</span>Offline &amp; safe</h3>
            <p>No telemetry, no uploads, no executed scripts. Safe to run on untrusted repositories; the repository is the sole source of truth.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CLI -->
    <section class="section" id="cli">
      <div class="wrap">
        <div class="section-head">
          <div class="label">one way to interact</div>
          <h2>The CLI is a tool, not the product.</h2>
          <p>The <code>acc</code> CLI accelerates the framework: deterministic context, validation, and graph derivation. But the framework doesn't depend on it — an agent can understand an ACC repo by reading files alone. The CLI is for when you want speed and guarantees.</p>
        </div>

        <div class="cli-bento">
          <article class="cell span3">
            <div class="name">acc context <span class="bracket">&lt;path&gt;</span></div>
            <p class="blurb">Assembles focused, progressive context for a path — the hierarchy, contracts, dependencies, and constraints an agent needs before touching code. Every line carries provenance; <code>--depth</code> controls how far it reaches.</p>
            <div class="term"><span class="p">$</span> acc context src/audio <span class="f">--depth</span> 1
<span class="s">## Hierarchy</span>
  project root        <span class="s">Source: AGENTS.md</span>
  └─ src/audio/       <span class="s">Source: src/audio/AGENTS.md</span>

<span class="s">## Dependencies (depth=1)</span>
Declared:
  → src/database/   <span class="s">Source: src/audio/AGENTS.md</span>
Discovered:
  ⚠ src/ui/        <span class="s">Discovered from imports — undeclared</span></div>
          </article>

          <article class="cell span3">
            <div class="name">acc check</div>
            <p class="blurb">Validate broken references, missing contracts, forbidden dependencies, duplicate ownership, stale docs. Returns stable <code>ACC0xx</code> codes with severity and path.</p>
            <div class="term"><span class="p">$</span> acc check
<span class="warn">ACC022</span>  warn    src/audio/mod.rs
  discovered dep 'audio → ui' not declared
<span class="ok">ACC040</span>  info    .lock
  no analyzer for extension
<span class="k">→ 1 warning, 0 errors</span></div>
          </article>

          <article class="cell span2">
            <div class="name">acc inspect <span class="bracket">&lt;path&gt;</span></div>
            <p class="blurb">Roles, owners, dependencies, and constraints for a single path.</p>
            <div class="mini-out"><span class="tag">owner</span> audio-team</div>
          </article>

          <article class="cell span2">
            <div class="name">acc graph <span class="bracket">[path]</span></div>
            <p class="blurb">The derived graph in <code>text</code>, <code>mermaid</code>, <code>dot</code>, or <code>json</code>.</p>
            <div class="mini-out"><span class="tag">format</span> --format mermaid</div>
          </article>

          <article class="cell span2">
            <div class="name">acc impact <span class="bracket">&lt;path&gt;</span></div>
            <p class="blurb">Affected tests and transitive dependents. Answers "what could break?"</p>
            <div class="mini-out"><span class="tag">radius</span> 6 dependents</div>
          </article>

          <article class="cell span3">
            <div class="name">acc discover</div>
            <p class="blurb">Architectural suggestions from the declared/discovered diff. <strong>Never silently rewrites the repo</strong> — dry-run by default, <code>--apply</code> prompts per change.</p>
            <div class="mini-out"><span class="tag">suggest</span> declare audio → ui</div>
          </article>

          <article class="cell span3">
            <div class="name">acc document <span class="bracket">&lt;path&gt;</span></div>
            <p class="blurb">Conservative <code>AGENTS.md</code> templates for undocumented features. With <code>--from-discovery</code>, inferred fields are marked <code>&lt;!-- inferred --&gt;</code> for human review.</p>
            <div class="mini-out"><span class="tag">write</span> src/audio/AGENTS.md</div>
          </article>
        </div>
      </div>
    </section>

    <!-- NAVIGATION FLOW -->
    <section class="section flow" id="flow">
      <div class="wrap">
        <div>
          <div class="section-head" style="margin-bottom:32px">
            <div class="label">how agents navigate</div>
            <h2>Read the contract, then the code.</h2>
            <p>Every ACC repo tells the same story top to bottom. An agent starts at the root <code>AGENTS.md</code>, walks down into the functionality it needs, reads that boundary's contract and memory, and only then touches source. No special client, no protocol — just files in an order that makes sense.</p>
          </div>
          <ol style="font-family:var(--mono);font-size:13px;color:var(--ink);line-height:1.7;padding-left:20px;max-width:42ch">
            <li><strong>Read</strong> the root <code>AGENTS.md</code> for project-wide context.</li>
            <li><strong>Open</strong> the functionality's <code>AGENTS.md</code> for its boundaries and constraints.</li>
            <li><strong>Check</strong> <code>.acc-memory.md</code> for hard-won knowledge from prior sessions.</li>
            <li><strong>Understand</strong> relationships from the derived graph.</li>
            <li><strong>Make</strong> the change, then <strong>validate</strong> with <code>acc check</code> / <code>acc impact</code>.</li>
          </ol>
        </div>
        <div class="flow-diagram">
          <svg viewBox="0 0 400 360" role="img" aria-label="Navigation flow: AGENTS.md, then .acc/config/, then a functionality directory, then functionality AGENTS.md, then .acc-memory.md, then source, then the derived graph.">
            <g stroke="var(--hair-strong)" stroke-width="1.25" fill="none">
              <line x1="200" y1="44" x2="200" y2="76" />
              <line x1="200" y1="104" x2="200" y2="136" />
              <line x1="200" y1="164" x2="200" y2="196" />
              <line x1="200" y1="224" x2="200" y2="256" />
              <line x1="200" y1="284" x2="200" y2="316" />
            </g>
            <g fill="var(--primary)">
              <polygon points="200,80 196,72 204,72" />
              <polygon points="200,140 196,132 204,132" />
              <polygon points="200,200 196,192 204,192" />
              <polygon points="200,260 196,252 204,252" />
              <polygon points="200,320 196,312 204,312" />
            </g>
            <g font-family="var(--mono)" font-size="12" text-anchor="middle">
              <rect x="120" y="20" width="160" height="24" rx="4" fill="var(--bg)" stroke="var(--ink)" />
              <text x="200" y="37" fill="var(--ink)" font-weight="600">AGENTS.md</text>
              <rect x="110" y="80" width="180" height="24" rx="4" fill="var(--bg)" stroke="var(--primary)" stroke-width="1.5" />
              <text x="200" y="97" fill="var(--primary)" font-weight="600">.acc/config/</text>
              <rect x="120" y="140" width="160" height="24" rx="4" fill="var(--bg)" stroke="var(--ink)" />
              <text x="200" y="157" fill="var(--ink)">functionality/</text>
              <rect x="96" y="200" width="208" height="24" rx="4" fill="var(--bg)" stroke="var(--ink)" />
              <text x="200" y="217" fill="var(--ink)" font-weight="600">functionality/AGENTS.md</text>
              <rect x="86" y="260" width="228" height="24" rx="4" fill="var(--bg)" stroke="var(--ink)" stroke-dasharray="4 3" />
              <text x="200" y="277" fill="var(--muted)" font-weight="600">functionality/.acc-memory.md</text>
              <rect x="160" y="320" width="80" height="24" rx="4" fill="var(--bg)" stroke="var(--ink)" />
              <text x="200" y="337" fill="var(--ink)">source</text>
            </g>
            <g font-family="var(--mono)" font-size="9" fill="var(--muted)">
              <text x="298" y="97">control plane</text>
              <text x="324" y="157">boundary</text>
              <text x="324" y="277" fill="var(--muted)">gitignored</text>
            </g>
          </svg>
        </div>
      </div>
    </section>

    <!-- PROVENANCE -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div class="label">why provenance matters</div>
          <h2>Know where every fact came from.</h2>
          <p>ACC never confuses what an architect <em>wrote</em> with what the code <em>does</em> with what the tool <em>guessed</em>. Every piece of output is tagged declared, discovered, or inferred — so an agent trusts the right source and a human reviews the rest.</p>
        </div>
        <div class="prov-pair">
          <div class="prov-legend">
            <div class="prov-item declared">
              <span class="swatch" aria-hidden="true"></span>
              <div>
                <h4>Declared</h4>
                <p>Authoritative. Written in <code>AGENTS.md</code> — Dependencies, Ownership, Constraints. Wins over discovered when they disagree.</p>
              </div>
            </div>
            <div class="prov-item discovered">
              <span class="swatch" aria-hidden="true"></span>
              <div>
                <h4>Discovered</h4>
                <p>Observational. From language analyzers and the filesystem. The ground truth of what the code does — second-class to declared intent for architecture.</p>
              </div>
            </div>
            <div class="prov-item inferred">
              <span class="swatch" aria-hidden="true"></span>
              <div>
                <h4>Inferred</h4>
                <p>None. Suggestions from <code>acc discover</code>. <strong>Never asserted as authoritative</strong> — always labelled, always awaiting human promotion.</p>
              </div>
            </div>
          </div>

          <div class="term-block"><div class="head"><span class="dotr"></span>acc check --json</div>{
  <span class="s">"schema_version"</span>: 1,
  <span class="s">"diagnostics"</span>: [
    {
      <span class="s">"code"</span>: <span class="f">"ACC022"</span>,
      <span class="s">"severity"</span>: <span class="f">"warn"</span>,
      <span class="s">"path"</span>: <span class="f">"src/audio/mod.rs"</span>,
      <span class="s">"provenance"</span>: {
        <span class="s">"kind"</span>: <span class="f">"discovered"</span>,
        <span class="s">"source"</span>: <span class="f">"Rust imports"</span>
      }
    }
  ]
}</div>
        </div>
      </div>
    </section>

    <!-- LAYERS -->
    <section class="section" id="layers">
      <div class="wrap">
        <div class="section-head">
          <div class="label">three layers</div>
          <h2>Convention, memory, and tooling.</h2>
          <p>ACC follows the established <code>AGENTS.md</code> convention rather than competing with it. New ACC-specific metadata augments standards — it never replaces them.</p>
        </div>
        <div class="layers">
          <article class="layer">
            <div class="tag"><span class="pri">●</span> standard · committed</div>
            <h3>AGENTS.md</h3>
            <p class="desc">The primary agent interface. Plain Markdown with conventional sections — Purpose, Responsibilities, Ownership, Dependencies, Constraints. No frontmatter, no schema, no decorators.</p>
            <pre class="visual"><span class="c">## Dependencies</span>
- src/database
- src/logging

<span class="c">## Constraints</span>
- Must not depend on src/ui.</pre>
            <a class="link" :href="withBase('/authoring-guide')">Authoring guide
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
          </article>

          <article class="layer">
            <div class="tag"><span class="pri">●</span> control plane · committed</div>
            <h3>.acc/config/</h3>
            <p class="desc">Project-level configuration, agent profiles, reusable workflows, and standards. All Markdown, all committed, all readable by any agent that walks a directory.</p>
            <pre class="visual"><span class="m">.acc/config/</span>
├─ config.yaml
├─ agents/architect.md
├─ workflows/feature.md
└─ standards/architecture.md</pre>
            <a class="link" :href="withBase('/repository-structure')">Repository structure
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
          </article>

          <article class="layer">
            <div class="tag"><span class="pri">●</span> durable memory · local</div>
            <h3>.acc-memory.md</h3>
            <p class="desc">Functionality-local, agent-written, gitignored. Gotchas, invariants, tried-and-rejected — knowledge the next agent shouldn't have to rediscover. Plain Markdown; <code>cat</code> is the fallback.</p>
            <pre class="visual"><span class="c">## Gotchas</span>
- decode() is non-reentrant.

<span class="c">## Tried &amp; Rejected</span>
- Split into a crate; overhead not worth it.</pre>
            <a class="link" :href="withBase('/memory-semantics')">Memory semantics
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
          </article>
        </div>
      </div>
    </section>

    <!-- DIAGNOSTICS -->
    <section class="section" id="diagnostics">
      <div class="wrap">
        <div class="section-head">
          <div class="label">stable contract</div>
          <h2>Diagnostics you can build CI on.</h2>
          <p><code>ACC0xx</code> codes are stable forever — renumbering is forbidden. Severities are fixed at minting. Agents and build gates consume <code>acc check --json</code>, not terminal prose.</p>
        </div>
        <div class="diag-table">
          <div class="diag-row head"><span>Code</span><span>Severity</span><span>Trigger</span><span>Message</span></div>
          <div class="diag-row"><span class="code">ACC022</span><span class="sev warn">warn</span><span class="trigger">Discovered dep not declared</span><span class="msg">missing-dependency suggestion</span></div>
          <div class="diag-row"><span class="code">ACC024</span><span class="sev err">error</span><span class="trigger">Forbidden dependency detected</span><span class="msg">forbidden_deps rule in config</span></div>
          <div class="diag-row"><span class="code">ACC030</span><span class="sev err">error</span><span class="trigger">Duplicate ownership</span><span class="msg">two AGENTS.md claim same path</span></div>
          <div class="diag-row"><span class="code">ACC053</span><span class="sev warn">warn</span><span class="trigger">Memory committed to git</span><span class="msg">.acc-memory.md should be gitignored</span></div>
          <div class="diag-row"><span class="code">ACC080</span><span class="sev err">error</span><span class="trigger">Path escapes project root</span><span class="msg">untrusted-repo safety stop</span></div>
        </div>
      </div>
    </section>

    <!-- GITHUB: ABOUT / RELEASES / PACKAGES -->
    <section class="section" id="github">
      <div class="wrap">
        <div class="section-head">
          <div class="label">open source</div>
          <h2>About, releases, and packages.</h2>
          <p>Everything lives on GitHub and npm — MIT licensed, no telemetry, no lock-in.</p>
        </div>
        <div class="github-grid">
          <article class="gh-card">
            <h3>About</h3>
            <p class="desc">ACC — Agent Code Context. A convention + optional CLI that makes any software repository agent-native, navigable, and self-describing.</p>
            <p class="meta">MIT License · Agent-agnostic · Offline-first · Deterministic</p>
            <a class="link" href="https://github.com/EnzoVezzaro/agents-code-context" target="_blank" rel="noopener">github.com/EnzoVezzaro/agents-code-context
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
          </article>
          <article class="gh-card">
            <h3>Releases</h3>
            <p class="desc">Versioned releases on GitHub with changelogs — every <code>v0.x</code> tagged and documented.</p>
            <a class="link" href="https://github.com/EnzoVezzaro/agents-code-context/releases" target="_blank" rel="noopener">View releases
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
          </article>
          <article class="gh-card">
            <h3>Packages</h3>
            <p class="desc">Published to npm: <code>acc-agents</code> — install with <code>npm i -g acc-agents</code>.</p>
            <a class="link" href="https://www.npmjs.com/package/acc-agents" target="_blank" rel="noopener">npm package
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
            <a class="link" href="https://github.com/EnzoVezzaro/agents-code-context/packages" target="_blank" rel="noopener">GitHub packages
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16" /><path d="M2 12H22" /></svg>
            </a>
          </article>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer>
      <div class="wrap">
        <div class="foot-grid">
          <div class="foot-brand">
            <a :href="withBase('/')" class="brand"><span class="glyph">acc</span>Agent&nbsp;Code&nbsp;Context</a>
            <p>A convention and tooling layer for agent-native repositories. MIT licensed, offline-first, safe on untrusted repos.</p>
          </div>
          <div class="foot-col">
            <h4>Spec</h4>
            <a :href="withBase('/philosophy')">Philosophy</a>
            <a :href="withBase('/repository-structure')">Structure</a>
            <a :href="withBase('/epistemology')">Epistemology</a>
            <a :href="withBase('/philosophy')">All docs</a>
          </div>
          <div class="foot-col">
            <h4>Commands</h4>
            <a :href="withBase('/cli-commands')">CLI spec</a>
            <a :href="withBase('/context-engine')">Context engine</a>
            <a :href="withBase('/diagnostic-codes')">Diagnostic codes</a>
            <a :href="withBase('/json-schema')">JSON schema</a>
          </div>
          <div class="foot-col">
            <h4>Project</h4>
            <a href="https://github.com/EnzoVezzaro/agents-code-context" target="_blank" rel="noopener">About ↗</a>
            <a href="https://github.com/EnzoVezzaro/agents-code-context/releases" target="_blank" rel="noopener">Releases ↗</a>
            <a href="https://github.com/EnzoVezzaro/agents-code-context/packages" target="_blank" rel="noopener">Packages ↗</a>
            <a :href="withBase('/memory-semantics')">Memory</a>
            <a :href="withBase('/authoring-guide')">Authoring guide</a>
            <a href="https://github.com/EnzoVezzaro/agents-code-context/blob/main/AGENTS.md" target="_blank" rel="noopener">AGENTS.md</a>
          </div>
        </div>
        <div class="foot-bottom">
          <span>© 2026 agents-code-context</span>
          <span class="eq">ACC-enhanced = Repository + <span class="pri">AGENTS.md</span> + .acc/</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ---- Design tokens live on :root in custom.css (shared with docs pages) ---- */
.site {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
  font-optical-sizing: auto;
  font-weight: 400;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
  min-height: 100vh;
}
.site::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
  z-index: 100;
}
.site a { color: inherit; text-decoration: none; }
.site ::selection { background: var(--primary); color: var(--bg); }
.site :focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 2px; }
.site h1, .site h2, .site h3 { text-wrap: balance; letter-spacing: -0.02em; font-weight: 700; line-height: 1.05; }
.site h1 { letter-spacing: -0.035em; }
.site p { max-width: 65ch; }
.site code { font-family: var(--mono); font-size: 0.88em; font-variant-ligatures: none; }
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--gut); }

/* ---- Top bar ---- */
.topbar {
  position: sticky; top: 0; z-index: 40;
  background: color-mix(in oklch, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border-bottom: 1px solid var(--hair);
}
.topbar .wrap { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-top: 18px; padding-bottom: 18px; }
.brand { display: inline-flex; align-items: baseline; gap: 10px; font-weight: 700; letter-spacing: -0.03em; font-size: 20px; }
.brand .glyph {
  font-family: var(--mono); font-weight: 600; font-size: 15px;
  color: var(--primary); letter-spacing: 0;
}
.nav-links { display: flex; gap: 1.75rem; }
.nav-links a { font-size: 15px; color: var(--muted); position: relative; padding: 2px 0; transition: color 0.18s ease; }
.nav-links a:hover { color: var(--ink); }
.nav-links a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 1px; background: var(--primary); transform: scaleX(0); transform-origin: left; transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
.nav-links a:hover::after { transform: scaleX(1); }
.nav-actions { display: flex; align-items: center; gap: 10px; }

.btn {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font); font-weight: 600; font-size: 15px;
  padding: 10px 18px; border-radius: 6px;
  border: 1px solid transparent;
  transition: transform 0.12s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  cursor: pointer; white-space: nowrap;
}
.btn:active { transform: translateY(1px); }
.btn-primary { background: var(--primary); color: var(--bg); }
.btn-primary:hover { background: var(--primary-ink); }
.btn-ghost { background: transparent; color: var(--ink); border-color: var(--hair-strong); }
.btn-ghost:hover { border-color: var(--ink); background: var(--surface); }
.btn .arr { display: inline-block; transition: transform 0.18s ease; }
.btn:hover .arr { transform: translateX(2px); }

/* ---- Hero ---- */
.hero { padding: clamp(72px, 11vw, 132px) 0 56px; position: relative; }
.hero .wrap { position: relative; }
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: clamp(32px, 5vw, 72px);
  align-items: start;
}
.hero-eyebrow {
  font-family: var(--mono); font-size: 12px; color: var(--primary);
  letter-spacing: 0.04em; font-weight: 500;
  display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px;
}
.hero-eyebrow::before { content: ''; width: 22px; height: 1px; background: var(--primary); display: inline-block; }
.hero h1 {
  font-size: clamp(2.6rem, 6.2vw, 5.1rem);
  font-weight: 700;
  margin-bottom: 28px;
}
.hero h1 em { font-style: normal; color: var(--primary); font-weight: 800; }
.hero .lede {
  font-size: clamp(1.05rem, 1.6vw, 1.3rem);
  color: var(--ink);
  max-width: 30ch;
  margin-bottom: 36px;
  line-height: 1.45;
}
.hero .lede strong { font-weight: 600; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 48px; }
.hero-meta-row {
  display: flex; gap: 28px; flex-wrap: wrap;
  padding-top: 24px; border-top: 1px solid var(--hair);
  font-family: var(--mono); font-size: 12px; color: var(--muted);
}
.hero-meta-row span b { color: var(--ink); font-weight: 600; }

.schematic {
  position: relative;
  border: 1px solid var(--hair-strong);
  border-radius: 8px;
  background: var(--surface);
  padding: 20px;
  overflow: hidden;
}
.schematic-head {
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--mono); font-size: 11px; color: var(--muted);
  margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--hair);
}
.schematic-head .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); display: inline-block; margin-right: 7px; vertical-align: 1px; }
.schematic svg { width: 100%; height: auto; display: block; }
.schematic figcaption {
  font-family: var(--mono); font-size: 11px; color: var(--muted);
  margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--hair);
  line-height: 1.5;
}
.schematic figcaption b { color: var(--ink); font-weight: 600; }

/* ---- Capability row ---- */
.caps {
  padding: 48px 0 96px;
  border-top: 1px solid var(--hair);
}
.caps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0;
}
.cap { padding: 4px 28px 4px 0; border-right: 1px solid var(--hair); }
.cap:last-child { border-right: none; }
.cap h3 {
  font-size: 1.05rem; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.01em;
  display: flex; align-items: baseline; gap: 8px;
}
.cap h3 .mark { color: var(--primary); font-family: var(--mono); font-size: 0.8em; font-weight: 500; }
.cap p { font-size: 14px; color: var(--muted); line-height: 1.5; max-width: 26ch; }
.cap p strong { color: var(--ink); font-weight: 500; }

/* ---- Section heads ---- */
.section { padding: 80px 0; border-top: 1px solid var(--hair); }
.section-head { margin-bottom: 56px; max-width: 640px; }
.section-head .label {
  font-family: var(--mono); font-size: 12px; color: var(--primary);
  font-weight: 500; letter-spacing: 0.04em; margin-bottom: 14px;
  display: inline-flex; align-items: center; gap: 8px;
}
.section-head .label::before { content: ''; width: 16px; height: 1px; background: var(--primary); }
.section-head h2 {
  font-size: clamp(1.9rem, 3.8vw, 2.8rem);
  margin-bottom: 18px;
}
.section-head p {
  font-size: 1.06rem; color: var(--muted); line-height: 1.55;
}

/* ---- CLI bento ---- */
.cli-bento {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
.cell {
  border: 1px solid var(--hair-strong);
  border-radius: 8px;
  padding: 22px;
  background: var(--bg);
  display: flex; flex-direction: column;
  transition: border-color 0.2s ease, transform 0.2s ease;
  position: relative;
}
.cell:hover { border-color: var(--ink); }
.cell .name {
  font-family: var(--mono); font-size: 14px; font-weight: 600;
  color: var(--ink); margin-bottom: 8px;
}
.cell .name .args, .cell .name .bracket { color: var(--muted); font-weight: 400; }
.cell .name .bracket { color: var(--primary); }
.cell .blurb { font-size: 14px; color: var(--muted); line-height: 1.5; margin-bottom: 16px; max-width: 38ch; }
.cell .blurb code { color: var(--primary-ink); background: var(--surface); padding: 1px 5px; border-radius: 3px; font-size: 0.82em; }
.cell.span3 { grid-column: span 3; }
.cell.span2 { grid-column: span 2; }
.cell .term {
  margin-top: auto;
  font-family: var(--mono); font-size: 12.5px;
  background: var(--code-bg); color: var(--code-fg);
  border-radius: 6px; padding: 14px 16px;
  line-height: 1.6; overflow-x: auto;
  white-space: pre;
}
.term .p { color: var(--code-cool); }
.term .f { color: var(--code-red); }
.term .s { color: var(--code-mute); }
.term .k { color: var(--code-fg); font-weight: 600; }
.term .ok { color: oklch(0.75 0.13 155); }
.term .warn { color: var(--code-red); }
.cell .mini-out {
  margin-top: auto;
  font-family: var(--mono); font-size: 12px;
  color: var(--ink);
  border-top: 1px solid var(--hair);
  padding-top: 12px;
  display: flex; align-items: baseline; gap: 10px;
}
.cell .mini-out .tag { color: var(--primary); font-weight: 600; }

/* ---- Navigation flow ---- */
.flow {
  background: var(--surface);
}
.flow .wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: clamp(32px, 5vw, 72px); align-items: center; }
.flow-diagram {
  border: 1px solid var(--hair-strong); border-radius: 10px; background: var(--bg); padding: 28px;
}
.flow-diagram svg { width: 100%; height: auto; display: block; }

/* ---- Provenance legend + terminal pair ---- */
.prov-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: clamp(28px, 4vw, 56px); align-items: start; }
.prov-legend { display: flex; flex-direction: column; gap: 18px; }
.prov-item {
  display: grid; grid-template-columns: 18px 1fr; gap: 14px; align-items: start;
  padding: 16px 0; border-top: 1px solid var(--hair);
}
.prov-item:first-child { border-top: none; padding-top: 4px; }
.prov-item .swatch {
  width: 14px; height: 14px; border-radius: 3px; margin-top: 4px;
}
.prov-item.declared .swatch { background: var(--primary); }
.prov-item.discovered .swatch { background: var(--cool); }
.prov-item.inferred .swatch { background: transparent; border: 1.5px dashed var(--muted); }
.prov-item h4 { font-size: 1rem; font-weight: 600; margin-bottom: 6px; font-family: var(--mono); letter-spacing: 0; }
.prov-item.declared h4 { color: var(--primary); }
.prov-item.discovered h4 { color: var(--cool); }
.prov-item.inferred h4 { color: var(--muted); }
.prov-item p { font-size: 14px; color: var(--muted); line-height: 1.5; }
.term-block {
  font-family: var(--mono); font-size: 12.5px;
  background: var(--code-bg); color: var(--code-fg);
  border-radius: 10px; padding: 20px;
  line-height: 1.65; overflow-x: auto;
  white-space: pre;
}
.term-block .head {
  display: flex; align-items: center; gap: 8px;
  color: var(--code-mute); font-size: 11px;
  margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid oklch(0.28 0.008 355);
}
.term-block .head .dotr { width: 7px; height: 7px; border-radius: 50%; background: var(--code-red); }

/* ---- Layers ---- */
.layers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.layer {
  border: 1px solid var(--hair-strong); border-radius: 10px;
  padding: 28px; display: flex; flex-direction: column; gap: 18px;
  background: var(--bg);
}
.layer .tag {
  font-family: var(--mono); font-size: 11px; color: var(--muted);
  letter-spacing: 0.04em;
}
.layer .tag .pri { color: var(--primary); font-weight: 600; }
.layer h3 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.025em; }
.layer .desc { font-size: 14.5px; color: var(--muted); line-height: 1.55; }
.layer .visual {
  font-family: var(--mono); font-size: 11.5px;
  background: var(--surface); border: 1px solid var(--hair);
  border-radius: 6px; padding: 14px; color: var(--ink);
  line-height: 1.6; overflow-x: auto; white-space: pre;
  margin-top: auto;
}
.layer .visual .c { color: var(--primary); }
.layer .visual .m { color: var(--muted); }
.layer .link {
  font-family: var(--mono); font-size: 13px; color: var(--primary);
  display: inline-flex; align-items: center; gap: 6px;
}
.layer .link svg { transition: transform 0.18s ease; }
.layer:hover .link svg { transform: translateX(3px); }

/* ---- Diagnostic table ---- */
.diag-table {
  border: 1px solid var(--hair-strong); border-radius: 10px; overflow: hidden;
  font-family: var(--mono); font-size: 13px;
}
.diag-row {
  display: grid;
  grid-template-columns: 88px 86px 1fr 1.4fr;
  gap: 16px; padding: 14px 20px;
  border-top: 1px solid var(--hair);
  align-items: baseline;
}
.diag-row:first-child { border-top: none; }
.diag-row.head {
  background: var(--surface); font-size: 11px; color: var(--muted);
  letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
}
.diag-row .code { color: var(--primary); font-weight: 600; }
.diag-row .sev { font-weight: 600; }
.diag-row .sev.err { color: var(--primary); }
.diag-row .sev.warn { color: oklch(0.55 0.14 70); }
.diag-row .sev.info { color: var(--cool); }
.diag-row .trigger { color: var(--ink); }
.diag-row .msg { color: var(--muted); }

/* ---- Footer ---- */
.site footer { border-top: 1px solid var(--hair); padding: 56px 0 40px; margin-top: 0; }
.foot-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; }
.foot-brand .brand { margin-bottom: 14px; }
.foot-brand p { font-size: 13px; color: var(--muted); max-width: 30ch; }
.foot-col h4 { font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px; font-weight: 600; }
.foot-col a { display: block; font-size: 14px; padding: 4px 0; color: var(--ink); transition: color 0.18s; }
.foot-col a:hover { color: var(--primary); }
.foot-bottom {
  margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--hair);
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  font-family: var(--mono); font-size: 12px; color: var(--muted);
}
.foot-bottom .eq { color: var(--ink); }
.foot-bottom .eq .pri { color: var(--primary); }

/* ---- GitHub about / releases / packages ---- */
.github-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.gh-card {
  border: 1px solid var(--hair-strong);
  border-radius: 10px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--bg);
}
.gh-card h3 {
  font-family: var(--mono); font-size: 13px; color: var(--primary);
  letter-spacing: 0.02em; margin: 0;
}
.gh-card .desc { font-size: 14.5px; color: var(--muted); line-height: 1.55; margin: 0; }
.gh-card .desc code { color: var(--primary-ink); background: var(--surface); padding: 1px 5px; border-radius: 3px; font-size: 0.85em; }
.gh-card .meta { font-family: var(--mono); font-size: 11.5px; color: var(--muted); margin: 0; }
.gh-card .link {
  margin-top: auto;
  font-family: var(--mono); font-size: 13px; color: var(--primary);
  display: inline-flex; align-items: center; gap: 6px;
}
.gh-card .link + .link { margin-top: 2px; }
.gh-card .link svg { transition: transform 0.18s ease; }
.gh-card:hover .link svg { transform: translateX(3px); }

/* ---- Reveal motion ---- */
.reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
.reveal.in { opacity: 1; transform: none; }

/* ---- Responsive ---- */
@media (max-width: 980px) {
  .hero-grid, .flow .wrap, .prov-pair { grid-template-columns: 1fr; }
  .github-grid { grid-template-columns: 1fr; }
  .cli-bento { grid-template-columns: repeat(2, 1fr); }
  .cell.span3, .cell.span2 { grid-column: span 2; }
  .layers { grid-template-columns: 1fr; }
  .foot-grid { grid-template-columns: 1fr 1fr; }
  .nav-links { display: none; }
}
@media (max-width: 620px) {
  .caps-grid { grid-template-columns: 1fr 1fr; }
  .cap { border-right: none; border-bottom: 1px solid var(--hair); padding: 16px 0; }
  .cap:nth-child(odd) { border-right: 1px solid var(--hair); padding-right: 16px; }
  .cli-bento { grid-template-columns: 1fr; }
  .cell.span3, .cell.span2 { grid-column: span 1; }
  .foot-grid { grid-template-columns: 1fr; }
  .diag-row { grid-template-columns: 78px 64px 1fr; }
  .diag-row .msg { display: none; }
  .topbar .wrap { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  .site *, .site *::before, .site *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  .reveal { opacity: 1; transform: none; }
}
</style>
