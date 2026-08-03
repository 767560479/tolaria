# CI/CD Setup

## GitHub Actions

### `release.yml` (Windows only)

Dual-channel unsigned Windows NSIS publishing (see ADR 0178):

| Trigger | Channel | Version / tag | GitHub Release |
|---------|---------|---------------|----------------|
| Push to `alpha` | Alpha | `YYYY.M.D-alpha.N` / `alpha-v…` | **prerelease** |
| Push tag `stable-vYYYY.M.D` | Stable | `YYYY.M.D` / same tag | **stable** (not prerelease) |

Build steps (both channels):

1. Shallow checkout + tags (for version sequencing)
2. Compute version (Stable from tag; Alpha calendar + sequence, with same-day Stable monotonicity bump)
3. Restore pnpm / Rust (`Swatinem/rust-cache`) / Tauri NSIS tool caches
4. `pnpm install`, prefetch NSIS if cache miss
5. Stamp version, build unsigned NSIS on `windows-latest`
6. Publish GitHub Release with the `*-setup.exe`

**Timing notes (measured on cold runners, ~14 min wall clock):**

| Step | Typical |
|------|---------|
| Setup + pnpm install + NSIS prefetch | ~2–3 min cold; much less with caches |
| `pnpm tauri build` (frontend + Rust release + NSIS) | ~11 min cold; **Rust cache is the main warm-run win** |

Warm Alpha pushes after a filled Rust cache should drop well below a full cold compile. Version stamping still rebuilds the root crate each run; dependency crates hit cache. The cache is shared across `alpha` pushes and `stable-v*` tag builds via `shared-key: windows-nsis-release`.

Ordinary pushes to `main` do **not** publish. Promote Stable by merging `alpha` → `main`, then pushing `stable-vYYYY.M.D`.

**No repository secrets are required** beyond the default `GITHUB_TOKEN`.

Unsigned installers may trigger Windows SmartScreen. Users can install via
More info → Run anyway.

In-app updates: Tolaria only **manually** checks this repository's GitHub Releases
(Command Palette → Check for Updates) and currently matches **`alpha-v…` tags**.
It does **not** auto-download or auto-install; download the NSIS `*-setup.exe`
from Releases yourself.

### Disabled in this fork

- `ci.yml` — removed. The upstream macOS CI lane (Codecov, CodeScene, Codacy,
  coverage gates) is not wired for this fork and is unrelated to Windows releases.
- `deploy-docs.yml` — removed. User docs stay on upstream `tolaria.md`; this fork
  does not publish GitHub Pages or updater `latest.json` feeds.

### Other workflows

- `auto-update-prs.yml` — PR branch maintenance helper

## Local packaging

```bash
pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis
```

Installer output:

`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`
