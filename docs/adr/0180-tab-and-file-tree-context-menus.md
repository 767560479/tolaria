---
type: ADR
id: "0180"
title: "Tab and file-tree note context menus with duplicate"
status: active
date: 2026-08-04
---

## Context

ADR 0179 added multi-open editor tabs and file rows in the sidebar folder tree. Tabs only offered an X button to close, and tree file rows had no right-click actions. Folder rows already had create/rename/delete menus. NoteList already exposed rename/delete/reveal-style actions, while Move to Folder lived only in the command palette, and no duplicate/copy-note command existed anywhere.

## Decision

1. **Editor tab context menu** exposes Close, Close others, and Close all. `useTabManagement.handleCloseOtherTabs` keeps one tab and activates it.
2. **Tree file rows** share NoteList context-menu item builders (`noteContextMenuItems`) and add Move to Folder plus Duplicate. Move opens the existing retarget dialog for an arbitrary path via `openMoveNoteToFolderDialogFor`.
3. **`duplicate_note`** copies file bytes to a unique sibling name (`{stem} copy{ext}`, then `{stem} copy N{ext}`), does not rewrite titles or wikilinks, and opens the new path as a tab after vault reload.
4. **Folder move/copy** remain out of scope (no `move_folder` / `copy_folder`).

## Consequences

- NoteList and the folder tree stay aligned for note file actions.
- Mock and native paths both implement `duplicate_note`.
- Localization keys cover tab menu actions and Duplicate.
