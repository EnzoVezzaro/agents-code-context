# `acc document <path>` — conservative contract template

Generate a conservative `AGENTS.md` template for a directory from the
derived slice and discovery. It is a starting point, not a claim — fill
in the real purpose, boundaries and constraints yourself.

## When to use

- A new boundary needs a contract.
- An existing contract has drifted and you want a fresh structural
  baseline to edit.
- You want a draft to complete — not an authoritative document.

## Usage

```
acc document <path> [--apply] [--force] [--from-discovery] [--json]
```

## Flags

- `--apply` — write the file.
- `--force` — overwrite an existing one.
- `--from-discovery` — seed from discovered edges (dependencies/owners
  the code actually shows).
- `--json` — structured output.

## Workflow

1. `acc document <path>` — generate the draft (prints without writing).
2. Review the template: every guessed fact is marked for you to verify.
3. `--apply` to write it, then complete the placeholder sections (see
   `acc fill`).
4. Confirm with `acc check`.

## Notes

- Anything inferred is clearly marked — never treat a generated
  template as authoritative architecture.
- Prefer `acc build` when you want all missing contracts at once;
  `acc document` is for one boundary, more controlled.
