# version-management

> **Centralized, reusable GitHub Actions workflow for automated versioning **and release creation** (Spring Boot · Next.js · Plain)**  
> On pushes to the default branch (`main`) with a compliant commit message, this project performs **Version bump → Project file sync → CHANGELOG update → Git Tag creation/push → GitHub Release creation (auto notes)** in a standardized way.  
> It also emits a `repository_dispatch` event **only when a version bump actually happens**, so you can trigger follow‑up workflows (e.g., `apk-build.yml`) conditionally.

> **Korean docs** → [README.md](README.md)

---

## 🚀 Features

- **Three project types supported**
    - **Spring Boot (Gradle/Groovy)**  
      Updates `version` in `build.gradle`, and optionally replaces the `version:` key in `src/main/resources/application.yml`.
    - **Next.js (TypeScript)**  
      Updates `package.json.version`, creates/updates `src/constants/version.ts` (path configurable), and reflects the version in `package-lock.json` when present.
    - **Plain (framework‑agnostic projects)**  
      Creates/replaces a **version file** (default: `VERSION`) so that it **contains exactly one line** with `X.Y.Z`.  
      · If the file does not exist, it is created and written with `X.Y.Z`.  
      · If it exists, it is **fully overwritten** and ends up with only `X.Y.Z`.
- **Commit‑driven versioning**
    - `version(major): ...`
    - `version(minor): ...`
    - `version(patch): ...`
- **Policy guarantees**
    - Bump **only on the default branch (`main`)**
    - Determine current version in order: **Tag → Files → Default value**  
      · With `auto` detection: `package.json` → **next**, `build.gradle` → **spring**, otherwise → **plain**
    - `CHANGELOG.md` is **prepended at the top** (insert banner once; subsequent entries accumulate **under** the banner)
    - Create & push **Git Tag** (`vX.Y.Z`) + push **release commit**  
      Release commit message: `chore(release): vX.Y.Z {original subject text} [skip version]`
    - **No bump → workflow still succeeds** (handy for pipeline branching)
- **Release & follow‑up workflow integration**
    - On bump, **create a GitHub Release** (with auto release notes)
    - Sends `repository_dispatch` (default: `version-bumped`) **only when bumped**  
      Payload includes: `new_version`, `new_tag`, `bump_level`, `sha`

---

## 📦 Repository layout

```
version-management/
├─ action.yml                        # Composite action entry (can be used directly)
├─ scripts/
│  ├─ compute-bump.mjs               # Commit inspection + version calculation
│  ├─ sync-files.mjs                 # File sync + commit (spring/next/plain)
│  ├─ update-changelog.mjs           # CHANGELOG prepend (+ initial banner)
│  └─ create-tag.mjs                 # Tag create/push + release commit handling
└─ .github/
   └─ workflows/
      └─ auto-version.yml            # Reusable workflow (workflow_call) orchestrator
```
> **Why split it like this?**  
> The **reusable workflow** handles orchestration (permissions, concurrency, dispatch, release creation), while the **composite action** bundles the actual logic (bump/file updates/changelog/tagging) for reuse anywhere.

---

## 🧭 Quick start (consumer repo)

### 1) Use the **reusable workflow** (recommended)

**Consumer repo**: `.github/workflows/chuseok22-version-management.yml`

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
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: "auto"                 # spring | next | plain | auto
      default_branch: "main"
      tag_prefix: "v"
      default_version: "0.0.0"
      next_constants_path: "src/constants/version.ts"  # for Next.js only
      sync_app_yaml: "false"               # Spring application.yml version update
      workdir: ""                          # subdir in a monorepo, e.g., "backend"/"web"
      dispatch_on_bump: "true"             # trigger follow-ups only when bumped
      dispatch_event_type: "version-bumped"
      plain_version_file: "VERSION"        # version file path for plain projects

      # Release options
      create_release: "true"               # create a GitHub Release on bump
      release_latest: "true"               # mark as latest
      release_prerelease: "false"          # mark as prerelease (e.g., M1, RC)
```

### 2) (Advanced) Use only the logic in an existing CI

Call the **composite action** directly inside your job:

```yaml
jobs:
  some-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - name: Version bump only
        uses: chuseok22/version-management@v1
        with:
          project_type: auto
          default_branch: main
          tag_prefix: v
          default_version: 0.0.0
          next_constants_path: src/constants/version.ts
          sync_app_yaml: "false"
          workdir: ""
          plain_version_file: VERSION
```

---

## ✍️ Commit convention (required)

Version is determined **by the commit subject**:

- `version(major): message` → increase **MAJOR** (+1), reset MINOR/PATCH to 0
- `version(minor): message` → increase **MINOR** (+1), reset PATCH to 0
- `version(patch): message` → increase **PATCH** (+1)
- Any other commit → **no bump** (workflow still succeeds)

Examples:
```
version(major): drop legacy API
version(minor): add CSV export
version(patch): fix null check
```

---

## ⚙️ Inputs (overview)

**Reusable workflow** `.github/workflows/auto-version.yml` (`on: workflow_call`)

| Input | Default | Description |
|---|---|---|
| `project_type` | `auto` | `spring` \| `next` \| `plain` \| `auto` (auto‑detect: `package.json` → next, `build.gradle` → spring, otherwise → plain) |
| `default_branch` | `main` | Only bump on this branch |
| `tag_prefix` | `v` | Tag prefix (e.g., `v1.2.3`) |
| `default_version` | `0.0.0` | Seed version when no tag/file exists |
| `next_constants_path` | `src/constants/version.ts` | Next.js constant file path |
| `sync_app_yaml` | `false` | Update `version:` in Spring `src/main/resources/application.yml` if present |
| `workdir` | `""` | Subdirectory in a monorepo (e.g., `backend`, `web`) |
| `dispatch_on_bump` | `true` | Send `repository_dispatch` only when a bump occurred |
| `dispatch_event_type` | `version-bumped` | Event type for follow‑up workflows |
| `plain_version_file` | `VERSION` | Version file path for **plain** projects (create if missing; otherwise overwrite with a single `X.Y.Z` line) |
| `create_release` | `true` | Create a GitHub Release when bumped |
| `release_latest` | `true` | Mark the created release as **latest** |
| `release_prerelease` | `false` | Mark the created release as **prerelease** (M1/RC etc.) |

> The **composite action** (`action.yml`) accepts the same/similar inputs.

---

## 🧩 CHANGELOG policy

- On each release, **prepend** a new version section to the very top.
- On first creation, insert the **banner once** (future entries are added **below** the banner).
- The release commit message **always includes `[skip version]`** to prevent re‑run loops.

Banner example:
```
<!-- vm-banner-start -->
🔧 **Version Management 자동 변경 이력**

이 파일은 중앙 배포 워크플로(**Version Management**)가 자동 생성·유지합니다.
This file is automatically generated and maintained by the centralized workflow (**Version Management**).
제작자(Author): **Chuseok22** · https://github.com/Chuseok22
워크플로 저장소(Workflow repository): https://github.com/Chuseok22/version-management

※ 절대로 이 파일을 임의로 수정하지 마세요
※ Do not edit this file manually.
<!-- vm-banner:end -->
```

---

## 🔒 Requirements & permissions

- Runner: `ubuntu-latest`, Node: `20`
- Permissions: `contents: write`
- Checkout: `actions/checkout@v4` with `fetch-depth: 0` (tags/history required)

---

**Author: [Chuseok22](https://github.com/Chuseok22)** · Repo: https://github.com/Chuseok22/version-management
