# Release Notes — v1.0.0

**Tag:** `v1.0.0`  
**요약:** Spring Boot · Next.js · **Plain(일반 프로젝트)** 대상의 **중앙 배포형 자동 버전 관리 + 릴리스 생성** 워크플로/액션 **정식 1.0** 릴리스. 커밋 메시지 기반 SemVer bump, 프로젝트 파일 동기화, CHANGELOG prepend, Git Tag 푸시를 일관되게 처리하며, **버전 증가시에만** `repository_dispatch`를 발행해 후속 파이프라인을 조건부 트리거합니다. 릴리스 시에는 자동 릴리스 노트를 생성합니다.

## ✨ 주요 기능
- **Commit subject 기반 SemVer bump**: `version(major|min|patch): {메시지}`
- **프로젝트 파일 동기화**
    - **Spring Boot**: `build.gradle`의 `version` 갱신, (옵션) `src/main/resources/application.yml`의 `version:` 키 갱신
    - **Next.js**: `package.json.version` 갱신 + `src/constants/version.ts` 생성/치환(경로 커스터마이즈 가능) + `package-lock.json` 갱신
    - **Plain(일반 프로젝트)**: 지정된 경로의 **버전 파일(`VERSION`)** 을 **생성/치환**하여 **새 버전 한 줄만** 유지
        - 파일이 없으면 생성 → `X.Y.Z` 한 줄 작성
        - 파일이 있으면 **내용 전체를 새 버전 한 줄로 덮어쓰기**
- **CHANGELOG 자동 관리**
    - 최상단 prepend
    - 최초 1회 배너 자동 삽입(배너는 유지, 새 릴리스는 배너 아래 누적)
- **Git 태그 생성/푸시**
    - 포맷: `vX.Y.Z`
    - 릴리스 커밋 메시지: `chore(release): vX.Y.Z {메시지} [skip version]`
- **GitHub Release 자동 생성**
    - 버전 증가 시 릴리스를 생성하고 자동 릴리스 노트를 추가
- **후속 워크플로우 연동**
    - 버전 증가시에만 `repository_dispatch`(기본 `version-bumped`) 송신

## 🔧 사용 예시

### 재사용 워크플로(권장)
```yaml
jobs:
  chuseok22-version-bump:
    uses: chuseok22/version-management/.github/workflows/auto-version.yml@v1
    with:
      project_type: auto                  # spring | next | plain | auto
      default_branch: main
      tag_prefix: v
      default_version: 0.0.0
      next_constants_path: src/constants/version.ts  # Next.js만 대상
      sync_app_yaml: false                # Spring application.yml version 치환
      workdir: ""                         # 모노레포면 하위 경로 지정
      dispatch_on_bump: true              # 버전 증가시에만 후속 트리거
      dispatch_event_type: version-bumped
      plain_version_file: VERSION         # Plain 프로젝트 버전 파일 경로

      # 릴리스 옵션
      create_release: true
      release_latest: true
      release_prerelease: false
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
    plain_version_file: VERSION
```

## 🐛 개선 사항
- **Plain 프로젝트 지원 추가**: `VERSION` 파일 자동 생성/치환(새 버전 한 줄만 유지), 입력값 `plain_version_file` 제공
- **태그 매칭 개선**: `v1.0.14` 등 **두 자리 이상** 버전 세그먼트도 안정적으로 인식
- **Auto 감지 로직**: `package.json` → **next**, `build.gradle` → **spring**, 그 외 → **plain**
- **릴리스 커밋 메시지 정규화**: 원본 subject 설명 포함 + `[skip version]` 자동 포함
- **CHANGELOG 배너/헤더 정렬 고정**: 배너는 항상 최상단 유지
- **GitHub Release 자동 생성 추가**: 버전 증가 시 자동 릴리스 노트 포함

## ⚠️ 주의 / 제한
- `default_branch`(기본: `main`)에서만 bump.  
  기본 브랜치를 제외한 다른 브랜치의 `version(...)` 커밋은 **스킵(성공 종료)**.
- **컴포지트 액션 단독 사용** 시 `repository_dispatch` 발행은 포함되지 않음.  
  dispatch가 필요하면 **재사용 워크플로**를 사용하세요.

## ✅ 요구사항
- Runner: `ubuntu-latest`, Node: `20`
- 권한: `permissions: contents: write`
- 체크아웃: `actions/checkout@v4` + `fetch-depth: 0` 권장
