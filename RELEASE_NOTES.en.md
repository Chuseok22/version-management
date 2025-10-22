# version-management v1.0.0 — Initial Public Release

Centralized, reusable GitHub Actions for **automated semantic versioning** across **Spring Boot (Gradle Groovy)** and **Next.js (TypeScript)** projects.

---

## ✨ Highlights

- **Two consumption modes**
    - **Reusable workflow**: `uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1`
    - **Composite action**: `uses: chuseok22/version-management/.github/actions/version-bump@v1`
- **Framework support**
    - **Spring Boot**: updates `version = 'X.Y.Z'` in `build.gradle` (supports `version 'X.Y.Z'` too), optional `application.yml` `version:` key sync
    - **Next.js**: updates `package.json.version`, writes/updates `src/constants/version.ts` (path configurable), updates `package-lock.json` when present
- **Commit-driven bumping**
    - `version(major): ...` → MAJOR+1 (MINOR, PATCH reset to 0)
    - `version(minor): ...` → MINOR+1 (PATCH reset to 0)
    - `version(patch): ...` → PATCH+1
- **Changelog automation**
    - Auto-prepend to **CHANGELOG.md**
    - Adds a one-time **banner** on first creation
- **Git tagging & release commit**
    - Creates and pushes tag (default: `vX.Y.Z`)
    - Pushes a release commit with message: `chore(release): vX.Y.Z <commit description> [skip version]`
    - The `[skip version]` token prevents infinite reruns
- **Conditional follow-ups**
    - Sends `repository_dispatch` only **when** a bump occurred (default event type: `version-bumped`)
    - Payload includes `new_version`, `new_tag`, `bump_level`, `sha`
- **Safety & orchestration**
    - Bump only on default branch (default: `main`)
    - Determine current version by **Tag → Files → Default seed**
    - Concurrency group prevents overlapping runs
    - Non-matching commits end in **success** but **no dispatch**

---

## 🔧 Inputs (Overview)

| Input | Default | Description |
|---|---|---|
| `project_type` | `auto` | `spring` \| `next` \| `auto` (auto: detect by `package.json` / `build.gradle`) |
| `default_branch` | `main` | Only bump on this branch |
| `tag_prefix` | `v` | Tag prefix (e.g., `v1.2.3`) |
| `default_version` | `0.0.0` | Seed when no tag/file exists |
| `next_constants_path` | `src/constants/version.ts` | Next.js constant file path |
| `sync_app_yaml` | `false` | Update `version:` in Spring `src/main/resources/application.yml` if present |
| `workdir` | `""` | Subdirectory in monorepo (e.g., `backend`, `web`) |
| `dispatch_on_bump` | `true` | Send `repository_dispatch` only when bumped |
| `dispatch_event_type` | `version-bumped` | Event type for follow-up workflows |

> The composite action accepts the same/similar inputs.

---

## 🚀 Quick Start

**Consumer repo**: `.github/workflows/version-management.yml`

```yaml
name: Version Management (from chuseok22/version-management)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: write
  actions: read

jobs:
  versioning:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: "auto"
      default_branch: "main"
      tag_prefix: "v"
      default_version: "0.0.0"
      next_constants_path: "src/constants/version.ts"
      sync_app_yaml: "false"
      workdir: ""
      dispatch_on_bump: "true"
      dispatch_event_type: "version-bumped"
```

**Follow-up** example (only when bumped):

```yaml
name: APK Build (only after version bump)

on:
  repository_dispatch:
    types: [ version-bumped ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "new_version: ${{ github.event.client_payload.new_version }}"
          echo "new_tag:     ${{ github.event.client_payload.new_tag }}"
          echo "bump_level:  ${{ github.event.client_payload.bump_level }}"
          echo "sha:         ${{ github.event.client_payload.sha }}"
```

---

## 🧩 Notes & Behavior

- **Changelog banner** appears once, then persists at the top. New entries are always prepended **below** the banner and header.
- Release commit message includes the original versioning commit’s **description** (text after `version(<level>):`).
- **No PAT required** for tagging/pushing within the same repository; `GITHUB_TOKEN` is enough.
- Ensure `actions/checkout@v4` with `fetch-depth: 0` so tags/history are available.

---

## ⚠️ Known Limitations / Roadmap

- Single `workdir` per run (no multi-package scanning yet).
- Spring **multi-module** propagation not implemented.
- Only `npm` lockfile (`package-lock.json`) is updated; Yarn/Pnpm support planned.
- GitHub Release object creation is not included (can be added in a follow-up job).
- Banner localization customization to be exposed as an input.

Planned:
- Multi-module Gradle propagation
- Yarn `yarn.lock` / pnpm `pnpm-lock.yaml` updates
- Optional GitHub Release creation with changelog notes
- Customizable banner (locale/format/links)
- Conventional Commits mapping config

---

## ✅ Compatibility

- Runs on `ubuntu-latest`
- Node.js `20.x`
- Spring Boot (Gradle Groovy), Next.js (TypeScript)

---

## 📄 Links

- Repo: https://github.com/Chuseok22/version-management
- Issues / PRs welcome!

---

**Author**: [Chuseok22](https://github.com/Chuseok22)
