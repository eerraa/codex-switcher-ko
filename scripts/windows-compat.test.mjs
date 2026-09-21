import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('tray capability grants event subscription only, without wildcard windows or filesystem rights', () => {
  const capability = JSON.parse(fs.readFileSync('src-tauri/capabilities/tray.json', 'utf8'));
  assert.deepEqual(capability.windows, ['tray-popup']);
  assert.deepEqual(capability.permissions, ['core:event:allow-listen', 'core:event:allow-unlisten']);
  assert.ok(!fs.readFileSync('src/components/TrayPopup.tsx', 'utf8').includes('getCurrentWebviewWindow().hide'));
});

test('OAuth fallback keeps the authorization URL separate and routes copy through native IPC', () => {
  const modal = fs.readFileSync('src/components/AddAccountModal.tsx', 'utf8');
  const link = fs.readFileSync('src/components/OAuthLink.tsx', 'utf8');
  assert.ok(!modal.includes('setCallbackInput(url)'));
  assert.ok(modal.includes("await invoke('copy_to_clipboard', { text: url })"));
  assert.ok(modal.includes('<OAuthLink'));
  assert.ok(!modal.includes('navigator.clipboard'));
  assert.ok(link.includes('value={url}'));
  assert.ok(link.includes('onClick={onCopy}'));
});
