#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * projectType 자동 판별 (Next.js / Spring Boot)
 * 커밋 subject 검증: version(major|minor|patch): {message}
 * 태그/파일/기본값 기반으로 버전 계산 후 bump
 */

function out(k, v) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`, 'utf8');
}

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function trySh(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

const inputs = {
  projectType: process.env.INPUT_PROJECT_TYPE ?? 'auto',
  defaultBranch: process.env.INPUT_DEFAULT_BRANCH ?? 'main',
  tagPrefix: process.env.INPUT_TAG_PREFIX ?? 'v',
  defaultVersion: process.env.INPUT_DEFAULT_VERSION ?? '0.0.0',
  workdir: process.env.INPUT_WORKDIR ?? '',
  refName: process.env.GITHUB_REF_NAME ?? '',
  actor: process.env.GITHUB_ACTOR ?? '',
};

const repoRoot = process.cwd();
const workdir = inputs.workdir ? path.join(repoRoot, inputs.workdir) : repoRoot;

// main 브랜치 강제
if (inputs.refName && inputs.refName !== inputs.defaultBranch) {
  console.log(`[skip] default branch가 아닙니다: ${inputs.refName} (required: ${inputs.defaultBranch})`);
  out('version_bumped', 'false');
  out('bump_level', 'none');
  process.exit(0);
}

// 커밋 메시지 확인
const commitSubject = trySh('git log -1 --format=%s');
const commitSha = trySh('git rev-parse --short HEAD');
out('commit_subject', commitSubject);
out('commit_sha', commitSha);

const m = commitSubject.match(/^\s*version\s*\(\s*(major|minor|patch)\s*\)\s*:\s*(.+)\s*$/i);
if (!m) {
  console.log("[skip] 커밋 형태가 'version(major | minor | patch): {commit-message}' 패턴이 아닙니다.")
  out('version_bumped', 'false');
  out('bump_level', 'none');
  process.exit(0);
}
const bumpLevel = m[1].toLowerCase();
out('bump_level', bumpLevel);

// 프로젝트 타입 자동 판별
let projectType = inputs.projectType;
if (projectType === 'auto') { // projectType이 'auto'로 입력된 경우
  if (existsSync(path.join(workdir, 'package.json'))) {
    projectType = 'next';
  } else if (existsSync(path.join(workdir, 'build.gradle'))) {
    projectType = 'spring';
  } else {
    console.error('프로젝트 타입을 결정할 수 없습니다. (package.json 또는 build.gradle 찾을 수 없음)');
    process.exit(1);
  }
}

out('project_type', projectType);

// 현재 버전 소스: 태그 우선 -> 파일 -> default_version
const lastTag = trySh(`git describe --tags --abbrev=0 --match "${inputs.tagPrefix}[0-9]*.[0-9]*.[0-9]*"`);
let currentMajor = 0, currentMinor = 0, currentPatch = 0;

function parseXYZ(version) {
  const mm = (version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!mm) {
    return null;
  }
  return [Number(mm[1]), Number(mm[2]), Number(mm[3])];
}

if (lastTag) {
  const rawVersion = lastTag.replace(new RegExp(`^${inputs.tagPrefix}`), '');
  const parseVersion = parseXYZ(rawVersion);
  if (parseVersion) {
    [currentMajor, currentMinor, currentPatch] = parseVersion;
  }
} else {
  // 파일에서 시도
  if (projectType === 'next') {
    const packageJsonPath = path.join(workdir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const parseVersion = parseXYZ(packageJson.version || '');
      if (parseVersion) {
        [currentMajor, currentMinor, currentPatch] = parseVersion;
      }
    }
  } else if (projectType === 'spring') {
    const gradlePath = path.join(workdir, 'build.gradle');
    if (existsSync(gradlePath)) {
      const txt = readFileSync(gradlePath, 'utf8');
      const mm = txt.match(/^\s*version\s*=\s*['"](\d+\.\d+\.\d+)['"]/m);
      if (mm) {
        const parseVersion = parseXYZ(mm[1]);
        if (parseVersion) {
          [currentMajor, currentMinor, currentPatch] = parseVersion;
        }
      }
    }
  }
  if (currentMajor === 0 && currentMinor === 0 && currentPatch === 0) {
    const parseVersion = parseXYZ(inputs.defaultVersion);
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

out('version_bumped', 'true');
out('new_version', newVersion);
out('new_tag', newTag);

console.log(`✅ 버전 증가 요청=${bumpLevel}, 새로운 버전=${newVersion}, 태그=${newTag}, 프로젝트 타입=${projectType}`);
