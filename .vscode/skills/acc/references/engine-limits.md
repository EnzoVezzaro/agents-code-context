# ACC Engine Limits (measured)

The engine's AI phase is hard-budgeted so repository size never
affects per-review cost. Full details: `docs/05-cli-commands.md` in the
ACC repository.

| Budget | Value | What it bounds |
|--------|-------|----------------|
| Contract | 4,000 chars | the boundary's `AGENTS.md` text sent to the model |
| Slice | 1,500 chars | the derived graph slice JSON for the boundary |
| Changed files | 10 files | how many changed files are embedded in the prompt |
| Changed code | 6,000 chars | total source text embedded for the AI to review |
| Knowledge | 5 entries | max knowledge proposals written per boundary |
| Supervisor | 0–100, iterates ≤ 3 | the approval score and re-work loop |

Benchmarked live (22 → 3,900 files): drift detection held at 4/4
sizes with constant ~4.6 KB per-review context; ACC files doubled the
drift items the model reported; the graph stayed ~180 bytes/item with
no prose. Re-run anytime with `npm run benchmark:engine` (ACC repo).

**In plain English:** the engine doesn't get dumber as the repository
grows — it slices work per boundary, so the model only ever sees a
small, capped slice (~4.6 KB) no matter how big the repo is. ACC
contracts + memory make the model's review about 2× more thorough
(2 drift items found vs 1 without them). The graph is a routing index
of ids/types/hashes — never a copy of the code — so it stays tiny
(~180 bytes/item) at any scale. The AI can still hallucinate (a made-up
path on a tiny repo in the benchmark run) — that's why the
deterministic scan + supervisor are the safety net: a fake path fails
`acc check` and scores below the 85% approval threshold.
