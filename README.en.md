# version-management

> **Centralized, reusable GitHub Actions workflow for automated versioning **and release creation** (Spring Boot · Next.js · Plain)**  
> On pushes to the default branch (`main`) with a compliant commit message, this project performs **Version bump → Project file sync → CHANGELOG update → Git Tag creation/push → GitHub Release creation (auto notes)** in a standardized way.  
> It also emits a `repository_dispatch` event **only when a version bump actually happens**, so you can trigger follow‑up workflows (e.g., `apk-build.yml`) conditionally — or subscribe directly to this workflow's **outputs** from a job in the same workflow file.

> **Korean docs** → [README.md](README.md)

---

## Table of contents

- [🚀 Features](#-features)
- [📦 Repository layout](#-repository-layout)
- [🧭 Quick start (consumer repo)](#-quick-start-consumer-repo)
- [✍️ Commit convention (required)](#️-commit-convention-required)
- [⚙️ Inputs (overview)](#️-inputs-overview)
- [📤 Outputs](#-outputs)
- [🔔 Wiring up follow-up workflows](#-wiring-up-follow-up-workflows)
- [🧩 CHANGELOG policy](#-changelog-policy)
- [🔒 Requirements & permissions](#-requirements--permissions)
- [❓ FAQ](#-faq)

---

## 🚀 Features

- **Three project types supported**
    - **Spring Boot (Gradle Groovy · Kotlin)**  
      Updates `version` in `build.gradle` or `build.gradle.kts`, and optionally replaces the `version:` key in `src/main/resources/application.yml`.
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
    - On bump, **create a GitHub Release** (commit description prepended to auto release notes)
    - Sends `repository_dispatch` (default: `version-bumped`) **only when bumped** — the payload's `sha` always points to the **actual release commit** (the commit the new tag points to).
    - Also exposes a **job output** (`release_commit_sha`, etc.) so a follow-up job in the same workflow file can chain directly, without dispatch.
    - See [🔔 Wiring up follow-up workflows](#-wiring-up-follow-up-workflows) for how to choose between the two.

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

> If you want to chain straight off this job's `outputs`, see [📤 Outputs](#-outputs) and [🔔 Wiring up follow-up workflows](#-wiring-up-follow-up-workflows).

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

## 📤 Outputs

A job that calls the **reusable workflow** (`auto-version.yml`) with `uses:` exposes these `outputs`:

| Output | Description |
|---|---|
| `version_bumped` | Whether a version bump happened (`true` / `false`) |
| `bump_level` | `major` \| `minor` \| `patch` \| `none` |
| `new_version` | Version after the bump (e.g., `1.0.3`) |
| `new_tag` | Tag after the bump (e.g., `v1.0.3`) |
| `release_commit_sha` | **SHA of the actual release commit** — always identical to the commit `new_tag` points to. Empty when no bump occurred in this run. |

A following job in the same workflow file can chain directly off these (`needs.<job_id>.outputs.<name>`):

```yaml
jobs:
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: "auto"
      # ... (same as the quick-start example above)

  publish:
    needs: chuseok22-version-bump
    if: ${{ needs.chuseok22-version-bump.outputs.version_bumped == 'true' }}
    runs-on: ubuntu-latest
    steps:
      # Check out exactly the release commit that was just created
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.chuseok22-version-bump.outputs.release_commit_sha }}

      - run: echo "Deploying new version ${{ needs.chuseok22-version-bump.outputs.new_version }}"
```

---

## 🔔 Wiring up follow-up workflows

There are two ways to chain a deploy/build step after a version bump. Choose based on **coupling** and how your workflow files are structured.

### Option A: subscribe to `workflow_call` job outputs directly (recommended)

If your deploy job can live in the **same workflow file** as the one calling `chuseok22-version-bump`, prefer this. Read values directly via `needs.<job_id>.outputs.*`, as shown in the [📤 Outputs](#-outputs) example above.

- ✅ No `repository_dispatch` curl call, no token, no payload parsing.
- ✅ Same job graph — there is no way for the values to drift apart.
- ✅ One workflow run in the Actions UI, so the causal chain is easy to see.
- ⚠️ Your deploy job must live in this workflow file — if it's already a separate file (e.g., an `npm-publish.yml` owned by a different team), you'll need to restructure.

### Option B: subscribe to a `repository_dispatch` event

**Why this exists:** `create-tag.mjs` pushes the release commit and tag using `GITHUB_TOKEN`. To prevent infinite loops, GitHub does **not** let pushes/tags created by `GITHUB_TOKEN` trigger another workflow's `on: push` or `on: push: tags:`. So if an independent workflow file needs to learn "a version was bumped," this repo has to actively send it an event — that's what `repository_dispatch` is for. Multiple independent workflow files can each subscribe to the same event.

**Example receiver workflow in the consumer repo**: `.github/workflows/on-version-bumped.yml`

```yaml
name: Publish on version bump

on:
  repository_dispatch:
    types: [ version-bumped ]   # must match dispatch_event_type

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      # Always check out client_payload.sha (see note below)
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.client_payload.sha }}

      - run: |
          echo "New version: ${{ github.event.client_payload.new_version }}"
          echo "Tag: ${{ github.event.client_payload.new_tag }}"
          echo "Level: ${{ github.event.client_payload.bump_level }}"
          echo "Release commit: ${{ github.event.client_payload.sha }}"
```

**Payload:**

| Field | Description |
|---|---|
| `new_version` | Version after the bump |
| `new_tag` | Tag after the bump |
| `bump_level` | `major` \| `minor` \| `patch` |
| `sha` | SHA of the actual release commit (always identical to the commit `new_tag` points to) |

> ⚠️ **Always check out `ref: client_payload.sha`.** If you check out the default branch (`main`) instead, depending on timing you may see a commit other than the one that was just released. The payload's `sha` always points precisely to the actual release commit.

### Comparing the two options

| | Option A: job outputs | Option B: `repository_dispatch` |
|---|---|---|
| Coupling | Tight (same workflow file) | Loose (independent workflow files, multiple subscribers) |
| Setup complexity | Low (`needs.<job>.outputs.*`) | Medium (receiver workflow + payload parsing) |
| Value correctness | Always consistent — same job graph | Always points to the actual release commit (`sha` = `release_commit_sha`) |
| Best for | When the deploy job can live in this workflow file | When you must keep an independent workflow file, or need multiple workflows to react at once |

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
- Permissions: `contents: write` (pushing files/tags/release commits), `actions: read` (calling the reusable workflow)
- Checkout: `actions/checkout@v4` with `fetch-depth: 0` (tags/history required)

---

## ❓ FAQ

**Q. I pushed a commit but the version didn't bump.**  
A. Check that the commit *subject* exactly matches `version(major|minor|patch): message`, and that it was pushed to `default_branch` (default `main`). If the format doesn't match, the workflow still **succeeds**, but no bump happens.

**Q. Doesn't the release commit re-trigger the workflow?**  
A. The release commit message always includes the `[skip version]` token. If you have another workflow that bypasses the normal commit-message check, verify it respects this token.

**Q. `repository_dispatch` never arrives.**  
A. Check that `dispatch_on_bump` is `"true"`, and that the consumer workflow's `on.repository_dispatch.types` exactly matches `dispatch_event_type` (default `version-bumped`). No event is sent at all when a run doesn't bump the version.

**Q. `release_commit_sha` / the payload's `sha` is empty or looks wrong.**  
A. An empty value is expected on a run where `version_bumped` is `false`. If it's empty despite a bump happening, you may have hit the narrow timing window where the floating tag `chuseok22/version-management@v1` was mid-move — in that case, the dispatch's `sha` automatically falls back to `github.sha`.

**Q. Multiple consumer workflows need to know about a version bump at the same time.**  
A. Use [Option B (`repository_dispatch`)](#-wiring-up-follow-up-workflows) — any number of independent workflow files can each subscribe to the same event type.

---

**Author: [Chuseok22](https://github.com/Chuseok22)** · Repo: https://github.com/Chuseok22/version-management
