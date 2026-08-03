---
type: ADR
id: "0175"
title: "Fork removes vault MCP server and CLI coding agents"
status: accepted
date: 2026-07-29
---

## Context

This fork narrows Tolaria's in-app AI surface. The bundled `mcp-server/` package, desktop WebSocket bridge (ports 9710/9711), external MCP registration flows, and all CLI coding-agent adapters (Claude Code, Codex, Copilot, OpenCode, Pi, Antigravity, Kiro, Hermes, and shared runtime scaffolding) added substantial native and Node subprocess complexity. The product goal is a files-first knowledge app with direct model chat and lightweight Git assistance, not an embedded agent IDE.

## Decision

**Remove the vault MCP server and every CLI coding-agent integration from the shipping app. In-app AI is limited to (1) direct model chat via `stream_ai_model` / AiWorkspace and (2) AI-generated Git commit messages that also call `stream_ai_model` against a configured API/local model target.**

- Delete `mcp-server/` and Rust MCP/CLI-agent modules; do not register Tolaria as an external MCP server.
- Keep `ai_models.rs`, `stream_ai_model`, provider settings (`settings.ai_model_providers`, `settings.default_ai_target` as `model:<provider>/<model>` ids), and AiWorkspace as the chat surface.
- Commit-message drafting stays renderer-owned (`commitMessageDraft.ts`) and uses the same direct-model path; deterministic filename summaries remain the fallback.
- Shared app-config policy moves to `src-tauri/resources/app-config-policy.json` (bundled with the Rust app, not the removed Node MCP package).

## Options considered

- **Keep MCP + CLI agents** (previous product): richest automation, but heavy packaging, onboarding, and security surface for a notes app fork.
- **Keep MCP, drop CLI agents**: still requires Node bridge lifecycle and external registration UX.
- **Direct models only** (chosen): smallest runtime, clear trust boundary, matches fork scope.

## Consequences

- External tools (Cursor, Claude Code, etc.) no longer receive a first-party Tolaria MCP entry from the app; users configure those tools independently if needed.
- Vault `AGENTS.md` guidance files may remain for human/external-agent conventions, but Tolaria no longer spawns coding agents that read them.
- Settings and docs must stop referring to `agent:*` targets, MCP setup dialogs, and CLI install onboarding.
- Supersedes the MCP/CLI-agent decision chain conceptually (historical ADRs remain unchanged): notably [0011](0011-mcp-server-for-ai-integration.md), [0012](0012-claude-cli-for-ai-agent.md), [0027](0027-dual-ai-architecture.md), [0062](0062-selectable-cli-ai-agents.md), [0074](0074-explicit-external-ai-tool-setup-and-least-privilege-desktop-scope.md), [0093](0093-shared-cli-agent-runtime-adapters.md), [0119](0119-vault-neutral-mcp-registration-with-mounted-workspace-guidance.md), [0120](0120-stable-appimage-mcp-server-path-with-opencode-registration.md), [0133](0133-request-scoped-ai-stream-events.md), [0148](0148-cancellable-ai-agent-streams.md), [0158](0158-vault-write-mcp-tools-update-and-append.md), and CLI adapter ADRs [0090](0090-pi-cli-agent-adapter.md), [0097](0097-gemini-cli-agent-adapter.md), [0147](0147-antigravity-cli-agent-adapter.md), [0150](0150-github-copilot-cli-agent-adapter.md).

## Advice

Fork maintainer decision; no external consultation recorded.
