# version-management

> **Centralized, reusable GitHub Actions workflow for automated versioning (Spring Boot & Next.js)**  
> On pushes to the default branch (`main`) with a compliant commit message, this project performs **Version bump → Project file sync → CHANGELOG update → Git Tag creation/push** in a standardized way.  
> It also emits a `repository_dispatch` event **only when a version bump actually happens**, so you can trigger follow‑up workflows (e.g., `apk-build.yml`) conditionally.

> **한국어 문서** → [README.md](README.md)

---

## 🚀 Features

- **Two frameworks supported**
    - **Spring Boot (Gradle/Groovy)**: updates `version` in `build.gradle`, optionally replaces the `version:` key in `src/main/resources/application.yml`
    - **Next.js (TypeScript)**: updates `package.json.version` and creates/updates `src/constants/version.ts` (path is configurable)
- **Commit‑driven versioning**
    - `version(major): ...`
    - `version(minor): ...`
    - `version(patch): ...`
- **Policy guarantees**
    - Bump **only on the default branch (`main`)**
    - Detect current version in order: **Tag → Files → Default value**
    - `CHANGELOG.md` is **prepended at the top** (insert banner only once; subsequent entries accumulate **under** the banner)
    - Create & push **Git Tag** (`vX.Y.Z`) + push **release commit**  
      Release commit message: `chore(release): vX.Y.Z {original subject description} [skip version]`
    - **No bump → workflow still succeeds** (handy for pipeline branching)
- **Follow‑up workflow integration**
    - Sends `repository_dispatch` only when the version actually bumped (default event: `version-bumped`)
    - Payload: `new_version`, `new_tag`, `bump_level`, `sha`

---

## 📦 Repository layout

```
version-management/
├─ action.yml                        # Composite action entry (can be used directly)
├─ scripts/
│  ├─ compute-bump.mjs               # Commit inspection + version calculation
│  ├─ sync-files.mjs                 # File sync + commit
│  ├─ update-changelog.mjs           # CHANGELOG prepend (+ initial banner)
│  └─ create-tag.mjs                 # Tag create/push + release commit handling
└─ .github/
   └─ workflows/
      └─ auto-version.yml            # Reusable workflow (workflow_call) orchestrator
```
> **Why split it like this?**  
> The **reusable workflow** handles pipeline orchestration (permissions, concurrency, dispatch), while the **composite action** bundles the actual logic (bump/file updates/changelog/tagging) so it can be reused anywhere.

---

## 🧭 Quick start (consumer repo)

### 1) Use the **reusable workflow** (recommended)

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
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: "auto"                 # spring | next | auto
      default_branch: "main"
      tag_prefix: "v"
      default_version: "0.0.0"
      next_constants_path: "src/constants/version.ts"  # for Next.js only
      sync_app_yaml: "false"               # Spring application.yml version update
      workdir: ""                          # subdir in a monorepo, e.g., "backend"/"web"
      dispatch_on_bump: "true"             # trigger follow-ups only when bumped
      dispatch_event_type: "version-bumped"
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
| `project_type` | `auto` | `spring` \| `next` \| `auto` (auto-detect: `package.json` → next, `build.gradle` → spring) |
| `default_branch` | `main` | Only bump on this branch |
| `tag_prefix` | `v` | Tag prefix (e.g., `v1.2.3`) |
| `default_version` | `0.0.0` | Seed version when no tag/file exists |
| `next_constants_path` | `src/constants/version.ts` | Next.js constant file path |
| `sync_app_yaml` | `false` | Update `version:` in Spring `src/main/resources/application.yml` if present |
| `workdir` | `""` | Subdirectory in a monorepo (e.g., `backend`, `web`) |
| `dispatch_on_bump` | `true` | Send `repository_dispatch` only when a bump occurred |
| `dispatch_event_type` | `version-bumped` | Event type for follow-up workflows |

> The **composite action** (`action.yml`) accepts the same/similar inputs.

---

## 🧩 CHANGELOG policy

- On each release, **prepend** a new version section to the very top.
- On first creation, insert the **banner once** (future entries are added **below** the banner).
- The release commit message **always includes `[skip version]`** to prevent re-run loops.

Banner example:
```
<!-- vm-banner:start -->
🔧 **Version Management Auto Change History**

This file is automatically generated and maintained by the centralized workflow (**Version Management**).
Author: **Chuseok22** · https://github.com/Chuseok22
Workflow repo: https://github.com/Chuseok22/version-management

※ Manual edits may be overwritten in future releases.
<!-- vm-banner:end -->
```

---

## 🔒 Requirements & permissions

- Runner: `ubuntu-latest`, Node: `20`
- Permissions: `contents: write`
- Checkout: `actions/checkout@v4` with `fetch-depth: 0` (tags/history required)

---

**Author: [Chuseok22](https://github.com/Chuseok22)** · Repo: https://github.com/Chuseok22/version-management
