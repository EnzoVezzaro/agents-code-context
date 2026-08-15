# diagnostic.md — Add a New Diagnostic Code

A reproducible procedure for minting a new `ACC0xx` diagnostic code.
Stability of codes is a load-bearing contract (see
docs/06-diagnostic-codes.md); this procedure enforces it.

## Steps

1. **Pick a code number.** Use the next available number in the correct
   category range (see docs/06-diagnostic-codes.md §2). Never reuse a
   retired number; never renumber.
2. **Fix the severity.** Decide `error` / `warn` / `info`. The severity
   is permanent — changing it later requires minting a new code.
3. **Decide the trigger.** What exact situation produces this code?
   The trigger condition MUST be a predicate on repository state or
   derivation output, not on agent behavior.
4. **Define the `detail` payload.** If the code's JSON `detail` field is
   non-empty, define its shape here. `detail` shape changes are minor
   bumps; field removal is a major bump.
5. **Add to docs/06-diagnostic-codes.md** in the correct category
   table. Include code, severity, message pattern, trigger.
6. **Wire the code.** Add the emission site in the derivation / check
   pipeline. Unit test the trigger predicate.
7. **Dogfood.** Run `acc check` on the ACC repo itself; the new code
   should NOT fire spuriously on the reference layout.
8. **Bump versions.** New code = minor `acc_version` bump and minor
   `schema_version` bump (the codes list is part of the public JSON contract
   via `acc check --json` documented codes set).

## Forbidden

- Renumbering an existing code.
- Reusing a retired code's number.
- Changing a released code's severity.
- Removing a released code (mark it deprecated instead; it still fires
  forever for its original trigger).