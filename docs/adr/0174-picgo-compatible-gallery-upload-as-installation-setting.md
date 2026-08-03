---
type: ADR
id: "0174"
title: "PicGo-compatible gallery upload as installation setting"
status: active
date: 2026-07-28
---

## Context

Tolaria previously stored every pasted, dropped, or inserted binary image in the active vault's `attachments/` folder. Users who already run PicGo (or any PicGo-compatible upload server) want notes to reference remote HTTPS URLs instead, without changing vault-portable local behavior for everyone else.

## Decision

**Add installation-level Gallery settings `picgo_server_url` and optional `picgo_server_token`. When the URL is empty, keep writing images to `vault/attachments`. When set to an http(s) PicGo-compatible endpoint, upload via Rust (`upload_image_via_picgo` / `upload_image_path_via_picgo`) and insert the returned remote URL into the note.**

- Settings live in app config (ADR-0004): figure host credentials follow the installation, not the vault.
- Uploads run in Rust to avoid WebView CORS.
- Upload failures surface to the user and do not silently fall back to local attachments.
- Remote HTML paste of already-remote images remains ADR-0162 (download into vault / keep URL); this decision only covers binary image insert paths.

## Options considered

- **Local attachments only** (previous): simplest, but no PicGo integration.
- **Frontend fetch to PicGo**: blocked by CORS for many servers.
- **PicGo-compatible Rust upload with empty-URL fallback** (chosen).

## Consequences

- Notes may mix `attachments/...` links and remote HTTPS URLs depending on settings at insert time.
- Unsigned/custom PicGo servers may require an Authorization token; localhost PicGo usually does not.
- In-app offline viewing of newly inserted images depends on the remote host remaining available.
