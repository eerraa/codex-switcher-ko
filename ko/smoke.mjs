import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

const browser = process.env.BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(file => fs.existsSync(file));
assert.ok(browser, 'Set BROWSER_PATH to a Chromium-compatible browser executable');
const directory = path.resolve('ko/.smoke.local');
fs.mkdirSync(directory, { recursive: true });
const profile = fs.mkdtempSync(path.join(directory, 'profile-'));
const fixture = path.resolve('ko/browser-fixture.mjs');
const server = await createServer({
  logLevel: 'error',
  optimizeDeps: { entries: ['index.html'] },
  server: { host: '127.0.0.1', port: 0, strictPort: false, open: false, watch: { ignored: ['**/.smoke.local/**'] } },
  plugins: [{ name: 'isolated-tauri-fixture', enforce: 'pre', resolveId(id) { return id.startsWith('@tauri-apps/') ? fixture : undefined; } }],
});
let processHandle;
let socket;
const pending = new Map();
const errors = [];
const report = [];
let sequence = 0;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  processHandle = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  processHandle.on('error', error => errors.push(String(error)));
  processHandle.stderr.on('data', () => {});
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await delay(100);
  assert.ok(fs.existsSync(portFile), 'Browser did not expose the isolated debugging port');
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(target => target.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const callback = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) callback?.reject(new Error(JSON.stringify(data.error)));
      else callback?.resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
  });
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Browser condition not met: ${expression}`);
  }
  async function capture(name, required) {
    await delay(250);
    const result = await evaluate(`({text:document.body.innerText,lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth+2,denied:window.__mockDenied||[]})`);
    fs.writeFileSync(path.join(directory, `${name}.txt`), result.text);
    assert.equal(result.lang, 'ko');
    assert.ok(result.text.toLowerCase().includes(required.toLowerCase()), `${name}: missing ${required}`);
    assert.equal(result.denied.length, 0, `${name}: unmocked IPC ${result.denied}`);
    const han = result.text.match(/[\u3400-\u9fff]+/g) ?? [];
    assert.equal(han.length, 0, `${name}: untranslated visible text ${han.join(', ')}`);
    assert.equal(result.overflow, false, `${name}: horizontal page overflow`);
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(directory, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    report.push({ page: name, required, han: han.length, overflow: result.overflow });
  }
  async function clickText(text) {
    await evaluate(`(() => {const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Button not found: '+${JSON.stringify(text)});button.click();})()`);
  }
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['https://*', 'http://*.com/*', 'http://*.cn/*'] });
  await call('Emulation.setDeviceMetricsOverride', { width: 1200, height: 760, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base });
  await waitFor("document.body.innerText.includes('대시보드') && document.body.innerText.includes('smoke@example.invalid')");
  for (const [label, name, required] of [['대시보드', 'dashboard', '최적 계정 추천'], ['계정 관리', 'accounts', '계정 정보'], ['프록시', 'proxy', '프록시 제어'], ['라우팅', 'routes', '라우팅 추가'], ['통계', 'stats', '총 Token 수'], ['캐시', 'cache', '프롬프트 캐시'], ['Skills', 'skills', '설치된 Skills가 없습니다'], ['설정', 'settings', '설정 저장']]) {
    await clickText(label);
    await capture(name, required);
  }
  await clickText('계정 관리');
  await clickText('+ 릴레이 추가');
  await waitFor("!!document.querySelector('.cs-relay-grid')");
  assert.ok(await evaluate("document.querySelectorAll('.cs-pcard').length >= 15"), 'Relay groups lost presets');
  await capture('relay-picker', '릴레이 서비스 선택');
  await evaluate("document.querySelector('.cs-pcard').click()");
  await delay(200);
  await capture('relay-credentials', 'API Key');
  await call('Page.navigate', { url: base });
  await waitFor("document.body.innerText.includes('smoke@example.invalid')");
  await clickText('+ 계정 로그인');
  await capture('login-modal', '공식 OAuth 인증');
  await call('Page.navigate', { url: base + '?tray' });
  await waitFor("!!document.querySelector('.tp-reset')");
  await capture('tray-popup', 'smoke@example.invalid');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(`Korean browser smoke: ${report.filter(item => item.page).length} views passed with mocked IPC; no real account or native operation.`);
} finally {
  fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ report, errors }, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++sequence, method: 'Browser.close' }));
    await delay(500);
  }
  socket?.close();
  if (processHandle && processHandle.exitCode === null) { processHandle.kill(); await Promise.race([once(processHandle, 'exit'), delay(5000)]); }
  await server.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Browser shutdown may hold the isolated profile briefly. */ }
}
