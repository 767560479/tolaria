# Git Hooks

This repo uses Husky hooks from `.husky/`. Those files are the source of truth.

## Installation

`pnpm install` runs the `prepare` script and installs the hooks into `.git/hooks`.

If you need to reinstall them manually:

```bash
pnpm exec husky
```

The hooks expect `node` and `pnpm` to be available. If they are installed via `nvm`, the hooks will try to load `~/.nvm/nvm.sh` automatically.

## Policy

- Day-to-day feature commits land on `alpha`; Stable baseline commits land on `main`.
- Push `alpha -> origin/alpha` for feature work; push `main -> origin/main` for Stable baseline; tags may be pushed for Stable promotions.
- Never use `--no-verify`.
- `.codescene-thresholds` is a ratchet. It can only move up.

## Pre-commit

`.husky/pre-commit` is intentionally the fast local gate:

- docs, workflow, hook, and Markdown-only commits skip application checks
- commits with staged frontend source run `pnpm lint --quiet`
- full type checking, builds, tests, coverage, Playwright, and project-level CodeScene checks run before push

CodeScene's change-aware commit safeguard is agent-side because it is provided through the CodeScene MCP. Before invoking `git commit`, the implementing agent must:

1. compare every touched code file's Code Health with its pre-edit baseline
2. run `pre_commit_code_health_safeguard` for the repository
3. refactor until the safeguard's quality gates pass

## Pre-push

`.husky/pre-push` blocks pushes unless all of the following are true:

- the current checkout is `main`, `alpha`, or a detached HEAD pushed to one of those branches
- every pushed branch ref is `refs/heads/main -> refs/heads/main` or `refs/heads/alpha -> refs/heads/alpha` (tags are also allowed)
- the Codacy differential gate reports no new findings
- TypeScript and the Vite build pass
- frontend coverage passes
- Rust lint and Rust coverage pass when `src-tauri/` changed
- the curated Playwright core smoke lane passes via `pnpm playwright:smoke`
- current CodeScene Hotspot and Average health are both at or above `.codescene-thresholds`

Chunk sidecars are preferred for the portable automatic gates. If the sidecars are unavailable, the hook runs the same checks locally.

If the remote CodeScene scores are better than the current thresholds, the hook updates `.codescene-thresholds`, stages it, and stops the push. Commit that file normally, then push again. The hook does not auto-commit or bypass itself.

Before the final task push, the implementing agent must also run CodeScene `analyze_change_set` with `base_ref=origin/alpha` (or `origin/main` for Stable-only work). This is the PR-preflight equivalent: every affected file must be improved or stable and the overall quality gate must pass.

The local change-aware safeguards and the remote project scores answer different questions. The safeguards review the code about to land; the remote Hotspot and Average scores monitor the repository baseline and ratchet.

## Legacy Files

The legacy `pre-commit` file under `.github/hooks/` is archival only. Do not copy it into `.git/hooks`; use Husky and `.husky/` instead. The old design `post-commit` auto-implementation hook was removed because it depended on obsolete one-off scripts. `install-hooks.sh` remains as a reinstall helper that runs Husky.

## Troubleshooting

If a hook cannot find `node` or `pnpm`:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use node
```

Then retry the commit or push.
