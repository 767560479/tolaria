---
type: ADR
id: "0183"
title: "Separate rich-editor serialize idle from disk autosave idle"
status: active
date: 2026-11-05
related: "0102"
---

## Context

ADR-0102 sets a 1.5s idle window before `save_note_content` so weak CPUs do not start disk and derived-state work mid-typing. Independently, the rich editor coalesces BlockNote→Markdown serialization behind `RICH_EDITOR_CHANGE_DEBOUNCE_MS` so long notes do not pay full-document serialization on every keystroke.

Both windows were previously 1.5s. Stacked end-to-end, a rich-editor pause waited roughly 3s before durable Markdown reached disk, while raw mode (500ms coalesce + 1.5s disk idle) felt faster and still kept the ADR-0102 disk guard.

## Decision

**Keep the disk autosave idle at 1.5s (ADR-0102). Shorten the rich-editor Markdown serialize coalesce to 500ms so it matches raw-editor input coalesce and feeds `useEditorSave` sooner without stacking a second full low-end disk idle.**

Explicit flush paths (Cmd+S, note switch, raw-mode entry, destructive actions) remain immediate and still serialize then persist without waiting for either idle window.

## Options considered

- **Option A — 500ms serialize idle + 1.5s disk idle** (chosen): aligns rich/raw "enter pending" latency; preserves weak-CPU disk protection and stale in-flight save semantics from ADR-0102.
- **Option B — Collapse both layers into one 1.5s timer**: fewer timers, but couples expensive Markdown serialization to the disk path and makes flush ownership harder to reason about.
- **Option C — Shorten disk idle back toward 500ms**: improves perceived save latency but reopens mid-typing disk work on low-end Windows (rejected by ADR-0102 / GH #443).

## Consequences

- After the last rich-editor keystroke, Markdown typically reaches the pending save buffer in ~500ms; disk write still waits for a full 1.5s idle after that content change.
- Effective rich-mode autosave latency drops from roughly 3s toward roughly 2s, matching raw mode order of magnitude.
- Serialize-idle and disk-idle remain separately testable; future timing changes must not collapse them back into identical stacked windows without revisiting this ADR.
- ADR-0102 remains the source of truth for disk autosave idle and stale in-flight save behavior.
