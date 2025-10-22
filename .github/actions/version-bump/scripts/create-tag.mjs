#!/usr/bin/env node
import { buildReleaseMessage, execOut, extractVersionDescription, hasChanges, runCmd, tryExecOut } from "./utils.mjs";

const tag = process.env.TAG;
const newVersion = process.env.NEW_VERSION;
const skipToken = process.env.SKIP_TOKEN ?? '[skip version]';
const refName = process.env.GITHUB_REF_NAME ?? 'main';
const releaseDescription = process.env.RELEASE_DESCRIPTION ?? '';
const commitSubjectEnv = process.env.COMMIT_SUBJECT ?? '';

if (!tag || !newVersion) {
  console.error('TAG 와 NEW_VERSION은 필수로 설정되어야합니다.');
  process.exit(1);
}

// Git identity
try {
  runCmd('git config user.name  "github-actions[bot]"');
  runCmd('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
} catch {
  // 패스
}

// ===== 현재 상태 파악 =====
let lastMsg = tryExecOut('git log -1 --pretty=%B');
const tagExists = !!tryExecOut(`git tag -l "${tag}"`).split('\n').find(t => t === tag);
const isReleaseCommit = /chore\(release\): v\d+\.\d+\.\d+/.test(lastMsg);

// CHANGELOG가 방금 수정되어 staged/unstaged 상태인지 확인
const changelogTouched = hasChanges(['CHANGELOG.md']);

function computeReleaseCommitMessage() {
  const description = (releaseDescription || extractVersionDescription(commitSubjectEnv) || '').trim();
  return buildReleaseMessage(newVersion, description, skipToken);
}

// 이미 태그가 있으면, 기존 릴리즈 커밋은 건드리지 않고 CHANGELOG 변경만 별도 커밋
if (tagExists) {
  if (changelogTouched) {
    runCmd('git add CHANGELOG.md');
    const msg = `docs(changelog): update for ${tag} ${skipToken}`;
    runCmd(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
    lastMsg = msg;
  }
} else {
  // 아직 태그가 없으면 릴리즈 커밋 - 릴리즈 커밋 메시지에 skipToken 반드시 포함
  if (changelogTouched) {
    runCmd('git add CHANGELOG.md');
  }

  const releaseCommitMessage = computeReleaseCommitMessage();

  if (!isReleaseCommit) {
    // 릴리즈 커밋이 없다면 새로 생성
    runCmd(`git commit -m "${releaseCommitMessage}"`);
    lastMsg = releaseCommitMessage;
  } else {
    // 릴리즈 커밋이 있지만 메시지가 표준형과 다르면 정규화
    if (lastMsg.trim() !== releaseCommitMessage) {
      runCmd(`git commit --amend -m "${releaseCommitMessage}"`);
      lastMsg = releaseCommitMessage;
    } else if (changelogTouched) {
      // 메시지는 동일, 변경 파일만 포함
      runCmd('git commit --amend --no-edit');
    }
  }
}

// 태그 생성/푸시 (이미 존재하면 스킵)
try {
  const exists = execOut(`git tag -l "${tag}"`);
  if (!exists.split('\n').includes(tag)) {
    runCmd(`git tag -a "${tag}" -m "${tag}"`);
  } else {
    console.log(`⚠️ 태그 ${tag} 이미 존재합니다.`);
  }
  runCmd(`git push origin "${tag}"`);
} catch (e) {
  console.error('GitHub Tag 푸시 실패: ', e?.message ?? e);
  process.exit(1);
}

// 릴리즈 변경사항 푸시 (현재 브랜치)
try {
  runCmd(`git push origin HEAD:${refName}`);
} catch (e) {
  console.error('변경사항 푸시 실패: ', e?.message ?? e);
  process.exit(1);
}