# version-management

> **GitHub Actions 기반 중앙 배포형 “자동 버전 관리 + 릴리스 생성” (Spring Boot · Next.js · Plain 지원)**  
> 기본 브랜치(`main`)에서 규칙에 맞는 커밋이 푸시되면 **버전 증가 → 프로젝트 파일 동기화 → CHANGELOG 갱신 → Git Tag 생성/푸시 → GitHub Release 생성(자동 노트)**를 표준화된 방식으로 수행합니다.  
> 또한 **버전이 실제로 증가했을 때만** `repository_dispatch` 이벤트를 보내 후속 워크플로우(예: `apk-build.yml`)를 조건부로 트리거합니다.

> **English version** → [README.en.md](README.en.md)

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
    - 버전 증가시에만 `repository_dispatch`(기본 `version-bumped`) 이벤트 송신  
      Payload: `new_version`, `new_tag`, `bump_level`, `sha`

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
- `permissions: contents: write`
- `actions/checkout@v4` + `fetch-depth: 0` 권장(태그/이력 필요)

---

**만든 사람: [Chuseok22](https://github.com/Chuseok22)** · 저장소: https://github.com/Chuseok22/version-management
