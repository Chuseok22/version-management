#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const projectType = process.env.PROJECT_TYPE ?? 'auto';
const newVersion = process.env.NEW_VERSION;
const nextJsConstantsPath = process.env.INPUT_NEXT_CONSTANTS_PATH ?? 'src/constants/version.ts';
const syncAppYaml = (process.env.INPUT_SYNC_APP_YAML ?? 'false').toLowerCase() === 'true';
const inputWorkdir = process.env.INPUT_WORKDIR ?? '';

if (!newVersion) {
  console.error("NEW_VERSION 은 필수 값입니다.");
  process.exit(1);
}

const repoRoot = process.cwd();
const workdir = inputWorkdir ? path.join(repoRoot, inputWorkdir) : repoRoot;

export function runCmd(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function ensureDirIfNeeded(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function gitCommit(msg, addPath) {
  try {
    if (addPath) {
      runCmd(`git add "${addPath}"`);
    } else {
      runCmd(`git add -A`);
    }
  } catch {
    // 변경 없음
  }
}

function updatePackageLockJson(lockPath) {
  if (!fs.existsSync(lockPath)) {
    return false;
  }
  try {
    const rawFile = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (rawFile.version) {
      rawFile.version = newVersion;
    }
    if (rawFile.packages && rawFile.packages[''] && rawFile.packages[''].version) {
      rawFile.packages[''].version = newVersion;
    }
    fs.writeFileSync(lockPath, JSON.stringify(rawFile, null, 2) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

if (projectType === 'spring') {
  const gradlePath = path.join(workdir, 'build.gradle');
  if (!fs.existsSync(gradlePath)) {
    console.error(`build.gradle 파일을 찾을 수 없습니다. 경로: ${gradlePath}`);
    process.exit(1);
  }
  let txt = fs.readFileSync(gradlePath, 'utf8');
  const regExp = /(^|\n)\s*version\s*=\s*['"](\d+\.\d+\.\d+)['"]/m;
  if (regExp.test(txt)) {
    txt = txt.replace(regExp, (m, p1) => `${p1}version = '${newVersion}'`);
  } else {
    txt += `\nversion = '${newVersion}'\n`;
  }
  fs.writeFileSync(gradlePath, txt, 'utf8');
  gitCommit(`chore(release): v${newVersion}`, gradlePath);

  if (syncAppYaml) {
    const app = path.join(workdir, 'src', 'main', 'resources', 'application.yml');
    if (fs.existsSync(app)) {
      let yml = fs.readFileSync(app, 'utf8');
      const regExpYml = /(^|\n)\s*version\s*:\s*["']?\d+\.\d+\.\d+["']?/m;
      if (regExpYml.test(yml)) {
        yml = yml.replace(regExpYml, (m, p1) => `${p1}version: ${newVersion}`);
      } else { // version 키가 없을 때 추가
        yml += `\nversion: ${newVersion}\n`;
      }
      fs.writeFileSync(app, yml, 'utf8');
      gitCommit(`chore(release): v${newVersion}`, app);
    }
  }
} else if (projectType === 'next') {
  const packageJson = path.join(workdir, 'package.json');
  if (!fs.existsSync(packageJson)) {
    console.error(`package.json 파일을 찾을 수 없습니다. 경로: ${packageJson}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  data.version = newVersion;
  fs.writeFileSync(packageJson, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const packageLockJson = path.join(workdir, 'package-lock.json');
  const lockTouched = updatePackageLockJson(packageLockJson);

  const constDir = path.dirname(path.join(workdir, nextJsConstantsPath));
  ensureDirIfNeeded(constDir);

  const constPath = path.join(workdir, nextJsConstantsPath);
  let content = `export const APP_VERSION: string = '${newVersion}';\n`;
  if (fs.existsSync(constPath)) {
    const current = fs.readFileSync(constPath, 'utf8');
    const regExp = /(export\s+const\s+APP_VERSION\s*=\s*')[0-9]+\.[0-9]+\.[0-9]+(')/;
    if (regExp.test(current)) {
      content = current.replace(regExp, `$1${newVersion}$2`);
    }
  }
  fs.writeFileSync(constPath, content, 'utf8');

  // 한번에 add
  try {
    runCmd(`git add "${packageJson}"`);
    if (lockTouched) {
      runCmd(`git add "${packageLockJson}"`);
    }
    runCmd(`git add "${constPath}"`);
    runCmd(`git commit -m "chore(release): v${newVersion}"`);
  } catch {
    // 변경없음
  }
} else {
  console.error(`알 수 없는 projectType 입니다: ${projectType}`);
  process.exit(1);
}