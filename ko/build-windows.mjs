import path from 'node:path';
import { spawn } from 'node:child_process';

// Scope the installed toolchain to this build; do not change rustup defaults.
const env = { ...process.env, RUSTUP_TOOLCHAIN: process.env.RUSTUP_TOOLCHAIN || '1.94.0-x86_64-pc-windows-msvc' };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] || '');
const child = spawn(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'build', '--config', 'ko/tauri.windows.json', '--bundles', 'nsis', '--ci', '--', '--locked'], { env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
