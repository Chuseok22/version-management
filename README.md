# version-management

> **GitHub Actions 기반 중앙 배포형 “자동 버전 관리” (Spring Boot & Next.js 지원)**  
> 기본 브랜치(`main`)에서 커밋 메시지 규칙에 맞는 푸시가 발생하면 **버전 증가 → 프로젝트 파일 동기화 → CHANGELOG 갱신 → Git Tag 생성/푸시**를 표준화된 방식으로 수행합니다.  
> 또한 **버전이 실제로 증가했을 때만** `repository_dispatch` 이벤트를 보내 후속 워크플로우(예: `apk-build.yml`)를 트리거할 수 있습니다.

> **English version** → [README.en.md](README.en.md)

---

## 🚀 핵심 기능

- **두 프레임워크 지원**
    - **Spring Boot(Gradle Groovy)**: `build.gradle`의 `version = 'X.Y.Z'` 갱신 (옵션) `src/main/resources/application.yml`의 `version:` 키 치환
    - **Next.js(TypeScript)**: `package.json.version` 갱신 + `src/constants/version.ts`(경로 커스터마이즈 가능) 생성/치환
- **커밋 메시지로 버전 제어**
    - `version(major): ...`
    - `version(minor): ...`
    - `version(patch): ...`
- **정책 보장**
    - **기본 브랜치(`main`)에서만** 버전 증가 처리
    - 태그 우선 → 파일 → 기본값 순으로 **현재 버전 인식**
    - `CHANGELOG.md`를 **상단 prepend** (최초 생성 시 상단 배너 추가)
    - **Git Tag**(`vX.Y.Z`) 생성·푸시 + **릴리즈 커밋** 푸시
    - 릴리즈 커밋 메시지에 **`[skip version]`** 자동 포함(재실행 루프 방지)
    - **버전 증가가 없으면 성공(Success)으로 종료** (다른 워크플로우에서 조건 분기 용이)
- **후속 워크플로우 연동**
    - 버전 증가시에만 `repository_dispatch`(기본 `version-bumped`) 이벤트 송신
    - 예: `apk-build.yml`을 `on: repository_dispatch: types: [ version-bumped ]` 로 받아 실행

---

## 📦 저장소 구조

```
version-management/
├─ .github/
│  ├─ workflows/
│  │  └─ auto-version.yml                 # 재사용(Reusable) 워크플로 (workflow_call)
│  └─ actions/
│     └─ version-bump/
│        ├─ action.yml                    # 컴포지트 액션 (로직 패키징)
│        └─ scripts/
│           ├─ compute-bump.mjs           # 커밋 검사 + 버전 계산
│           ├─ sync-files.mjs             # 파일 동기화 + 커밋
│           ├─ update-changelog.mjs       # CHANGELOG prepend (+ 최초 배너)
│           └─ create-tag.mjs             # 태그 생성/푸시 + 릴리즈 커밋 정리
└─ README.md
```

> 왜 분리했나요? → **재사용 워크플로**는 파이프라인 오케스트레이션(권한, 동시성, 브랜치/트리거, 후속 dispatch), **컴포지트 액션**은 실제 로직(버전계산/파일수정/태깅) 재사용을 담당합니다.

---

## 🧭 빠른 시작 (소비자 레포)

### 1) 중앙 워크플로 통째로 사용 (권장)

**소비자 레포 예시**: `.github/workflows/chuseok22-version-management.yml`

```yaml
name: Version Management (from chuseok22/version-management)

on:
  push:
    branches: [ main ]    # 기본 브랜치
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
      next_constants_path: "src/constants/version.ts"  # Next.js만 대상
      sync_app_yaml: "false"               # Spring application.yml version 치환
      workdir: ""                          # 모노레포면 "backend"/"web" 등 하위 경로
      dispatch_on_bump: "true"             # 버전 증가시에만 후속 트리거
      dispatch_event_type: "version-bumped"
```

> 중앙 레포는 **태그로 고정**해 사용하세요: `@v1` (중앙 레포가 업데이트되면 새 태그로 마이그레이션)

### 2) (고급) 기존 CI 내부에서 로직만 사용

원하는 Job 안에서 **컴포지트 액션**을 직접 호출합니다.

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

## ✍️ 커밋 규칙 (필수)

**반드시 커밋 *제목(subject)* 으로 판정합니다.**

- `version(major): 메시지` → `MAJOR` +1 (MINOR, PATCH = 0)
- `version(minor): 메시지` → `MINOR` +1 (PATCH = 0)
- `version(patch): 메시지` → `PATCH` +1
- 그 외 커밋은 **버전 증가 없음** (워크플로는 성공 종료)

> 예:  
> `version(major): drop legacy auth endpoints`  
> `version(minor): add CSV export`  
> `version(patch): fix NPE when user is null`

---

## ⚙️ 입력 파라미터 (요약)

**재사용 워크플로** `.github/workflows/auto-version.yml` (`on: workflow_call`)

| 입력 | 기본값 | 설명 |
|---|---|---|
| `project_type` | `auto` | `spring` \| `next` \| `auto`(자동 탐지: `package.json` → next, `build.gradle` → spring) |
| `default_branch` | `main` | 이 브랜치에서만 버전 증가 처리 |
| `tag_prefix` | `v` | 태그 접두어 (예: `v1.2.3`) |
| `default_version` | `0.0.0` | 최초 태그/파일 모두 없을 때 시드 버전 |
| `next_constants_path` | `src/constants/version.ts` | Next.js 상수 파일 경로 |
| `sync_app_yaml` | `false` | Spring `src/main/resources/application.yml`의 `version:` 키 치환(존재할 때만) |
| `workdir` | `""` | 모노레포 하위 경로 (예: `backend`, `web`) |
| `dispatch_on_bump` | `true` | 버전 증가시에만 `repository_dispatch` 송신 |
| `dispatch_event_type` | `version-bumped` | 후속 워크플로우에서 수신할 이벤트 타입 |

**컴포지트 액션** `.github/actions/version-bump/action.yml` 도 동일/유사 입력을 받습니다.

---

## 🔗 후속 워크플로우 연동 예시 (apk-build)

버전이 실제로 증가했을 때만 **자동 트리거**되도록 구성:

**소비자 레포**: `.github/workflows/apk-build.yml`
```yaml
name: APK Build (only after version bump)

on:
  repository_dispatch:
    types: [ version-bumped ]   # 중앙 워크플로가 버전 증가시에만 송신

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
      # 실제 빌드/사이닝/아티팩트 업로드 등...
```

> 일반 커밋 시에는 중앙 워크플로가 **성공 종료**하지만 **dispatch를 보내지 않으므로** 위 워크플로는 **아예 실행되지 않습니다.**

---

## 🧩 CHANGELOG.md 정책

- 매 릴리스 시 **최상단에 새 버전 섹션을 prepend** 합니다.
- **최초 생성 시 1회** 아래와 같은 **배너**가 **맨 위**에 들어갑니다:
  ```
  <!-- vm-banner:start -->
  🔧 **Version Management 자동 변경 이력**

  이 파일은 중앙 배포 워크플로(**Version Management**)가 자동 생성·유지합니다.
  제작자: **Chuseok22** · https://github.com/Chuseok22
  워크플로 저장소: https://github.com/Chuseok22/version-management

  ※ 수동 편집 내용은 향후 릴리스에서 덮어씌워질 수 있습니다.
  <!-- vm-banner:end -->
  ```
- 릴리스 커밋 메시지에는 **항상 `[skip version]`** 토큰이 포함되어, 다음 실행 루프를 방지합니다.

---

## 🔒 권한 & 토큰

- 중앙 워크플로에서 `permissions: contents: write` 를 선언합니다.
- **동일 레포 내에서** 태깅/푸시는 **기본 `GITHUB_TOKEN`** 으로 충분합니다.  
  (추가 PAT 불필요. 단, **다른 저장소로 `repository_dispatch`** 를 보내려면 PAT가 필요합니다.)
- `actions/checkout@v4` 는 기본적으로 자격 증명을 설정하므로 별도 설정 없이 `git push` 가 동작합니다. (fetch-depth는 **0** 권장)

---

## 🧪 점검 체크리스트

- [ ] 기본 브랜치(`main`)가 맞는지
- [ ] 커밋 **제목(subject)** 이 규칙에 맞는지 (`version(major|min|patch): ...`)
- [ ] **태그가 없을 때** `default_version` 값이 합리적인지
- [ ] Spring: `build.gradle` 존재 / Next: `package.json` 존재
- [ ] Next 상수 경로(`next_constants_path`)가 올바른지 (`src/constants/version.ts` 등)
- [ ] 모노레포인 경우 `workdir` 지정했는지
- [ ] `CHANGELOG.md` 최초 생성 시 배너 1회 삽입 확인
- [ ] 릴리스 커밋 메시지에 `[skip version]` 포함되어 재실행 루프가 없는지

---

## 🤝 기여

이슈/PR 환영합니다.  
문서/로직 개선(예: Spring 멀티모듈, Release 생성 자동화, 배너 커스터마이즈 옵션 노출 등) 제안 부탁드립니다.

---

## 📄 라이선스

MIT

---

**만든 사람: [Chuseok22](https://github.com/Chuseok22)** · 워크플로 저장소: <https://github.com/Chuseok22/version-management>
