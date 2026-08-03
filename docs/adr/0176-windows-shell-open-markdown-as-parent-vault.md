---
type: ADR
id: "0176"
title: "Windows shell Open With opens Markdown as parent-folder vault"
status: superseded
date: 2026-07-30
superseded_by: "0177"
---

## Context

Windows users expect Explorer “Open with” (and double-open of a `.md` file) to hand the file to Tolaria. The app is vault-folder-first: it indexes a directory of Markdown notes and has no standalone single-file preview mode. Git is already optional for vaults ([ADR-0085](0085-non-git-vault-support.md)). Shipping Windows-only NSIS installers ([ADR-0173](0173-windows-only-unsigned-release-via-github-actions.md)) makes file-association registration practical on Windows first.

## Decision

**Register Tolaria as an Alternate Windows handler for `.md`, and open shell-selected Markdown by treating the file’s immediate parent directory as the vault root, then selecting that note.**

- `bundle.fileAssociations` advertises `.md` with `rank: "Alternate"` so Tolaria appears in “Open with” without claiming the system default Markdown editor.
- Cold start and single-instance secondary launches parse argv for a `.md` path (skipping `tolaria://` deep links and `--tolaria-vault-instance` flags), emit `tolaria-open-markdown`, and keep a one-shot pending payload for the renderer.
- The renderer registers or switches to the parent folder via the existing vault list APIs, waits for the vault index, and opens the note through the normal selection path. Non-git folders remain supported; shell open does not auto-run `init_git_repo`.

## Options considered

- **Standalone read-only preview window**: matches “preview” wording, but forks the editor/index model and vault identity.
- **Walk up to a registered ancestor vault**: smarter for deep trees, but diverges from the explicit “parent folder is the vault” product choice.
- **Owner/Default file association rank**: stronger discovery, but hijacks users’ preferred Markdown editors.

## Consequences

- Opening a Desktop `.md` treats Desktop as a vault root (scan cost and noise follow from that choice).
- Already-running Tolaria focuses and navigates instead of starting a second ordinary instance.
- macOS/Linux associations are out of scope for this decision; deep links remain the cross-platform item URL path.
