import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function platform(name) {
  const source = fs.readFileSync('src/platform.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { exports: {}, navigator: { platform: name } };
  vm.runInNewContext(code, context);
  return context.exports;
}

test('Windows uses PowerShell and escapes literal apostrophes without dropping URL metacharacters', () => {
  const api = platform('Win32');
  assert.equal(api.isWindows, true);
  assert.equal(api.isMacOS, false);
  assert.equal(api.codexLaunchCommand("http://localhost:18080/v1?x='&y=$()"), "$env:OPENAI_BASE_URL='http://localhost:18080/v1?x=''&y=$()'; codex");
});

test('Unix launch commands preserve single-quoted URLs', () => {
  const api = platform('MacIntel');
  assert.equal(api.isMacOS, true);
  assert.equal(api.codexLaunchCommand("http://localhost:18080/v1?x='"), "OPENAI_BASE_URL='http://localhost:18080/v1?x='\\''' codex");
});

test('tray capability grants event subscription only, without wildcard windows or filesystem rights', () => {
  const capability = JSON.parse(fs.readFileSync('src-tauri/capabilities/tray.json', 'utf8'));
  assert.deepEqual(capability.windows, ['tray-popup']);
  assert.deepEqual(capability.permissions, ['core:event:allow-listen', 'core:event:allow-unlisten']);
  assert.ok(!fs.readFileSync('src/components/TrayPopup.tsx', 'utf8').includes('getCurrentWebviewWindow().hide'));
});

test('OAuth URL fallback never becomes callback input and all copy entry points use native IPC', () => {
  const source = fs.readFileSync('src/components/AddAccountModal.tsx', 'utf8');
  assert.ok(!source.includes('setCallbackInput(url)'));
  for (const file of ['AccountList', 'Proxy', 'SessionRoutes']) {
    const code = fs.readFileSync(`src/components/${file}.tsx`, 'utf8');
    assert.ok(code.includes("invoke('copy_to_clipboard'"));
    assert.ok(!code.includes('navigator.clipboard'));
  }
});
