# `acc ai` — manage AI providers

The CLI-managed setup for the engine's AI phase. **Flow: select provider
→ api key → model.** Keys are stored in `.env` (gitignored) as
`ACC_<PROVIDER_ID>_KEY`; providers are written to the CLI-managed
`.acc/config/ai.yaml` (loaded on top of `config.yaml` — the human
config is never rewritten).

## When to use

- Before the first `acc engine` / `acc review` run.
- When a provider key changes.
- When you want a fallback provider for resilience.

## Usage

```
acc ai                                # list providers and status
acc ai add [--provider <id>] [--api-key <key>] [--model <model>]
           [--id <id>] [--base-url <url>] [--yes]
acc ai remove <id>
acc ai default <id>
acc ai models <id>                    # load available models dynamically
```

## Workflow

1. `acc ai` — see the current providers and key status.
2. `acc ai add` — interactive walk-through: select provider → enter api
   key → pick a model (listed dynamically). With `--yes` + all flags it
   is fully deterministic — no prompts.
3. `acc ai default <id>` — set the default provider the engine uses.
4. `acc ai models <id>` — list a provider's available models before
   choosing.

## Providers

- Catalog: `openai`, `anthropic`, `google`, `openrouter`, `nvidia`,
  `groq`, `together` (AI SDK v5 packages). Custom OpenAI-compatible
  endpoints via `--base-url` (e.g. NVIDIA NIM, OpenRouter).
- Multiple providers are supported and tried in order: the engine falls
  back to the next provider when one fails (missing key, endpoint
  error, timeout), with per-call retries (`engine.ai.retries`) — every
  failure is reported, and `acc engine --watch` stops with a clear error
  after `engine.ai.max_consecutive_failures` all-providers-failed runs.

## Key removal

`acc ai remove <id>` deletes the key from `.env` and disables the
provider.

## Edge cases

- `acc ai` itself is offline — only `models` / `add --select` contact
  the network, and only when you ask.
- Missing keys are reported, never thrown — the engine degrades cleanly.
- Output is byte-identical across runs for the same state.
