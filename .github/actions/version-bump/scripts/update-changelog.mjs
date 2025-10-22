#!usr/bin/env node
import fs from 'node:fs';

const newVersion = process.env.NEW_VERSION;
const bumpLevel = process.env.BUMP_LEVEL;
const commitSubject = process.env.COMMIT_SUBJECT;
const commitSha = process.env.COMMIT_SHA ?? '';

const BANNER_AUTHOR_NAME = 'Chuseok22';
const BANNER_AUTHOR_URL = 'https://github.com/Chuseok22'
const BANNER_WORKFLOW_URL = 'https://github.com/Chuseok22/version-management';

if (!newVersion) {
  console.error("NEW_VERSION 은 필수로 설정되어야 합니다.");
  process.exit(1);
}

if (!bumpLevel) {
  console.error("Version 커밋 시 (major | minor | patch) bumpLevel 이 필수로 설정되어야합니다.");
  process.exit(1);
}

const description = commitSubject.replace(/^\s*version\s*\(\s*(major|minor|patch)\s*\)\s*:\s*/i, '').trim();
const date = new Date().toISOString().slice(0, 10);
const emoji = bumpLevel === 'major' ? '🚀' : bumpLevel === 'minor' ? '✨' : '🐛';

const HEADER_NEW = '# Chuseok22 Version Changelog';

const INTRO_BANNER = [
  '<!-- vm-banner-start -->',
  `🔧 **Version Management 자동 변경 이력**`,
  '',
  `이 파일은 중앙 배포 워크플로(**Version Management**)가 자동 생성·유지합니다.`,
  `제작자: **${BANNER_AUTHOR_NAME}** · ${BANNER_AUTHOR_URL}`,
  `워크플로 저장소: ${BANNER_WORKFLOW_URL}`,
  '',
  '※ 수동 편집 내용은 향후 릴리스에서 덮어씌워질 수 있습니다.',
  '<!-- vm-banner:end -->',
].join('\n');

let isFirstCreate = false;
let prev = '';

if (fs.existsSync('CHANGELOG.md')) {
  prev = fs.readFileSync('CHANGELOG.md', 'utf8');
} else {
  isFirstCreate = true;
}

// 이전 파일에서 예전 헤더를 제거 후 본문만 추출
let previousBody = '';
if (prev) {
  previousBody = prev.replace(/^#\s*(Version\s+)?Changelog\s*/i, '').trimStart();
}

// 새로운 컨텐츠 조립
const lines = [];

if (isFirstCreate) {
  // 최초 생성 시 안내 베너 추가
  lines.push(INTRO_BANNER);
  lines.push('');
}

lines.push(HEADER_NEW);
lines.push('');
lines.push(`## [${newVersion}] - ${date}`);
lines.push('');
lines.push(`${emoji} **${bumpLevel}**: ${description}`);
if (commitSha) {
  lines.push(`- commit: \`${commitSha}\``);
}
lines.push('');

// 이전 본문이 있다면 이어붙이기
if (previousBody) {
  lines.push(prev);
}

fs.writeFileSync('CHANGELOG.md', lines.join('\n'), 'utf8');
console.log('CHANGELOG.md 파일 업데이트 완료')
