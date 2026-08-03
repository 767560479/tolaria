---
type: ADR
id: "0177"
title: "Windows shell Open With spawns a separate vault instance"
status: accepted
date: 2026-07-30
supersedes: "0176"
---

## Context

ADR-0176 registered Tolaria as an Alternate Windows handler for `.md` and opened the file by switching the ordinary main process to the Markdown parent folder as a vault. That stole the shared `active_vault` and disrupted whatever vault the user already had open. Users need Explorer “Open with” to open the note without changing the main window’s vault; closing the temporary window must leave the next ordinary launch on the previous vault.

Tolaria already supports independent vault processes via `--tolaria-vault-instance` ([ADR-0171](0171-separate-vault-application-instances.md)), which override process-local active vault while `preserve_shared_active_vault` keeps the disk registry’s ordinary `active_vault`.

## Decision

**Shell Open With for `.md` always spawns a separate vault-instance process for the file’s parent directory, and never switches the ordinary main process vault.**

- Cold start (no main instance): if argv contains a Markdown path and the process is not already a vault instance, spawn `--tolaria-vault-instance <parent> <md>` and exit before creating the ordinary UI.
- Hot start (main instance running): the single-instance callback spawns the same vault-instance launch and does not focus or navigate the main window.
- The vault-instance process emits `tolaria-open-markdown`; `useOpenMarkdownFromShell` registers/selects the note inside that process. Saves from the instance preserve the shared `active_vault`.
- File association remains Alternate; Git remains optional ([ADR-0085](0085-non-git-vault-support.md)).

## Options considered

- **Keep ADR-0176 focus + switch in main**: simplest, but changes current vault and shared active vault.
- **In-process note WebviewWindow**: shares main-process vault state; cannot isolate active vault.
- **Spawn vault instance (chosen)**: reuses ADR-0171 isolation and restore semantics.

## Consequences

- Opening a `.md` shows a second Tolaria process for that folder; the main window stays on its vault.
- Closing the instance returns the user to the untouched main window; ordinary next launch restores the previous shared `active_vault`.
- ADR-0176’s “focus main and navigate” behavior is superseded.
