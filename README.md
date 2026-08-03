# Tolaria

Tolaria is a desktop app for managing **markdown knowledge bases**: files-first, git-first, and offline-first. Vaults are plain markdown with YAML frontmatter—portable, editable outside the app, and not locked to Tolaria servers.

This repository is a fork of [refactoringhq/tolaria](https://github.com/refactoringhq/tolaria). Upstream remains the original project; differences in this fork are summarized below.

<img width="1000" height="656" alt="Tolaria screenshot" src="https://github.com/user-attachments/assets/8aeafb0a-b236-43c2-a083-ec111f903c38" />

## Fork differences

- **Windows-only releases** — GitHub Actions builds an unsigned NSIS installer on push to `main`.
- **No Authenticode signing** — Windows SmartScreen may warn; choose *More info* → *Run anyway* if you trust the build.
- **No in-app auto-update** — You can check GitHub Releases from the app; download and install manually.
- **AI** — Direct model chat in AiWorkspace (`stream_ai_model`) and optional AI commit-message drafts. This fork does **not** ship a vault MCP server or in-app CLI coding agents (Claude Code, Codex, Copilot, etc.).

## Principles

- **Files-first** — Notes are plain markdown. No proprietary format and no export step to leave.
- **Git-first** — Every vault is a git repository: history, remotes, and sync without Tolaria-hosted storage.
- **Offline-first, zero lock-in** — No required accounts or cloud dependency for core vault use.
- **Open source** — Licensed under AGPL-3.0-or-later.
- **Standards-based** — Markdown + YAML frontmatter; types are navigation aids, not rigid schemas.
- **Direct-model AI** — Configure local or API providers in Settings; chat and commit drafts use those models. External agents can still edit the vault as normal files.
- **Keyboard-first** — Editor and command palette are built for keyboard-heavy workflows.

## Installation

Download the latest Windows installer from this fork’s [GitHub Releases](https://github.com/767560479/tolaria/releases) (prerelease alpha builds). There is no Homebrew cask or signed multi-platform download page for this fork.

## Getting started

On first launch you can clone the [getting started vault](https://github.com/refactoringhq/tolaria-getting-started) for a guided walkthrough of the app.

User-facing docs source lives under [`site/`](site/) (VitePress). This fork does not publish GitHub Pages from CI; use the in-repo docs or run `pnpm docs:dev` locally if you need the site.

## Local development

### Prerequisites

- **Node.js 22+** (Volta pin: see `package.json` → `volta`)
- **pnpm** (Volta pin included)
- **Rust** stable (for `pnpm tauri dev` / native builds)
- **Windows** is the primary develop and release target for this fork

### Quick start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` for browser mock mode, or run the native app:

```bash
pnpm tauri dev
```

More detail: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

### Useful commands

```bash
pnpm test
pnpm lint
cargo test --manifest-path src-tauri/Cargo.toml
pnpm playwright:smoke
```

## Releases

Pushing to `main` (except ignored paths such as `docs/**` and `site/**`) runs [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Computes a calendar alpha version (`YYYY.M.D-alpha.N`) and tag (`alpha-v…`)
2. Builds `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis`
3. Publishes the `*-setup.exe` as a GitHub prerelease

No signing secrets are required. SmartScreen warnings on the installer are expected.

## Tech docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, stack, data flow
- [ABSTRACTIONS.md](docs/ABSTRACTIONS.md) — Core abstractions and models
- [GETTING-STARTED.md](docs/GETTING-STARTED.md) — Codebase navigation and local setup
- [ADRs](docs/adr) — Architecture Decision Records (see ADR-0175 for MCP/CLI agent removal)

## Security

If you believe you have found a security issue, please report it privately as described in [SECURITY.md](./SECURITY.md).

## License

Tolaria is licensed under AGPL-3.0-or-later. The Tolaria name and logo remain covered by the project’s trademark policy.
