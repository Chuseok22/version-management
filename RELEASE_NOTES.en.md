# Release Notes — v1.0.0

**Tag:** `v1.0.0`  
**Summary:** Official **1.0** release of a centralized, reusable version‑management workflow for **Spring Boot · Next.js · Plain** projects **with release creation**. It performs commit‑driven SemVer bumps, project file synchronization, top‑prepended CHANGELOG updates, Git tag creation/push, and **GitHub Release creation with auto notes**. It also emits `repository_dispatch` **only when a bump occurs**, enabling conditional follow‑up pipelines.

## ✨ Highlights
- **SemVer bump from commit subject**: `version(major|min|patch): {message}`
- **Project file synchronization**
    - **Spring Boot**: update `version` in `build.gradle`; optionally update `version:` in `src/main/resources/application.yml`
    - **Next.js**: update `package.json.version`; create/replace `src/constants/version.ts` (configurable path); update `package-lock.json`
    - **Plain**: create/replace a **version file (`VERSION`)** so the file contains **only one line** with the new version
        - If missing → create file with `X.Y.Z`
        - If present → **overwrite entire content** with `X.Y.Z`
- **Automatic CHANGELOG**
    - Prepend new section to the top
    - Insert a banner once; subsequent entries accumulate under the banner
- **Git tagging**
    - Format: `vX.Y.Z`
    - Release commit message: `chore(release): vX.Y.Z {message} [skip version]`
- **GitHub Release creation**
    - On bump, create a release and include auto‑generated release notes
- **Follow‑up workflows**
    - Send `repository_dispatch` (default: `version-bumped`) **only when bumped**

## 🔧 Usage examples

### Reusable workflow (recommended)
```yaml
jobs:
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: auto                  # spring | next | plain | auto
      default_branch: main
      tag_prefix: v
      default_version: 0.0.0
      next_constants_path: src/constants/version.ts  # Next.js only
      sync_app_yaml: false
      workdir: ""
      dispatch_on_bump: true
      dispatch_event_type: version-bumped
      plain_version_file: VERSION

      # Release options
      create_release: true
      release_latest: true
      release_prerelease: false
```

### Composite action (logic only)
```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- uses: chuseok22/version-management@v1
  with:
    project_type: auto
    default_branch: main
    tag_prefix: v
    default_version: 0.0.0
    next_constants_path: src/constants/version.ts
    sync_app_yaml: false
    workdir: ""
    plain_version_file: VERSION
```

## 🐛 Fixes & improvements
- **Plain project support**: auto create/replace `VERSION` (keep only the new version line); new input `plain_version_file`
- **Tag matching improved**: robust for **multi‑digit** segments like `v1.0.14`
- **Auto detection**: `package.json` → **next**, `build.gradle` → **spring**, otherwise → **plain**
- **Release commit normalization**: includes original subject description + always appends `[skip version]`
- **CHANGELOG banner/header ordering**: banner pinned to the very top
- **Release creation added**: automatically creates a GitHub Release with auto notes on bump

## ⚠️ Notes / limitations
- Bump happens **only** on `default_branch` (default: `main`).  
  Commits with `version(...)` on other branches are **skipped** (workflow succeeds).
- When using the **composite action alone**, no `repository_dispatch` is sent.  
  Use the **reusable workflow** if you need dispatch.

## ✅ Requirements
- Runner: `ubuntu-latest`, Node: `20`
- Permission: `contents: write`
- Checkout: `actions/checkout@v4` with `fetch-depth: 0`
