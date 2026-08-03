---
type: ADR
id: "0179"
title: "Editor open-note tabs and file-tree sidebar"
status: active
date: 2026-08-03
supersedes: "0003"
---

## Context

ADR 0003 removed the in-window tab bar in favor of a single open note plus back/forward history. After shipping the folder-only sidebar + middle note list layout, browsing became filter-heavy (Inbox / All Notes / Archive) while opening multiple markdown files for cross-note work stayed awkward.

Product direction now favors a file-explorer sidebar (folders and documents together) with open `.md` tabs above the editor, and a default outline (table of contents) on the right. The middle note list becomes on-demand for Views, Types, Tags, and Remaining filters such as Changes / Pulse.

## Decision

1. **Multi-open tabs in the main window.** `useTabManagement` keeps zero or more tabs; selecting a note focuses an existing tab or appends a new one. Closing a tab activates a neighbor. Diff / replace flows may replace the active tab slot.
2. **Sidebar file tree shows documents.** Folder rows expand to child folders and direct file children; clicking a file opens (or focuses) a tab and selects that folder so the middle list stays hidden.
3. **Remove Inbox / All Notes / Archive from the sidebar chrome.** Those filters remain reachable via commands/status where already wired, but are not primary navigation.
4. **Tags section** lists vault tags and drives a `SidebarSelection` of `kind: 'tag'`.
5. **Default layout** is sidebar + editor + outline. The middle note list shows when selection is a list filter (view / type / tag / changes / pulse / …) or when view mode is `editor-list`.

## Alternatives considered

- Keep single-note model (ADR 0003): rejected for multi-file workflows.
- Always show the middle note list: rejected; tree + tabs replace that default path.
- Separate OS note windows only: kept as an option, not the primary multi-note UX.

## Consequences

- Supersedes ADR 0003 for the main window.
- Navigation history remains for back/forward; tabs are the primary multi-note surface.
- Tests and docs that assumed Inbox as the default selection or a single-slot `tabs` array need updates.
- Split-pane editing remains deferred.
