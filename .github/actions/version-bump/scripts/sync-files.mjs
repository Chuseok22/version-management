#!/usr/bin/env node
import path from 'node:path';
import {
  ensureDir,
  runCmd,
  updateApplicationYamlVersion,
  updateGradleVersionFile,
  updateNextConstFile,
  updatePackageJsonVersion,
  updatePackageLockVersion
} from "./utils.mjs";

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

if (projectType === 'spring') {
  const gradlePath = path.join(workdir, 'build.gradle');

  try {
    updateGradleVersionFile(gradlePath, newVersion);
  } catch (e) {
    console.error(String(e?.message ?? e));
    process.exit(1);
  }

  // 커밋
  try {
    runCmd(`git add "${gradlePath}"`);
    runCmd(`git commit -m "chore(release): v${newVersion}"`);
  } catch {
    /* 변경 없음 */
  }

  if (syncAppYaml) {
    const appPath = path.join(workdir, 'src', 'main', 'resources', 'application.yml');
    const touched = updateApplicationYamlVersion(appPath, newVersion);
    if (touched) {
      try {
        runCmd(`git add "${appPath}"`);
        runCmd(`git commit -m "chore(release): v${newVersion}"`);
      } catch {
        /* 변경 없음 */
      }
    }
  }
} else if (projectType === 'next') {
  const packageJson = path.join(workdir, 'package.json');
  try {
    updatePackageJsonVersion(packageJson, newVersion);
  } catch (e) {
    console.error(String(e?.message ?? e));
    process.exit(1);
  }

  const packageLock = path.join(workdir, 'package-lock.json');
  const lockTouched = updatePackageLockVersion(packageLock, newVersion);

  const constPath = path.join(workdir, nextJsConstantsPath);
  ensureDir(path.dirname(constPath));
  updateNextConstFile(constPath, newVersion);

  try {
    runCmd(`git add "${packageJson}"`);
    if (lockTouched) {
      runCmd(`git add "${packageLock}"`);
    }
    runCmd(`git add "${constPath}"`);
    runCmd(`git commit -m "chore(release): v${newVersion}"`);
  } catch {
    /* 변경 없음 */
  }
} else {
  console.error(`알 수 없는 projectType 입니다: ${projectType}`);
  process.exit(1);
}