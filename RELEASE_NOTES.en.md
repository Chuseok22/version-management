# Release Notes — v1.0.0

**Tag:** `v1.0.0`  
**Summary:** Official **1.0** release of a centralized, reusable version‑management workflow for Spring Boot & Next.js. It performs commit‑driven SemVer bumps, project file synchronization, CHANGELOG prepending, and Git tag creation/push in a consistent way. It also emits `repository_dispatch` **only when a bump occurs**, enabling conditional follow‑up pipelines.

## ✨ Highlights
- **SemVer bump from commit subject**: `version(major|min|patch): {message}`
- **Project file synchronization**
    - Spring Boot: update `version` in `build.gradle`, optionally update `version:` in `application.yml`
    - Next.js: update `package.json.version`, create/replace `src/constants/version.ts` (configurable path), update `package-lock.json`
- **Automatic CHANGELOG**
    - Prepend to the top
    - Insert a banner once; subsequent entries are appended under the banner
- **Git tagging**
    - Format: `vX.Y.Z`
    - Release commit message: `chore(release): vX.Y.Z {message} [skip version]`
- **Follow‑up workflows**
    - Send `repository_dispatch` (default: `version-bumped`) **only when bumped**

## 🔧 Usage examples

### Reusable workflow (recommended)
```yaml
jobs:
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: auto
      default_branch: main
      tag_prefix: v
      default_version: 0.0.0
      next_constants_path: src/constants/version.ts
      sync_app_yaml: false
      workdir: ""
      dispatch_on_bump: true
      dispatch_event_type: version-bumped
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
```

## 🐛 Fixes & improvements
- Stronger Gradle `version` detection (`version = 'X.Y.Z'`/`version 'X.Y.Z'`), safe handling of `-SNAPSHOT`, prevent duplicate additions
- Stable CHANGELOG banner/header ordering (banner always stays at the very top)
- Release commit message automatically includes the original subject description

## ⚠️ Notes / limitations
- Bump happens **only** on `default_branch` (default: `main`).  
  Commits with `version(...)` on other branches are **skipped** (workflow succeeds).
- When using the composite action alone, **no repository_dispatch** is sent.  
  If you need dispatch, use the **reusable workflow** above.

## ✅ Requirements
- Runner: `ubuntu-latest`, Node: `20`
- Permission: `contents: write`
- Checkout: `actions/checkout@v4` with `fetch-depth: 0`
