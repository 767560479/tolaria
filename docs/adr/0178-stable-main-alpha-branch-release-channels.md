---
type: ADR
id: "0178"
title: "Stable baseline on main; Alpha releases from alpha branch"
status: active
date: 2026-08-03
supersedes: "0173-windows-only-unsigned-release-via-github-actions"
---

## Context

ADR 0173 published an unsigned Windows NSIS installer as a GitHub **prerelease** on every push to `main`. That made `main` identical to the Alpha channel and left no automatic path to promote a build as Stable (`stable-vYYYY.M.D`, non-prerelease).

This fork still needs continuous Alpha installers for ongoing work, plus occasional Stable promotions from a frozen baseline, without restoring multi-platform signing.

## Decision

**Keep Windows-only unsigned GitHub Actions packaging (ADR 0173), but split channels by Git ref:**

- **`main`** is the Stable baseline. Ordinary pushes to `main` do **not** publish a release.
- **`stable-vYYYY.M.D` tags** on `main` (or any commit carrying the current workflow) trigger a **Stable** build: stamp version `YYYY.M.D`, publish a non-prerelease GitHub Release titled `Tolaria YYYY.M.D (Windows)`.
- **`alpha` branch** is the continuous development line. Every push to `alpha` publishes an **Alpha** prerelease (`YYYY.M.D-alpha.N`, tag `alpha-vYYYY.M.D-alpha.NNNN`), same as the former main→alpha pipeline.
- If a `stable-v` tag already uses today's UTC calendar date, Alpha advances to the next calendar day before assigning `-alpha.N` so Alpha stays semver-newer than Stable (ADR 0066).
- Promote Stable by merging `alpha` → `main` when ready, then pushing `stable-vYYYY.M.D`.
- No Authenticode, Tauri updater signatures, or Apple secrets (unchanged from ADR 0173).

## Options considered

- **Keep Alpha on every `main` push only**: simple, but cannot ship Stable without a second pipeline or manual rebuild.
- **`main` = Stable baseline + `alpha` branch for Alpha** (chosen): matches channel naming, reuses one workflow file, preserves unsigned Windows NSIS.
- **Restore separate signed stable workflow**: rejected for this fork; signing secrets are still absent.

## Consequences

- Daily feature work pushes to `origin/alpha`; Stable is an explicit tag promotion after merge to `main`.
- In-app update checks still only recognize `alpha-v…` tags; Stable is for GitHub Releases / download surfaces until the updater is extended.
- ADR 0173 remains the source for “Windows-only unsigned NSIS via Actions”; this ADR supersedes its “every push to main → alpha” trigger rule.
