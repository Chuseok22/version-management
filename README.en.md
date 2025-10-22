# version-management

> **Centralized, reusable GitHub Actions workflow for automated versioning (Spring Boot & Next.js)**  
> On pushes to the default branch (`main`) with a versioning commit message, this workflow performs **Version bump → Project file sync → CHANGELOG update → Git Tag creation/push** in a standardized way.  
> It also emits a `repository_dispatch` event **only when a version bump actually happens**, so you can trigger follow-up workflows (e.g., `apk-build.yml`) conditionally.

> **한국어 문서** → [README.md](README.md)

---

## 🚀 Features

- **Framework support**
    - **Spring Boot (Gradle Groovy)**: updates `version = 'X.Y.Z'` in `build.gradle`, optionally updates `version:` key in `src/main/resources/application.yml`
    - **Next.js (TypeScript)**: updates `package.json.version` and creates/updates `src/constants/version.ts` (path customizable)
- **Commit-driven bump**
    - `version(major): ...`
    - `version(minor): ...`
    - `version(patch): ...`
- **Policy guarantees**
    - **Bump only on the default branch (`main`)**
    - Detect current version by **Tag → Files → Default seed**
    - **Prepend** a new section to `CHANGELOG.md` (adds a top banner on first creation)
    - Create & push **Git Tag** (`vX.Y.Z`) + push **release commit**
    - Always include **`[skip version]`** in the release commit message (prevents re-run loops)
    - **No bump → still succeeds** (lets other workflows branch based on the outcome)
- **Follow-up workflows**
    - Sends `repository_dispatch` (default: `version-bumped`) **only when bumped**
    - Example: `apk-build.yml` listens with `on: repository_dispatch: types: [ version-bumped ]`

---

## 📦 Repository Layout

```
version-management/
├─ .github/
│  ├─ workflows/
│  │  └─ auto-version.yml                 # Reusable workflow (workflow_call)
│  └─ actions/
│     └─ version-bump/
│        ├─ action.yml                    # Composite action (logic bundle)
│        └─ scripts/
│           ├─ compute-bump.mjs           # Commit check + version calculation
│           ├─ sync-files.mjs             # File sync + commit
│           ├─ update-changelog.mjs       # CHANGELOG prepend (+ initial banner)
│           └─ create-tag.mjs             # Tag create/push + release commit amend
└─ README.md
```

> Why split them?  
> The **reusable workflow** orchestrates pipeline concerns (permissions, concurrency, branch/trigger guards, follow-up dispatch), while the **composite action** packages the actual logic (bump, file updates, changelog, tagging) for reuse anywhere.

---

## 🧭 Quick Start (Consumer repo)

### 1) Use the central reusable workflow (recommended)

**Consumer repo**: `.github/workflows/chuseok22-version-management.yml`

```yaml
name: Version Management (from chuseok22/version-management)

on:
  push:
    branches: [ main ]    # default branch
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
      next_constants_path: "src/constants/version.ts"  # for Next.js
      sync_app_yaml: "false"               # Spring application.yml version update
      workdir: ""                          # subdir in monorepo, e.g., "backend"/"web"
      dispatch_on_bump: "true"             # trigger follow-ups only when bumped
      dispatch_event_type: "version-bumped"
```

> Pin the central repo by tag: `@v1`. Upgrade to newer tags when needed.

### 2) (Advanced) Use only the logic inside your existing CI

Call the **composite action** directly inside a job:

```yaml
jobs:
  some-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - name: Chuseok22 Version bump only (no orchestration)
        uses: chuseok22/version-management/.github/actions/version-bump@v1
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

## ✍️ Commit Convention (Required)

Version is determined **by the commit subject**:

- `version(major): message` → `MAJOR` +1 (MINOR & PATCH = 0)
- `version(minor): message` → `MINOR` +1 (PATCH = 0)
- `version(patch): message` → `PATCH` +1
- Any other commit → **no bump** (workflow still succeeds)

> Examples:  
> `version(major): drop legacy auth endpoints`  
> `version(minor): add CSV export`  
> `version(patch): fix NPE when user is null`

---

## ⚙️ Inputs (Overview)

**Reusable workflow** `.github/workflows/auto-version.yml` (`on: workflow_call`)

| Input | Default | Description |
|---|---|---|
| `project_type` | `auto` | `spring` \| `next` \| `auto` (auto-detect: `package.json` → next, `build.gradle` → spring) |
| `default_branch` | `main` | Only bump on this branch |
| `tag_prefix` | `v` | Tag prefix (e.g., `v1.2.3`) |
| `default_version` | `0.0.0` | Seed when no tag/file exists |
| `next_constants_path` | `src/constants/version.ts` | Next.js constant file path |
| `sync_app_yaml` | `false` | Update `version:` in Spring `src/main/resources/application.yml` if present |
| `workdir` | `""` | Subdirectory in monorepo (e.g., `backend`, `web`) |
| `dispatch_on_bump` | `true` | Send `repository_dispatch` only when bumped |
| `dispatch_event_type` | `version-bumped` | Event type consumed by follow-up workflows |

The **composite action** `.github/actions/version-bump/action.yml` accepts the same/similar inputs.

---

## 🔗 Follow-up Workflow (apk-build) Example

Trigger a build only when a bump actually happened:

**Consumer repo**: `.github/workflows/apk-build.yml`
```yaml
name: APK Build (only after version bump)

on:
  repository_dispatch:
    types: [ version-bumped ]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Show payload
        run: |
          echo "new_version: ${{ github.event.client_payload.new_version }}"
          echo "new_tag:     ${{ github.event.client_payload.new_tag }}"
          echo "bump_level:  ${{ github.event.client_payload.bump_level }}"
          echo "sha:         ${{ github.event.client_payload.sha }}"
      - uses: actions/checkout@v4
      # build/sign/upload artifacts...
```

> For non-version commits, the central workflow exits successfully **without dispatch**, so this workflow **won’t run**.

---

## 🧩 CHANGELOG.md Policy

- On each release, **prepend** a new version section to the top.
- On first creation, a **banner** is added at the very top:
  ```
  <!-- vm-banner:start -->
  🔧 **Version Management Auto Changelog**

  This file is generated & maintained by the central Version Management workflow.
  Author: **Chuseok22** · https://github.com/Chuseok22
  Workflow repo: https://github.com/Chuseok22/version-management

  ※ Manual edits may be overwritten in future releases.
  <!-- vm-banner:end -->
  ```
- The release commit message **always includes `[skip version]`** to avoid re-run loops.

---

## 🔒 Permissions & Tokens

- Declare `permissions: contents: write` in the workflow.
- For tagging/pushing **within the same repo**, the default **`GITHUB_TOKEN`** is sufficient.  
  (A PAT is only needed if you dispatch to **another repo**.)
- `actions/checkout@v4` sets up credentials by default; use `fetch-depth: 0` to read tags & history.

---

## 🧪 Checklist

- [ ] Default branch is `main`
- [ ] Commit **subject** follows the convention (`version(major|min|patch): ...`)
- [ ] Reasonable `default_version` when no tag exists
- [ ] Spring: `build.gradle` present / Next: `package.json` present
- [ ] Next constant path (`next_constants_path`) is correct (e.g., `src/constants/version.ts`)
- [ ] `workdir` set for monorepos
- [ ] On first `CHANGELOG.md`, banner appears once
- [ ] Release commit message contains `[skip version]`

---

## 🤝 Contributing

Issues and PRs are welcome.  
Ideas for improvements (Spring multi-module propagation, GitHub Release generation, banner customization inputs, etc.) are appreciated.

---

## 📄 License

MIT

---

**Author: [Chuseok22](https://github.com/Chuseok22)** · Workflow repo: <https://github.com/Chuseok22/version-management>
