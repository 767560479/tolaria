---
type: ADR
id: "0173"
title: "Windows-only unsigned release via GitHub Actions"
status: superseded
date: 2026-07-28
supersedes: "0172-circleci"
superseded_by: "0178-stable-main-alpha-branch-release-channels"
---

## Context

Cross-platform signed releases were orchestrated by CircleCI (ADR 0172) and duplicated in GitHub Actions workflows for macOS, Linux, and Windows. Local packaging needs for this fork are Windows-only: produce an NSIS installer on every push to `main` and attach it to a GitHub Release, without signing secrets.

## Decision

**GitHub Actions is the sole release orchestrator. Each qualifying push to `main` builds an unsigned Windows NSIS installer and publishes it as a prerelease. CircleCI and macOS/Linux release packaging are removed.**

- Workflow: `.github/workflows/release.yml` on `windows-latest`
- Bundle: `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis`
- No Tauri updater private key, Authenticode, Apple notarization, or telemetry secrets required
- `src-tauri/tauri.conf.json` uses `bundle.targets: ["nsis"]` and `createUpdaterArtifacts: false`
- Local husky/pre-push remains the quality gate; Chunk/CircleCI sidecars are optional and not required for release

## Options considered

- **Keep CircleCI multi-platform signed releases**: unnecessary for a Windows-only distribution goal; requires many secrets.
- **Windows-only unsigned GitHub Actions** (chosen): minimal secrets (`GITHUB_TOKEN` only), SmartScreen may warn, in-app updater is not supported without signatures.
- **Local-only packaging**: no automatic Release artifacts on push.

## Consequences

- macOS and Linux users no longer receive official installers from this pipeline.
- Unsigned installers may trigger Windows SmartScreen; users can still install via “More info” → “Run anyway”.
- In-app auto-update that depends on updater signatures will not work until signing is restored.
- ADR `0172-circleci-owns-ci-and-release-orchestration.md` is superseded for release orchestration (the separate `0172-local-codescene-change-safeguards.md` ADR is unrelated and remains active).
