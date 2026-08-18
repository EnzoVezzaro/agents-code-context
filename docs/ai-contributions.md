# AI Contribution Verification

ACC can optionally verify the AI tooling used to create a pull request. The system is intentionally simple:

- The contributor declares **how the PR was created**.
- The repository defines **which providers, models, and harnesses are allowed**.
- GitHub provides the **actual contributor identity**.
- CI verifies everything and reports the result on the PR.

The feature is entirely repository-local and deterministic.

---

## Configuration

```text
.acc/
└── config/
    └── config.yaml
.github/
├── pr.yml
└── pr_allow_providers.yml
```

### `pr.yml`

`.github/pr.yml` describes the AI tooling used for the PR.

```yaml
harness: opencode
provider: google
model: gemini-2.5-flash
```

| Field      | Description                                      |
| ---------- | ------------------------------------------------ |
| `harness`  | The AI coding environment used to produce the PR |
| `provider` | The model provider                               |
| `model`    | The exact model used                             |

The contributor **does not declare whether the model is free**. `pr.yml` is optional.

---

## Provider Allowlist

`.github/pr_allow_providers.yml` is the authoritative policy.

```yaml
providers:
  google:
    free_api_access: true
    models:
      (all):
      free-model:
        - gemini-3.5-flash
        - gemini-2.5-flash
      paid-model:
        - gemini-3.5-pro
        - gemini-2.5-pro

  openai:
    free_api_access: false
    models:
      paid-model:
        - gpt-5.6

  anthropic:
    free_api_access: false
    models:
      paid-model:
        - claude-sonnet-4

harnesses:
  opencode:
    allowed: true
  claude-code:
    allowed: true
  cursor:
    allowed: true
  codex:
    allowed: true
```

> `pr.yml` declares what was used.
> `pr_allow_providers.yml` determines whether it is allowed.

---

## Provider-level `free_api_access`

The `free_api_access` flag lives at the **provider level** and applies as the default for all models under that provider:

```yaml
providers:
  google:
    free_api_access: true    # all Google models are free by default
    models:
      (all):
```

This means: every Google model is considered free unless overridden at the model level.

---

## Model Lists

Models are organized into named lists:

| List          | Meaning                                      |
| ------------- | -------------------------------------------- |
| `(all)`       | Optional tag — applies to all models         |
| `free-model`  | Models with free API access                  |
| `paid-model`  | Models that require payment                  |

```yaml
providers:
  google:
    free_api_access: true
    models:
      (all):
      free-model:
        - gemini-3.5-flash
        - gemini-2.5-flash
      paid-model:
        - gemini-3.5-pro
        - gemini-2.5-pro
```

A model in `paid-model` overrides the provider-level `free_api_access: true`.

---

## Harnesses

The allowlist also defines which AI coding harnesses are permitted:

```yaml
harnesses:
  opencode:
    allowed: true
  claude-code:
    allowed: true
  cursor:
    allowed: true
  codex:
    allowed: true
  gemini:
    allowed: true
  vscode:
    allowed: true
  windsurf:
    allowed: true
```

If a harness is not in the list, the PR fails with "Harness not allowed."

---

## `free_api_access`

The property describes:

> Can this provider/model combination be accessed through the API without paying for inference?

It does **not** mean the model is open source, open weight, self-hosted, or has no commercial version.

---

## Resolution Rules

When CI receives:

```yaml
harness: opencode
provider: google
model: gemini-2.5-flash
```

it resolves in this order:

```text
1. Harness check
        ↓
2. Exact provider + model
        ↓
3. Provider-level free_api_access
        ↓
4. No match
```

### 1. Harness check

If `harnesses.opencode.allowed: true` → continue. Otherwise → FAIL.

### 2. Exact model match

If the model is in `free-model` → FREE. If in `paid-model` → PAID.

### 3. Provider-level default

If no exact match but `free_api_access: true` at provider level → FREE.

### 4. No match

→ NOT ALLOWED, UNKNOWN. Unknown models must **never** automatically become free.

---

## Paid Models

Whether paid models are allowed is controlled by `config.yaml`:

```yaml
ai_policy:
  allow_paid: true   # FREE → allowed, PAID → allowed, UNKNOWN → rejected
```

or:

```yaml
ai_policy:
  allow_paid: false  # FREE → allowed, PAID → rejected, UNKNOWN → rejected
```

---

## GitHub Contributor

The contributor is **not declared in `pr.yml`**. GitHub Actions obtains the contributor automatically from the pull-request event. The CI must not trust a manually supplied username.

| Information         | Source                   |
| ------------------- | ------------------------ |
| Contributor         | GitHub PR                |
| Harness             | `.github/pr.yml`     |
| Provider            | `.github/pr.yml`     |
| Model               | `.github/pr.yml`     |
| Harness permission  | `pr_allow_providers.yml` |
| Provider permission | `pr_allow_providers.yml` |
| Free API access     | `pr_allow_providers.yml` |
| Paid-model policy   | ACC configuration        |
| Final result        | CI                       |

---

## CI Verification Flow

```text
                    Pull Request
                         │
                         ▼
                  GitHub PR metadata
                         │
                         ├── contributor
                         │
                         ▼
              .github/pr.yml
                         │
                  ┌──────┼──────┐
                  │      │      │
               harness provider model
                  │      │      │
                  ▼      │      │
           harnesses     │      │
           allowed?      │      │
                  │      └──┬───┘
                  │         ▼
                  │  pr_allow_providers.yml
                  │         │
                  │    ┌────┴─────┐
                  │    │          │
                  │  exact     provider
                  │    │       default
                  │    └────┬─────┘
                  │         ▼
                  │  free_api_access
                  │
                  ▼
             Verification
                  │
          ┌───────┼────────┐
          ▼       ▼        ▼
        FREE     PAID   UNKNOWN
```

---

## CI Results

Successful free-model contribution:

```text
AI Contribution
────────────────────────────────
Contributor: @enzo-vezzaro

Harness:     opencode         ✓ Allowed
Provider:    google           ✓ Allowed
Model:       gemini-2.5-flash ✓ free-model
API Access:  ✓ FREE
Result:      ✓ PASS
```

Paid model when paid allowed:

```text
AI Contribution
────────────────────────────────
Contributor: @contributor

Harness:     claude-code      ✓ Allowed
Provider:    anthropic        ✓ Allowed
Model:       claude-sonnet-4  ✓ paid-model
API Access:  PAID
Result:      ✓ PASS
```

Unknown harness:

```text
AI Contribution
────────────────────────────────
Contributor: @contributor

Harness:     unknown-tool     ✗ Not allowed
Result:      ✗ FAIL

Reason: Harness 'unknown-tool' is not in the allowlist.
```

---

## PR Comment

CI posts a single bot comment using marker `<!-- acc-pr-ai-verification -->` so subsequent runs update the existing comment.

```md
## AI Contribution

| Field | Value |
|---|---|
| Contributor | @contributor |
| Harness | opencode |
| Provider | google |
| Model | gemini-2.5-flash |
| Harness | ✓ Allowed |
| Provider | ✓ Allowed |
| API Access | **FREE** |
| Result | **✓ PASS** |
```

---

## Recommended Configuration

### `.github/pr.yml`

```yaml
harness: opencode
provider: google
model: gemini-2.5-flash
```

### `.github/pr_allow_providers.yml`

```yaml
providers:
  google:
    free_api_access: true
    models:
      (all):
      free-model:
        - gemini-3.5-flash
        - gemini-2.5-flash
      paid-model:
        - gemini-3.5-pro
        - gemini-2.5-pro

  openai:
    free_api_access: false
    models:
      paid-model:
        - gpt-5.6

  anthropic:
    free_api_access: false
    models:
      paid-model:
        - claude-sonnet-4

harnesses:
  opencode:
    allowed: true
  claude-code:
    allowed: true
  cursor:
    allowed: true
  codex:
    allowed: true
```

### `.acc/config/config.yaml`

```yaml
ai_policy:
  require_declaration: false
  preferred_access: free
  allow_paid: true
```

---

## Why the Allowlist Is Version Controlled

`pr_allow_providers.yml` is intentionally committed. It represents the project's policy.

- **Determinism** — A historical PR does not suddenly change classification.
- **Transparency** — Anyone can see which providers/models/harnesses are permitted.
- **Reviewability** — Policy changes are normal Git changes.
- **No external dependency** — CI does not contact a pricing service.
- **Community governance** — Adding a new free provider/model is a normal contribution.

---

## Free-First Philosophy

> **Free software can build incredible software.**

> **We don't tell contributors which AI they must use. We ask them to tell us what they used, and we verify it.**

---

## Minimal Implementation

```text
.github/pr.yml
.acc/config/pr_allow_providers.yml
        +
GitHub PR metadata
        +
GitHub Actions
        ↓
deterministic verification
```
