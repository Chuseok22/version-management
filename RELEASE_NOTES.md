# Release Notes — v1.0.0

**Tag:** `v1.0.0`  
**Summary:** Spring Boot & Next.js를 대상으로 한 **중앙 배포형 자동 버전 관리** 액션/워크플로의 첫 정식 릴리스입니다. 커밋 메시지 기반 SemVer bump, 파일 동기화, CHANGELOG prepend, Git Tag 푸시를 일관되게 처리하며, 버전 증가시에만 `repository_dispatch` 이벤트를 발행해 후속 파이프라인(예: 앱 빌드)을 조건부로 트리거할 수 있습니다.

## ✨ 주요 기능
- **Commit subject 기반 SemVer bump:** `version(major|min|patch): {메시지}`
- **프로젝트 파일 동기화**
  - Spring Boot: `build.gradle`의 `version` 갱신, (옵션) `application.yml`의 `version:` 키 갱신
  - Next.js: `package.json.version` 갱신 + `src/constants/version.ts` 생성/치환 (경로 커스터마이즈 가능)
- **CHANGELOG 자동 관리**
  - 최상단 prepend
  - 최초 1회 배너 자동 삽입 (배너는 유지되며 그 아래에 새 릴리스가 누적)
- **Git 태그 생성/푸시**
  - 포맷: `vX.Y.Z`
  - 릴리스 커밋 메시지 자동 생성 (`[skip version]` 포함)
- **후속 워크플로우 연동**
  - 버전 증가시에만 `repository_dispatch`(기본 `version-bumped`) 이벤트 송신

## 🔧 사용 예시
### 재사용 워크플로(권장)
```yaml
jobs:
  versioning:
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

### 컴포지트 액션 (로직만 호출)
```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- uses: chuseok22/version-management/.github/actions/version-bump@v1
  with:
    project_type: auto
    default_branch: main
    tag_prefix: v
    default_version: 0.0.0
    next_constants_path: src/constants/version.ts
    sync_app_yaml: false
    workdir: ""
```

## 🐛 Fixes / 개선사항
- **Gradle `version` 인식 개선**  
  `version = '1.2.3'` 및 `version '1.2.3'` 두 스타일 모두 인식, `-SNAPSHOT` 같은 접미사도 안전 처리. 중복 추가 방지.
- **CHANGELOG 배너/헤더 정렬**  
  최초 1회만 상단 배너 추가, 이후 릴리스는 배너 아래에 순차 prepend.
- **릴리스 커밋 메시지 조합 로직 정리**  
  커밋 subject 설명(`{메시지}`)을 릴리스 커밋 메시지에 자연스럽게 포함:  
  `chore(release): vX.Y.Z {메시지} [skip version]`
- **유틸 공통화 (`utils.mjs`)**  
  git/파일/문자열/버전 관련 공통 메서드 분리로 유지보수성 향상.
- **입력 키 통일**  
  `next_constants_path` 등 문서/코드 간 불일치 해소.

## ⚠️ Breaking / 주의
- 기본 브랜치에서만 bump 처리(`default_branch` 기본값 `main`).  
  다른 브랜치에서의 `version(...)` 커밋은 **스킵(성공 종료)** 됩니다.
- 컴포지트 액션 단독 사용 시 **follow-up dispatch는 포함되지 않음**.  
  dispatch가 필요하면 **재사용 워크플로(`auto-version.yml`)**를 사용하세요.

## ✅ 요구사항
- Runner: `ubuntu-latest`
- Node: `20`
- 권한: `permissions: contents: write`
- 체크아웃: `actions/checkout@v4` + `fetch-depth: 0` 권장

## 🗺️ 향후 로드맵
- Spring 멀티모듈 버전 전파 옵션
- GitHub Release 생성 자동화(릴리스 노트 템플릿)
- 배너/출력 포맷 커스터마이즈 입력 지원
