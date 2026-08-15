# tooling.md — Configure Project Tooling

A reproducible procedure for configuring project tooling in ACC.

## Steps

1. **Detect current tooling.** Run `acc tools` to see what ACC has auto-discovered.

2. **Review detected tools.** Verify that detected tools match project intent:
   - Package manager (npm/pnpm/yarn, cargo, pip/poetry/uv, go mod)
   - Test runner (vitest, cargo test, pytest, go test)
   - Linter (eslint, clippy, ruff, golangci-lint)
   - Type checker (tsc, cargo check, mypy)
   - Formatter (prettier, cargo fmt, black, gofmt)

3. **Configure overrides if needed.** Edit `.acc/config/config.yaml`:
   ```yaml
   tools:
     detected:
       enabled: true
       # Override specific tools
       # node: false  # disable Node.js detection entirely
     permissions:
       shell:
         approval: "auto"  # or "ask" for interactive
   ```

4. **Add plugins if needed.** For external tooling (Docker, GitHub, etc.):
   ```bash
   mkdir -p .acc/config/tools/docker
   # Add plugin.yaml and implementation
   ```

5. **Validate.** Run `acc tools --refresh` then `acc tools` to confirm.

6. **Test tool execution.**
   ```bash
   acc tool test
   acc tool lint
   acc tool typecheck
   ```

## Notes

- ACC prefers tools declared by the project (package.json scripts, Cargo.toml).
- Never manually install tools that the project already declares.
- Use `acc shell` for one-off commands; prefer `acc tool <name>` for standard operations.
- Permissions default to safe; enable moderate/dangerous explicitly.