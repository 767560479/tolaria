---
type: ADR
id: "0182"
title: "Same-day Stable rebuild tags and date-first release titles"
status: active
date: 2026-10-28
supersedes: null
extends: "0066"
---

## Context

ADR 0066 / 0178 only accepted Stable tags of the form `stable-vYYYY.M.D`. Same-day packaging retries used `stable-vYYYY.M.D.N` (for example `stable-v2026.10.28.1`) and the release workflow rejected them. Cargo also rejects four-part versions such as `2026.10.28.1`, so the technical stamp cannot copy the tag literally.

Separately, Alpha GitHub Release titles began with `Alpha …`, so name-oriented Release lists clustered every Alpha ahead of Stable calendar titles.

## Decision

- Accept Stable tags `stable-vYYYY.M.D` and optional same-day rebuilds `stable-vYYYY.M.D.N`.
- Stamp Cargo / Tauri with the calendar core `YYYY.M.D` only (semver-safe). Show `YYYY.M.D.N` in the Release display name when `N` is present.
- Treat any remote tag `stable-v{calendar}` or `stable-v{calendar}.*` as occupying that calendar day for Alpha’s next-day monotonicity guard.
- Alpha Release display titles put the calendar first (`YYYY.M.D.N Alpha`) so lists sort by packaging date instead of the word “Alpha”.
- The release-history page sorts each channel by calendar version parsed from the tag (then `published_at`), and does not dedupe `stable-vYYYY.M.D` with `stable-vYYYY.M.D.N`.

## Consequences

- Same-day Stable rebuilds can re-run packaging without inventing a new calendar day.
- Installer technical version may repeat `YYYY.M.D` across `.N` rebuilds; GitHub Release tags keep assets distinct.
- In-app / docs copy that still says “Alpha YYYY.M.D.N” remains understandable; GitHub Release titles prefer date-first ordering.
