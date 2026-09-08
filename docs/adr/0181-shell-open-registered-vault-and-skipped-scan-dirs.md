---
type: ADR
id: "0181"
title: "Shell Open With prefers a registered vault and skips dependency scans"
status: accepted
date: 2026-09-08
supersedes: "0176"
---

## Context

ADR-0176/0177 open Explorer “Open with” Markdown by treating the file’s immediate parent folder as a new vault-instance root. That is correct for a lone file on the Desktop. It is wrong when the file already lives in a registered vault (a nested note becomes a new tiny vault) and catastrophic when the parent is a code repo: `scan_all_files` followed directory symlinks and indexed `node_modules`, so a README could produce tens of thousands of vault entries. Gitignore filtering ran only after that walk. Shell open then called `reloadVault()` even though startup already scanned.

ADR-0177’s isolation rule still holds: shell open must spawn a separate vault-instance process and must not switch the ordinary main `active_vault`.

## Decision

**Keep spawning a vault instance. Choose the vault root as the deepest registered ancestor of the Markdown file when one exists; otherwise keep the immediate parent. Never follow directory symlinks during a vault scan, and never descend into dependency or build directories.**

- Payload `relative_note` may contain `/` when the file is nested in a registered vault.
- Unregistered files still use the parent folder as the instance root.
- Scanner, folder tree, and keyword search skip `node_modules`, `target`, `dist`, `build`, `__pycache__`, `venv`, and hidden (`.`-prefixed) directories, with `WalkDir::follow_links(false)`.
- After the note is selected, shell open does not force a second `reload_vault`. Startup scan / snapshot reconciliation remains the index path.

## Options considered

- **Always parent folder (ADR-0176/0177)**: isolates the file, but rescan cost and vault-list pollution follow from that choice.
- **Walk up to a git root**: would enlarge `repo/docs/a.md` from `docs/` to the whole repository.
- **Single-file preview window**: forks the editor/index model.
- **Chosen**: registered ancestor when available; parent folder otherwise; skip dependency trees for every vault scan.

## Consequences

- Opening a note that already belongs to a registered vault reuses that vault’s snapshot/cache instead of indexing a sibling folder.
- Opening `README.md` at a JavaScript/Rust repo root no longer indexes `node_modules` or `target`.
- Folders literally named `dist` / `build` / `target` are invisible to Tolaria. That is accepted; notes should not live in toolchain output directories.
- ADR-0177 still governs process isolation and shared `active_vault` preservation.
