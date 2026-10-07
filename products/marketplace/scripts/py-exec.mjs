#!/usr/bin/env node
/**
 * Cross-Platform Portable Python Launcher for Zolexora Marketplace
 * 
 * Resolution Order:
 * 1. process.env.PYTHON (explicit interpreter override)
 * 2. process.env.VIRTUAL_ENV (active virtual environment)
 * 3. Root .venv directory (if present in workspace root)
 * 4. System python3 / python in PATH
 * 5. Clear error failure exit 1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';

function resolvePython() {
  // 1. Explicitly configured interpreter
  if (process.env.PYTHON && fs.existsSync(process.env.PYTHON)) {
    return process.env.PYTHON;
  }

  // 2. Active VIRTUAL_ENV
  if (process.env.VIRTUAL_ENV) {
    const venvPy = isWin
      ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe')
      : path.join(process.env.VIRTUAL_ENV, 'bin', 'python3');
    if (fs.existsSync(venvPy)) {
      return venvPy;
    }
  }

  // 3. Repository root .venv
  const repoVenvPy = isWin
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python3');
  if (fs.existsSync(repoVenvPy)) {
    return repoVenvPy;
  }

  // 4. System python3 fallback in PATH
  const sysPyName = isWin ? 'python.exe' : 'python3';
  const checkSys = spawnSync(isWin ? 'where' : 'which', [sysPyName], { encoding: 'utf-8' });
  if (checkSys.status === 0 && checkSys.stdout.trim()) {
    return sysPyName;
  }

  // Fallback for system python
  const altSysPyName = 'python';
  const checkAlt = spawnSync(isWin ? 'where' : 'which', [altSysPyName], { encoding: 'utf-8' });
  if (checkAlt.status === 0 && checkAlt.stdout.trim()) {
    return altSysPyName;
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  const pythonBin = resolvePython();

  if (!pythonBin) {
    console.error('ERROR: No valid Python interpreter found. Please install Python 3 or create a .venv.');
    process.exit(1);
  }

  const result = spawnSync(pythonBin, args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.error) {
    console.error(`ERROR: Failed to launch Python (${pythonBin}): ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status !== null ? result.status : 1);
}

main();
