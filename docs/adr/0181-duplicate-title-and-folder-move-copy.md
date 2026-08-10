---
type: ADR
id: "0181"
title: "Duplicate note title rewrite and folder move/copy"
status: active
date: 2026-08-10
supersedes: "0180"
---

## Context

ADR 0180 added `duplicate_note` as a byte-copy to a sibling `copy` / `copy N` filename without rewriting titles, and deferred folder move/copy. Users then could not tell a duplicate apart from its source by title, and folders still lacked Move / Duplicate parity with notes.

## Decision

1. **`duplicate_note`** still creates a unique sibling path, still does not rewrite wikilinks, and now rewrites frontmatter `title` (when present) and the first body ATX H1 by appending the same ` copy` / ` copy N` suffix used in the filename. Mock and native paths share this behavior. Opening the copy prefers the reloaded vault entry so the tab title matches.
2. **`move_vault_folder(vault_path, folder_path, dest_parent_relative)`** relocates a folder under a destination parent (`""` = vault root). Moves into self or a descendant are rejected. The command returns the same `{ old_path, new_path }` shape as rename so tab and selection remapping reuse rename helpers.
3. **`duplicate_vault_folder(vault_path, folder_path)`** recursively copies a folder to a unique sibling (`{name} copy` / `{name} copy N`) and selects the new folder after reload.
4. Folder context menus expose Move… (retarget dialog) and Duplicate alongside rename/delete.

## Consequences

- ADR 0180 §3–§4 are superseded for title rewriting and folder move/copy scope.
- Localization covers folder move dialog copy and editor render-recovery toast (related UX for BlockNote recovery).
