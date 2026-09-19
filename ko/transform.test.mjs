import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseSource, jsxText } from './source.mjs';
import { transformSource } from './transform.mjs';
import * as runtime from './runtime.mjs';
import { checkCatalog } from './checks.mjs';

const catalog = JSON.parse(fs.readFileSync('ko/catalog.json', 'utf8'));
const policy = JSON.parse(fs.readFileSync('ko/policy.json', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

// Executes only checked-in source and test fixtures, with no filesystem/network imports.
function execute(source, file = 'src/fixture.tsx', dictionary = catalog, rules = policy, overrides = {}) {
  const code = dictionary ? transformSource(source, file, dictionary, rules).code : source;
  const compiled = ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  const modules = { react: React, 'react/jsx-runtime': jsxRuntime, '/ko/runtime.mjs': runtime, ...overrides.modules };
  vm.runInNewContext(compiled, { exports, ...overrides.globals, require(name) {
    if (!Object.hasOwn(modules, name)) throw new Error(`Unexpected test import: ${name}`);
    return modules[name];
  } }, { timeout: 1000, filename: file });
  return exports;
}

function declaration(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === name) found = `export const ${node.getText(sf)};`;
    ts.forEachChild(node, visit);
  }
  visit(sf);
  assert.ok(found, `${file}: missing reviewed declaration ${name}`);
  return found;
}

test('unknown source and missing placeholders keep the original', () => {
  assert.equal(runtime.text('새 문구 {0}', ['값']), '새 문구 값');
  assert.equal(runtime.format('{0}/{1}', ['x']), 'x/{1}');
  assert.equal(runtime.message('未登録の利用者'), '未登録の利用者');
  assert.equal(runtime.message(null), null);
});

test('full templates preserve evaluation and string coercion order when reordered', () => {
  const fixture = 'export const events: string[]=[]; const next=(n:number)=>{events.push("eval"+n); return {[Symbol.toPrimitive](){events.push("str"+n);return n;}}}; export const value=`值 ${next(0)} ${next(1)}`;';
  const result = execute(fixture, 'src/fixture.ts', { '值 {0} {1}': '{1} / {0}' });
  assert.equal(result.value, '1 / 0');
  assert.deepEqual(plain(result.events), ['eval0', 'str0', 'eval1', 'str1']);
});

test('JSX entity handling, whitespace, and escaping match text semantics', () => {
  assert.equal(jsxText('\n  保存 &amp;\n  取消\n'), '保存 & 取消');
  const result = execute('export const node=<div title="保存 &amp; 取消">\n 保存 &amp;\n 取消\n</div>;', 'src/fixture.tsx', { '保存 & 取消': '<저장> & 취소' });
  assert.equal(renderToStaticMarkup(result.node), '<div title="&lt;저장&gt; &amp; 취소">&lt;저장&gt; &amp; 취소</div>');
});

test('display translation never rewrites keys, user content or handlers', () => {
  const source = 'export const view=(error:string,name:string)=><div key={error} title={error}>{error}<span>{name}</span></div>;';
  const rules = { display: { 'src/fixture.tsx': { error: 2 } } };
  const transformed = transformSource(source, 'src/fixture.tsx', catalog, rules);
  assert.deepEqual(transformed.displayCounts, { error: 2 });
  const view = execute(source, 'src/fixture.tsx', catalog, rules).view('取消', '取消');
  assert.equal(view.key, '取消');
  assert.equal(renderToStaticMarkup(view), '<div title="취소">취소<span>取消</span></div>');
});

test('comparisons, matcher literals, types, regexes and logs stay Chinese', () => {
  const source = 'type Kind="取消"; export const match=(s:string)=>s==="取消" || s.includes("失败") || /失败/.test(s); export const label="取消"; console.warn("失败");';
  const logs = [];
  const result = execute(source, 'src/fixture.ts', { '取消': '취소', '失败': '실패' }, {}, { globals: { console: { warn: value => logs.push(value) } } });
  assert.equal(result.match('取消'), true);
  assert.equal(result.match('실패'), false);
  assert.equal(result.label, '취소');
  assert.deepEqual(logs, ['失败']);
});

test('backend messages retain machine codes and opaque captured values', () => {
  assert.equal(runtime.message('ACCOUNT_BANNED:该账号已被封禁'), 'ACCOUNT_BANNED:계정이 차단되었습니다');
  assert.equal(runtime.message('账号 取消 不存在'), '계정 取消이(가) 없습니다');
  assert.equal(runtime.message('3小时12分钟后重置'), '3시간 12분 후 초기화');
  assert.equal(runtime.message('后台保活'), '백그라운드 로그인 유지');
  assert.equal(runtime.message('X'.repeat(17000) + '未知'), 'X'.repeat(17000) + '未知');
  assert.equal(runtime.matchParts('aaa', ['', '', '']), null);
});

test('upstream relay grouping and protocol fields survive Korean compilation', () => {
  const file = 'src/data/relay_presets.ts';
  const source = fs.readFileSync(file, 'utf8');
  const original = execute(source, file, null).RELAY_PRESETS;
  const korean = execute(source, file).RELAY_PRESETS;
  const groups = execute(declaration('src/components/AddRelayModal.tsx', 'GROUPS'), 'src/components/AddRelayModal.tsx').GROUPS;
  assert.equal(korean.length, original.length);
  for (let i = 0; i < korean.length; i++) {
    const { name: _name, description: _description, mark: _mark, ...actual } = korean[i];
    const { name: _name2, description: _description2, mark: _mark2, ...expected } = original[i];
    assert.deepEqual(plain(actual), plain(expected));
    assert.ok(groups.some(group => group.id === (korean[i].group ?? '自定义')));
  }
});

test('referral eligibility and capacity are unchanged; narrow labels remain internal', () => {
  const file = 'src/components/referral.ts';
  const source = fs.readFileSync(file, 'utf8');
  const original = execute(source, file, null);
  const korean = execute(source, file);
  for (const plan of [null, 'plus', 'pro', 'team', 'free', 'unknown']) assert.equal(korean.referralProgramForPlan(plan), original.referralProgramForPlan(plan));
  for (const offer of [null, {}, { should_show: true, remaining_send_capacity: 12, remaining_reward_capacity: 3, offer_id: 'credits_250' }]) assert.equal(korean.referralCapacity(offer), original.referralCapacity(offer));
  assert.equal(korean.referralProgramLabel('codex_referral_workspace'), '工作区活动');
  assert.equal(runtime.message(korean.referralProgramLabel('codex_referral_workspace')), '워크스페이스 추천 이벤트');
});

test('duration parsing preserves severity thresholds while localizing output', () => {
  const file = 'src/components/AccountList.tsx';
  const source = declaration(file, 'parseDuration');
  const original = execute(source, file, null).parseDuration;
  const korean = execute(source, file).parseDuration;
  for (const input of [undefined, '', '未知', '即将重置', '2天后重置', '5小时20分钟后重置', '15分钟后重置']) assert.equal(korean(input).hours, original(input).hours);
});

test('audit rejects new strings, stale entries, missing/repeated slots, and untranslated text', () => {
  const records = parseSource('export const text=`新文案 ${1} ${2}`;', 'src/test.ts').records;
  assert.ok(checkCatalog({}, records).some(value => value.includes('MISSING')));
  assert.ok(checkCatalog({ '新文案 {0} {1}': '새 문구 {0}' }, records).some(value => value.includes('PLACEHOLDER')));
  assert.ok(checkCatalog({ '旧文案': '옛 문구' }, []).some(value => value.includes('STALE')));
  assert.ok(checkCatalog({ '新文案 {0} {1}': '新文案 {0} {1}' }, records).some(value => value.includes('HAN_IN_KOREAN')));
});

test('every checked-in frontend remains syntactically valid after transformation', () => {
  for (const relative of fs.readdirSync('src', { recursive: true }).filter(file => /\.tsx?$/.test(file))) {
    const file = 'src/' + relative.replaceAll('\\', '/');
    const result = transformSource(fs.readFileSync(file, 'utf8'), file, catalog, policy);
    const parsed = parseSource(result.code, file, policy);
    assert.equal(parsed.records.filter(record => record.role === 'ui').length, 0, `${file}: untranslated literal after compilation`);
  }
});
