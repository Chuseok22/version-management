#!usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ===== Exec 헬퍼 메서드 =====

export function runCmd(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

export function execOut(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts }).trim();
}

export function tryExecOut(cmd, opts = {}) {
  try {
    return execOut(cmd, opts);
  } catch {
    return '';
  }
}

export function hasChanges(paths = []) {
  const sel = paths.length ? ` -- ${paths.map(p => `"${p}"`).join(' ')}` : '';
  const s = tryExecOut(`git status --porcelain${sel}`);
  return !!s;
}

// ===== GitHub Actions output helper =====
export function setOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  const line = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${line}\n`, 'utf8');
}

// ===== String/EOL helpers =====
export function normalizeEol(str) {
  return String(str).replace(/\r\n/g, '\n');
}

// ===== Filesystem helpers =====
export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ===== Version helpers =====
export function parseSemverXyz(version) {
  const m = (version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function extractVersionDescription(subject) {
  if (!subject) {
    return '';
  }
  const m = subject.match(/^\s*version\s*\(\s*(major|minor|patch)\s*\)\s*:\s*(.+)\s*$/i);
  return m ? m[2].trim() : '';
}

// ===== Project detection =====
export function resolveGradleFilePath(workdir) {
  const kts = path.join(workdir, 'build.gradle.kts');
  const groovy = path.join(workdir, 'build.gradle');
  if (fs.existsSync(kts)) {
    console.info("gradle-kotlin 환경");
    return kts;
  }
  if (fs.existsSync(groovy)) {
    console.info("gradle-groovy 환경");
    return groovy;
  }
  return '';
}

export function detectProjectType(workdir, hint = 'auto') {
  if (hint !== 'auto') {
    return hint;
  }
  const pkg = path.join(workdir, 'package.json');
  const gradlePath = resolveGradleFilePath(workdir);
  if (fs.existsSync(pkg)) {
    return 'next';
  }
  if (gradlePath) {
    return 'spring';
  }
  console.log("package.json 또는 build.gradle(.kts) 을 찾을 수 없습니다. 일반 프로젝트로 설정합니다.");
  return 'plain';
}

function isKtsFile(filePath) {
  return filePath.endsWith('.kts');
}

// ===== Gradle version helpers =====

export function replaceGradleVersionInText(txt, newVersion) {
  let out = txt;
  const kts = isKtsFile(filePath);
  const quote = kts ? '"' : "'";

  // 라인 선두의 version= 또는 version '...' 스타일 모두 갱신 (Groovy만 method 스타일 허용)
  const reAssign = /(^|\n)\s*version\s*=\s*['"]\d+\.\d+\.\d+(?:-[^'"]+)?['"]/gm;
  const reMethod = /(^|\n)\s*version\s+['"]\d+\.\d+\.\d+(?:-[^'"]+)?['"]/gm;

  if (reAssign.test(out)) {
    out = out.replace(reAssign, (m, p1) => `${p1}version = ${quote}${newVersion}${quote}`);
  }
  if (!kts && reMethod.test(out)) { // [CHANGED] .kts에서는 method 스타일 금지
    out = out.replace(reMethod, (m, p1) => `${p1}version = ${quote}${newVersion}${quote}`);
  }

  // 둘 다 없었다면 파일 하단에 추가
  if (!/^\s*version\s*=|^\s*version\s+['"]/m.test(out)) {
    out = `${out.replace(/\s*$/, '')}\nversion = '${newVersion}'\n`;
  }
  return out;
}

export function updateGradleVersionFile(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`build.gradle 파일을 찾을 수 없습니다: ${filePath}`);
  }
  const txt = fs.readFileSync(filePath, 'utf8');
  const updated = replaceGradleVersionInText(txt, newVersion, filePath);
  fs.writeFileSync(filePath, updated, 'utf8');
}

// ===== Spring application.yml version =====
export function updateApplicationYamlVersion(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  let yml = fs.readFileSync(filePath, 'utf8');
  const re = /(^|\n)\s*version\s*:\s*["']?\d+\.\d+\.\d+["']?/m;
  if (re.test(yml)) {
    yml = yml.replace(re, (m, p1) => `${p1}version: ${newVersion}`);
  } else {
    yml = `${yml.replace(/\s*$/, '')}\nversion: ${newVersion}\n`;
  }
  fs.writeFileSync(filePath, yml, 'utf8');
  return true;
}

// ===== Node package versions =====
export function updatePackageJsonVersion(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`package.json 없음: ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function updatePackageLockVersion(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (raw.version) {
      raw.version = newVersion;
    }
    if (raw.packages && raw.packages[''] && raw.packages[''].version) {
      raw.packages[''].version = newVersion;
    }
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function updateNextConstFile(filePath, newVersion) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  let content = `export const APP_VERSION: string = '${newVersion}';\n`;
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf8');
    const re = /(export\s+const\s+APP_VERSION\s*=\s*')[0-9]+\.[0-9]+\.[0-9]+(')/;
    if (re.test(current)) {
      content = current.replace(re, `$1${newVersion}$2`);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

export function updatePlainVersion(filePath, newVersion) {
  ensureDir(path.dirname(filePath));
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
  const changed = prev !== newVersion;
  fs.writeFileSync(filePath, `${newVersion}\n`, 'utf8'); // 없으면 생성, 있으면 치환
  return changed;
}

// ===== Release commit message =====
export function buildReleaseMessage(version, description, skipToken = '[skip version]') {
  const base = `chore(release): v${version}`;
  const desc = (description ?? '').trim();
  const msg = desc ? `${base} ${desc} ${skipToken}` : `${base} ${skipToken}`;
  return msg.replace(/"/g, '\\"').trim();
}
