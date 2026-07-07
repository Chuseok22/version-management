# version-management

> **GitHub Actions 기반 중앙 배포형 “자동 버전 관리 + 릴리스 생성” (Spring Boot · Next.js · Plain 지원)**  
> 기본 브랜치(`main`)에서 규칙에 맞는 커밋이 푸시되면 **버전 증가 → 프로젝트 파일 동기화 → CHANGELOG 갱신 → Git Tag 생성/푸시 → GitHub Release 생성(자동 노트)**를 표준화된 방식으로 수행합니다.  
> 또한 **버전이 실제로 증가했을 때만** `repository_dispatch` 이벤트를 보내 후속 워크플로우(예: `apk-build.yml`)를 조건부로 트리거하거나, 같은 워크플로 파일 안에서 **출력(outputs)을 직접 구독**할 수도 있습니다.

> **English version** → [README.en.md](README.en.md)

---

## 목차

- [🚀 핵심 기능](#-핵심-기능)
- [📦 저장소 구조](#-저장소-구조)
- [🧭 빠른 시작 (소비자 레포)](#-빠른-시작-소비자-레포)
- [✍️ 커밋 규칙 (필수)](#️-커밋-규칙-필수)
- [⚙️ 입력 파라미터 (요약)](#️-입력-파라미터-요약)
- [📤 출력 (Outputs)](#-출력-outputs)
- [🔔 후속 워크플로 연동하기](#-후속-워크플로-연동하기)
- [🧩 CHANGELOG 정책](#-changelog-정책)
- [🔒 권한 & 요구사항](#-권한--요구사항)
- [❓ 자주 묻는 질문 (FAQ)](#-자주-묻는-질문-faq)

---

## 🚀 핵심 기능

- **세 가지 프로젝트 타입 지원**
    - **Spring Boot (Gradle Groovy · Kotlin)**  
      `build.gradle` 또는 `build.gradle.kts`의 `version` 갱신, (옵션) `src/main/resources/application.yml`의 `version:` 키 치환
    - **Next.js (TypeScript)**  
      `package.json.version` 갱신 + `src/constants/version.ts`(경로 커스터마이즈 가능) 생성/치환 + `package-lock.json` 반영
    - **Plain (일반 프로젝트)**  
      루트(또는 지정 경로)의 **버전 파일(`VERSION`)** 을 **생성/치환**하여 새 버전 **한 줄만** 유지  
      · 파일이 없으면 생성 → `X.Y.Z` 작성  
      · 파일이 있으면 **완전 덮어쓰기** → 최종적으로 `X.Y.Z` **한 줄만** 남김
- **커밋 메시지로 버전 제어**
    - `version(major): ...`
    - `version(minor): ...`
    - `version(patch): ...`
- **정책 보장**
    - **기본 브랜치(`main`)에서만** 버전 증가 처리
    - 태그 우선 → 파일 → 기본값 순으로 **현재 버전 인식**  
      · `auto` 탐지: `package.json` → **next**, `build.gradle` → **spring**, 그 외 → **plain**
    - `CHANGELOG.md`는 **상단 prepend** (최초 1회 배너 추가, 이후 배너 아래에 누적)
    - **Git Tag**(`vX.Y.Z`) 생성·푸시 + **릴리즈 커밋** 푸시  
      릴리즈 커밋 메시지: `chore(release): vX.Y.Z {원본 커밋 설명} [skip version]`
    - **버전 증가가 없으면 성공(Success)으로 종료** (파이프라인 분기에 활용)
- **릴리스 & 후속 워크플로우 연동**
    - 버전 증가 시 **GitHub Release 자동 생성** (커밋 설명을 상단에 표시 + 자동 릴리스 노트 병합)
    - 버전 증가시에만 `repository_dispatch`(기본 `version-bumped`) 이벤트 송신 — payload의 `sha`는 항상 **실제 릴리즈 커밋**(새 태그가 가리키는 커밋)을 정확히 가리킵니다.
    - 같은 워크플로 파일 안에서 배포 job을 이어붙일 수 있도록 **job output(`release_commit_sha` 등)** 도 함께 제공합니다.
    - 두 연동 방식의 선택 기준은 [🔔 후속 워크플로 연동하기](#-후속-워크플로-연동하기)를 참고하세요.

---

## 📦 저장소 구조

```
version-management/
├─ action.yml                        # 컴포지트 액션 엔트리 (직접 사용 가능)
├─ scripts/
│  ├─ compute-bump.mjs               # 커밋 검사 + 버전 계산
│  ├─ sync-files.mjs                 # 파일 동기화 + 커밋 (spring/next/plain)
│  ├─ update-changelog.mjs           # CHANGELOG prepend (+ 최초 배너)
│  └─ create-tag.mjs                 # 태그 생성/푸시 + 릴리즈 커밋 정리
└─ .github/
   └─ workflows/
      └─ auto-version.yml            # 재사용(Workflow Call) 오케스트레이터
```
> **왜 분리했나요?**  
> **재사용 워크플로**는 권한/동시성/디스패치/릴리스 생성 등 파이프라인 **오케스트레이션**을 담당하고,  
> **컴포지트 액션**은 실제 **로직(버전계산/파일수정/체인지로그/태깅)** 을 패키징해서 어디서든 재사용할 수 있게 합니다.

---

## 🧭 빠른 시작 (소비자 레포)

### 1) 중앙 **재사용 워크플로** 전체 사용 (권장)

**소비자 레포**: `.github/workflows/chuseok22-version-management.yml`

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
      next_constants_path: "src/constants/version.ts"  # Next.js만 대상
      sync_app_yaml: "false"               # Spring application.yml version 치환
      workdir: ""                          # 모노레포면 "backend"/"web" 등 하위 경로
      dispatch_on_bump: "true"             # 버전 증가시에만 후속 트리거
      dispatch_event_type: "version-bumped"
      plain_version_file: "VERSION"        # Plain 프로젝트일 때 버전 파일 경로

      # 릴리스 옵션 (워크플로 설정에 따라 사용)
      create_release: "true"               # 버전 증가 시 릴리스 생성
      release_latest: "true"               # 최신 릴리스로 표시
      release_prerelease: "false"          # 프리릴리스로 표시(예: M1, RC)
```

> 이 job의 `outputs`를 바로 이어서 쓰고 싶다면 [📤 출력 (Outputs)](#-출력-outputs)과 [🔔 후속 워크플로 연동하기](#-후속-워크플로-연동하기)를 참고하세요.

### 2) (고급) 기존 CI에서 **로직만** 사용

원하는 Job에서 **컴포지트 액션**을 직접 호출합니다.

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

## ✍️ 커밋 규칙 (필수)

**커밋 *제목(subject)* 으로 판정합니다.**

- `version(major): 메시지` → `MAJOR` +1 (MINOR, PATCH = 0)
- `version(minor): 메시지` → `MINOR` +1 (PATCH = 0)
- `version(patch): 메시지` → `PATCH` +1
- 그 외 커밋은 **버전 증가 없음** (워크플로는 성공 종료)

예시:
```
version(major): drop legacy API
version(minor): add CSV export
version(patch): fix null check
```

---

## ⚙️ 입력 파라미터 (요약)

**재사용 워크플로** `.github/workflows/auto-version.yml` (`on: workflow_call`)

| 입력 | 기본값 | 설명 |
|---|---|---|
| `project_type` | `auto` | `spring` \| `next` \| `plain` \| `auto`(자동 탐지: `package.json` → next, `build.gradle` → spring, 그 외 → `plain`) |
| `default_branch` | `main` | 이 브랜치에서만 버전 증가 처리 |
| `tag_prefix` | `v` | 태그 접두어 (예: `v1.2.3`) |
| `default_version` | `0.0.0` | 최초 태그/파일 모두 없을 때 시드 버전 |
| `next_constants_path` | `src/constants/version.ts` | Next.js 상수 파일 경로 |
| `sync_app_yaml` | `false` | Spring `src/main/resources/application.yml`의 `version:` 키 치환(존재 시) |
| `workdir` | `""` | 모노레포 하위 경로 (예: `backend`, `web`) |
| `dispatch_on_bump` | `true` | 버전 증가시에만 `repository_dispatch` 송신 |
| `dispatch_event_type` | `version-bumped` | 후속 워크플로에서 수신할 이벤트 타입 |
| `plain_version_file` | `VERSION` | **Plain** 프로젝트의 버전 파일 경로(없으면 생성, 있으면 내용 전체를 새 버전 한 줄로 치환) |
| `create_release` | `true` | 버전 증가 시 GitHub Release 생성 여부 |
| `release_latest` | `true` | 생성된 릴리스를 최신으로 표시 |
| `release_prerelease` | `false` | 프리릴리스로 표시 (M1/RC 등) |

> **컴포지트 액션**(`action.yml`)도 동일/유사 입력을 받습니다.

---

## 📤 출력 (Outputs)

**재사용 워크플로**(`auto-version.yml`)를 `uses:`로 호출한 job은 아래 값들을 `outputs`로 내보냅니다.

| 출력 | 설명 |
|---|---|
| `version_bumped` | 버전 증가 여부 (`true` / `false`) |
| `bump_level` | `major` \| `minor` \| `patch` \| `none` |
| `new_version` | 증가 후 버전 (예: `1.0.3`) |
| `new_tag` | 증가 후 태그 (예: `v1.0.3`) |
| `release_commit_sha` | **실제 릴리즈 커밋의 SHA** — `new_tag`가 가리키는 커밋과 항상 동일합니다. 버전 증가가 없었던 실행에서는 빈 값입니다. |

같은 워크플로 파일 안에서 다음 job이 이 값들을 바로 이어받을 수 있습니다(`needs.<job_id>.outputs.<name>`):

```yaml
jobs:
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: "auto"
      # ... (위 빠른 시작 예시와 동일)

  publish:
    needs: chuseok22-version-bump
    if: ${{ needs.chuseok22-version-bump.outputs.version_bumped == 'true' }}
    runs-on: ubuntu-latest
    steps:
      # 방금 만들어진 릴리즈 커밋을 정확히 체크아웃
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.chuseok22-version-bump.outputs.release_commit_sha }}

      - run: echo "새 버전 ${{ needs.chuseok22-version-bump.outputs.new_version }} 배포 시작"
```

---

## 🔔 후속 워크플로 연동하기

버전이 증가한 뒤 배포/빌드 같은 후속 작업을 이어가는 방법은 두 가지입니다. **결합도**와 **워크플로 파일 구조**에 따라 선택하세요.

### 방법 A: `workflow_call` job output 직접 구독 (권장)

배포 job을 `chuseok22-version-bump` job을 호출하는 **같은 워크플로 파일**에 둘 수 있다면 이 방법을 권장합니다. 위 [📤 출력 (Outputs)](#-출력-outputs)의 예시처럼 `needs.<job_id>.outputs.*`로 바로 값을 읽으면 됩니다.

- ✅ `repository_dispatch`용 curl 호출, 토큰, payload 파싱이 전혀 필요 없습니다.
- ✅ 같은 job 그래프이므로 값이 어긋날 여지가 구조적으로 없습니다.
- ✅ GitHub Actions UI에서 하나의 워크플로 실행으로 인과관계가 명확히 보입니다.
- ⚠️ 배포 job이 이 워크플로 파일 안에 있어야 하므로, 이미 독립된 워크플로 파일(예: 별도 팀이 관리하는 `npm-publish.yml`)로 나뉘어 있다면 재구조화가 필요합니다.

### 방법 B: `repository_dispatch` 이벤트 구독

**왜 필요한가:** `create-tag.mjs`는 릴리즈 커밋과 태그를 `GITHUB_TOKEN`으로 푸시합니다. GitHub는 무한 루프 방지를 위해 `GITHUB_TOKEN`으로 생성된 push/태그가 **다른 워크플로의 `on: push`나 `on: push: tags:` 트리거를 발생시키지 않도록** 막고 있습니다. 그래서 독립된 워크플로 파일이 "버전이 올라갔다"는 사실을 알아야 한다면, 이 저장소가 직접 이벤트를 쏴주는 `repository_dispatch` 방식이 필요합니다. 여러 워크플로 파일이 같은 이벤트를 각자 독립적으로 구독할 수도 있습니다.

**소비자 레포 리시버 워크플로 예시**: `.github/workflows/on-version-bumped.yml`

```yaml
name: Publish on version bump

on:
  repository_dispatch:
    types: [ version-bumped ]   # dispatch_event_type과 일치해야 함

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      # 반드시 client_payload.sha로 체크아웃하세요 (아래 참고)
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.client_payload.sha }}

      - run: |
          echo "새 버전: ${{ github.event.client_payload.new_version }}"
          echo "태그: ${{ github.event.client_payload.new_tag }}"
          echo "레벨: ${{ github.event.client_payload.bump_level }}"
          echo "릴리즈 커밋: ${{ github.event.client_payload.sha }}"
```

**Payload:**

| 필드 | 설명 |
|---|---|
| `new_version` | 증가 후 버전 |
| `new_tag` | 증가 후 태그 |
| `bump_level` | `major` \| `minor` \| `patch` |
| `sha` | 실제 릴리즈 커밋의 SHA (= `new_tag`가 가리키는 커밋과 항상 동일) |

> ⚠️ **`ref`는 반드시 `client_payload.sha`로 체크아웃하세요.** 기본 브랜치(`main`)를 그대로 체크아웃하면, 이 워크플로가 실행되는 시점에 따라 방금 올라간 버전이 아닌 다른 커밋을 보게 될 수 있습니다.

### 두 방법 비교

| | 방법 A: job output | 방법 B: `repository_dispatch` |
|---|---|---|
| 결합도 | 강함 (같은 워크플로 파일) | 느슨함 (독립 워크플로 파일, 다중 구독 가능) |
| 설정 복잡도 | 낮음 (`needs.<job>.outputs.*`) | 중간 (리시버 워크플로 + payload 파싱) |
| 값 정확성 | 같은 job 그래프라 항상 일치 | 항상 실제 릴리즈 커밋을 가리킴 (`sha` = `release_commit_sha`) |
| 추천 상황 | 배포 job을 이 워크플로 파일에 둘 수 있을 때 | 독립된 워크플로 파일을 유지해야 하거나, 여러 워크플로가 동시에 반응해야 할 때 |

---

## 🧩 CHANGELOG 정책

- 매 릴리스 시 **최상단에 새 버전 섹션을 prepend**.
- **최초 1회** 상단 **배너** 추가(그 이후에는 배너 아래에 새 항목이 누적).
- 릴리스 커밋 메시지에는 **`[skip version]`** 토큰이 항상 포함되어 재실행 루프를 방지합니다.

배너(예시):
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

## 🔒 권한 & 요구사항

- Runner: `ubuntu-latest`, Node: `20`
- `permissions: contents: write` (파일/태그/릴리즈 커밋 푸시), `actions: read` (재사용 워크플로 호출)
- `actions/checkout@v4` + `fetch-depth: 0` 권장(태그/이력 필요)

---

## ❓ 자주 묻는 질문 (FAQ)

**Q. 커밋을 푸시했는데 버전이 안 올라가요.**  
A. 커밋 *제목(subject)*이 `version(major|minor|patch): 메시지` 형식과 정확히 일치하는지, 그리고 `default_branch`(기본 `main`)에 푸시했는지 확인하세요. 형식이 안 맞으면 워크플로는 **성공으로 종료**되지만 버전은 증가하지 않습니다.

**Q. 워크플로가 릴리즈 커밋 때문에 다시 트리거되지 않나요?**  
A. 릴리즈 커밋 메시지에는 항상 `[skip version]` 토큰이 포함됩니다. 커밋 메시지 검사 로직을 별도로 우회하는 워크플로를 쓰고 있다면 이 토큰 존재 여부를 확인하세요.

**Q. `repository_dispatch`가 안 와요.**  
A. `dispatch_on_bump` 입력이 `"true"`인지, 소비 워크플로의 `on.repository_dispatch.types`가 `dispatch_event_type`(기본 `version-bumped`)과 정확히 일치하는지 확인하세요. 버전이 증가하지 않은 실행에서는 애초에 이벤트가 전송되지 않습니다.

**Q. `release_commit_sha` / payload의 `sha`가 비어 있거나 이상해요.**  
A. `version_bumped: false`인 실행에서는 값이 비어 있는 것이 정상입니다. 버전이 증가했는데도 비어 있다면, 워크플로 파일이 참조하는 `@v1`과 그 안에서 `create-tag.mjs`를 실행하는 컴포지트 액션이 참조하는 `@v1`이 서로 다른 시점에 각각 해석되어, 그 사이에 floating 태그가 이동한 극히 드문 타이밍일 수 있습니다(이 경우 `create-tag` 스텝 자체는 실패 없이 정상 종료합니다) — 이때 `repository_dispatch`의 `sha`는 자동으로 `github.sha`로 폴백됩니다.

**Q. 여러 소비자 워크플로가 동시에 버전 증가를 알아야 해요.**  
A. [방법 B(`repository_dispatch`)](#-후속-워크플로-연동하기)를 쓰세요. 여러 워크플로 파일이 같은 이벤트 타입을 각자 독립적으로 구독할 수 있습니다.

---

**만든 사람: [Chuseok22](https://github.com/Chuseok22)** · 저장소: https://github.com/Chuseok22/version-management
