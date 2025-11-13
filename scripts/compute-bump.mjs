#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { detectProjectType, parseSemverXyz, resolveGradleFilePath, setOutput, tryExecOut } from "./utils.mjs";

/**
 * projectType 자동 판별 (Next.js / Spring Boot / Plain)
 * 커밋 subject 검증: version(major|minor|patch): {message}
 * 태그/파일/기본값 기반으로 버전 계산 후 bump
 */

const inputs = {
  projectType: process.env.INPUT_PROJECT_TYPE ?? 'auto',
  defaultBranch: process.env.INPUT_DEFAULT_BRANCH ?? 'main',
  tagPrefix: process.env.INPUT_TAG_PREFIX ?? 'v',
  defaultVersion: process.env.INPUT_DEFAULT_VERSION ?? '0.0.0',
  workdir: process.env.INPUT_WORKDIR ?? '',
  plainVersionFile: process.env.INPUT_PLAIN_VERSION_FILE ?? 'VERSION',
  refName: process.env.GITHUB_REF_NAME ?? '',
  actor: process.env.GITHUB_ACTOR ?? '',
};

const repoRoot = process.cwd();
const workdir = inputs.workdir ? path.join(repoRoot, inputs.workdir) : repoRoot;

// main 브랜치 강제
if (inputs.refName && inputs.refName !== inputs.defaultBranch) {
  console.log(`[skip] default branch가 아닙니다: ${inputs.refName} (required: ${inputs.defaultBranch})`);
  setOutput('version_bumped', 'false');
  setOutput('bump_level', 'none');
  process.exit(0);
}

// 커밋 메시지 확인
const commitSubject = tryExecOut('git log -1 --format=%s');
const commitSha = tryExecOut('git rev-parse --short HEAD');
setOutput('commit_subject', commitSubject);
setOutput('commit_sha', commitSha);

const m = commitSubject.match(/^\s*version\s*\(\s*(major|minor|patch)\s*\)\s*:\s*(.+)\s*$/i);
if (!m) {
  console.log("[skip] 커밋 형태가 'version(major | minor | patch): {commit-message}' 패턴이 아닙니다.")
  setOutput('version_bumped', 'false');
  setOutput('bump_level', 'none');
  process.exit(0);
}
const bumpLevel = m[1].toLowerCase();
setOutput('bump_level', bumpLevel);

// 프로젝트 타입 자동 판별
let projectType = detectProjectType(workdir, inputs.projectType);
setOutput('project_type', projectType);

// 현재 버전 소스: 태그 우선 -> 파일 -> default_version
const tagPattern = `${inputs.tagPrefix}[0-9][0-9]*.[0-9][0-9]*.[0-9][0-9]*`;
const lastTag = tryExecOut(`git describe --tags --abbrev=0 --match "${tagPattern}"`);

let [currentMajor, currentMinor, currentPatch] = [0, 0, 0];

if (lastTag) {
  const raw = lastTag.replace(new RegExp(`^${inputs.tagPrefix}`), '');
  const parsed = parseSemverXyz(raw);
  if (parsed) {
    [currentMajor, currentMinor, currentPatch] = parsed;
  }
} else {
  // 파일에서 시도
  if (projectType === 'next') {
    const packageJsonPath = path.join(workdir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const parseVersion = parseSemverXyz(packageJson.version || '');
      if (parseVersion) {
        [currentMajor, currentMinor, currentPatch] = parseVersion;
      }
    }
  } else if (projectType === 'spring') {
    const gradlePath = resolveGradleFilePath(workdir);
    if (existsSync(gradlePath)) {
      const txt = readFileSync(gradlePath, 'utf8');

      // version = '1.0.2[-...]' & version '1.0.2[-...]' 스타일 모두 허용 (접미사 허용)
      const mmAssign = txt.match(/^\s*version\s*=\s*['"](\d+\.\d+\.\d+)(?:-[^'"]+)?['"]/m);
      const mmMethod = txt.match(/^\s*version\s+['"](\d+\.\d+\.\d+)(?:-[^'"]+)?['"]/m);
      const found = (mmAssign?.[1] || mmMethod?.[1]) ?? '';
      const parsed = parseSemverXyz(found);

      if (parsed) {
        [currentMajor, currentMinor, currentPatch] = parsed;
      }
    }
  } else if (projectType === 'plain') {
    const versionFilePath = path.join(workdir, inputs.plainVersionFile);
    if (existsSync(versionFilePath)) {
      const raw = readFileSync(versionFilePath, 'utf8').trim();
      const mm = raw.match(/(\d+\.\d+\.\d+)/);
      if (mm) {
        const parsed = parseSemverXyz(mm[1]);
        if (parsed) {
          [currentMajor, currentMinor, currentPatch] = parsed;
        }
      }
    }
  }
  if (currentMajor === 0 && currentMinor === 0 && currentPatch === 0) {
    const parseVersion = parseSemverXyz(inputs.defaultVersion);
    if (parseVersion) {
      [currentMajor, currentMinor, currentPatch] = parseVersion;
    }
  }
}

// 버전 증가
if (bumpLevel === 'major') {
  currentMajor += 1;
  currentMinor = 0;
  currentPatch = 0;
} else if (bumpLevel === 'minor') {
  currentMinor += 1;
  currentPatch = 0;
} else if (bumpLevel === 'patch') {
  currentPatch += 1;
}

const newVersion = `${currentMajor}.${currentMinor}.${currentPatch}`;
const newTag = `${inputs.tagPrefix}${newVersion}`;

setOutput('version_bumped', 'true');
setOutput('new_version', newVersion);
setOutput('new_tag', newTag);

console.log(`✅ 버전 증가 요청=${bumpLevel}, 새로운 버전=${newVersion}, 태그=${newTag}, 프로젝트 타입=${projectType}`);
