# Release Notes — v1.0.0

**Tag:** `v1.0.0`  
**요약:** Spring Boot & Next.js 대상의 **중앙 배포형 자동 버전 관리** 액션/워크플로 **정식 1.0** 릴리스. 커밋 메시지 기반 SemVer bump, 프로젝트 파일 동기화, CHANGELOG prepend, Git Tag 푸시를 일관되게 처리하며, **버전 증가시에만** `repository_dispatch`를 발행해 후속 파이프라인을 조건부 트리거합니다.

## ✨ 주요 기능
- **Commit subject 기반 SemVer bump**: `version(major|min|patch): {메시지}`
- **프로젝트 파일 동기화**
    - Spring Boot: `build.gradle`의 `version` 갱신, (옵션) `application.yml`의 `version:` 키 갱신
    - Next.js: `package.json.version` 갱신 + `src/constants/version.ts` 생성/치환(경로 커스터마이즈 가능) + `package-lock.json` 갱신
- **CHANGELOG 자동 관리**
    - 최상단 prepend
    - 최초 1회 배너 자동 삽입(배너는 유지, 새 릴리스는 배너 아래 누적)
- **Git 태그 생성/푸시**
    - 포맷: `vX.Y.Z`
    - 릴리스 커밋 메시지: `chore(release): vX.Y.Z {메시지} [skip version]`
- **후속 워크플로우 연동**
    - 버전 증가시에만 `repository_dispatch`(기본 `version-bumped`) 송신

## 🔧 사용 예시

### 재사용 워크플로(권장)
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

### 컴포지트 액션 (로직만 직접 호출)
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

## 🐛 개선 사항
- Gradle `version` 인식 강화 (`version = 'X.Y.Z'`/`version 'X.Y.Z'`, `-SNAPSHOT` 접미사 안전 처리, 중복 추가 방지)
- CHANGELOG 배너/헤더 정렬 고정(배너는 항상 최상단 유지)
- 릴리스 커밋 메시지에 원본 subject 설명 자동 포함

## ⚠️ 주의 / 제한
- `default_branch`(기본: `main`)에서만 bump.  
  default 브랜치를 제외한 다른 브랜치의 `version(...)` 커밋은 **스킵(성공 종료)**.
- 컴포지트 액션 단독 사용 시 **dispatch 발행은 포함되지 않음**.  
  dispatch가 필요하면 **재사용 워크플로**를 사용하세요.

## ✅ 요구사항
- Runner: `ubuntu-latest`, Node: `20`
- 권한: `permissions: contents: write`
- 체크아웃: `actions/checkout@v4` + `fetch-depth: 0` 권장
