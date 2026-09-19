import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { reviewChanges, sourceHashes } from './review.mjs';
import { reasons, message } from './runtime.mjs';
import { transformSource } from './transform.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('release metadata has one upstream version and one Korean patch version', () => {
  const base = read('ko/upstream.json');
  assert.equal(base.tag, 'v' + read('package.json').version);
  assert.match(base.commit, /^[0-9a-f]{40}$/);
  assert.equal(read('ko/tauri.windows.json').version, base.koreanVersion);
  assert.match(base.koreanVersion, /^\d+\.\d+\.\d+-ko\.\d+$/);
});

test('referral copy is explicit about recommendation events and localizes eligibility failures', () => {
  const frontend = read('ko/catalog.json');
  assert.equal(frontend['邀请额度'], '추천 초대');
  assert.equal(frontend['工作区活动'], '워크스페이스 추천 이벤트');
  assert.equal(frontend['邀请同事使用 ChatGPT 桌面版'], 'ChatGPT 추천 초대 · 워크스페이스');
  assert.equal(
    message('邀请接口返回 HTTP 403 非 JSON 响应，可能需要官方桌面版登录会话；无法确认活动资格'),
    '추천 초대 자격을 확인할 수 없습니다. 서버가 HTTP 403 상태로 JSON이 아닌 응답을 반환했습니다. 공식 ChatGPT 데스크톱 로그인 세션이 필요할 수 있습니다',
  );
});

test('clipboard and OAuth diagnostics translate wrappers but preserve exact external data', () => {
  assert.equal(message('无法启动剪贴板工具: program not found'), '클립보드 도구를 실행할 수 없습니다: program not found');
  assert.equal(message('state 校验不通过：这个回调链接不属于本次登录流程'), 'state 검증 실패: 이 콜백 링크는 현재 로그인 요청의 링크가 아닙니다');
  const url = 'https://example.invalid/?state=取消&code=a%26b';
  assert.equal(message(url), url);
  const source = fs.readFileSync('src/components/OAuthLink.tsx', 'utf8');
  const result = transformSource(source, 'src/components/OAuthLink.tsx', read('ko/catalog.json'), read('ko/policy.json'));
  assert.equal(result.displayCounts.error, 1);
  assert.match(result.code, /value=\{url\}/);
  assert.ok(!result.code.includes('__koMessage(url)'));
});

test('source review detects added, removed and changed files, including reused strings', () => {
  assert.deepEqual(reviewChanges({ 'a.ts': 'before', 'b.rs': 'removed' }, { 'a.ts': 'after', 'c.tsx': 'new' }), [
    'SOURCE_REVIEW a.ts (changed)', 'SOURCE_REVIEW b.rs (removed)', 'SOURCE_REVIEW c.tsx (new)',
  ]);
  assert.deepEqual(reviewChanges(read('ko/reviewed-source.json'), sourceHashes()), []);
});

test('JSON dictionaries reject silent duplicate keys', () => {
  for (const file of ['ko/catalog.json', 'ko/backend.json', 'ko/policy.json']) {
    const root = ts.parseJsonText(file, fs.readFileSync(file, 'utf8'));
    function visit(node) {
      if (ts.isObjectLiteralExpression(node)) {
        const names = node.properties.map(property => property.name.text);
        assert.equal(new Set(names).size, names.length, `${file}: duplicate JSON key`);
      }
      ts.forEachChild(node, visit);
    }
    visit(root);
  }
});

test('reason chart labels are copied without changing numeric data or model identifiers', () => {
  const original = Object.freeze([Object.freeze({ name: '手动切号', value: 7 }), Object.freeze({ name: 'model-中文', value: 3 })]);
  assert.deepEqual(reasons(original), [{ name: '수동 계정 전환', value: 7 }, { name: 'model-中文', value: 3 }]);
  assert.equal(original[0].name, '手动切号');
  assert.equal(message('3天 2时 8分'), '3일 2시간 8분');
});

test('chart and nested tooltip adapters only change reviewed presentation boundaries', () => {
  const source = 'const windowLabel="额度"; const reasonData=[{name:"手动切号",value:1}]; export const node=<div title={`Model ${windowLabel}`}><Pie data={reasonData}/><span data-name={windowLabel}/></div>;';
  const policy = { displayTemplates: { 'src/example.tsx': { windowLabel: 1 } }, reasonCharts: { 'src/example.tsx': { reasonData: 1 } } };
  const result = transformSource(source, 'src/example.tsx', {}, policy);
  assert.deepEqual(result.nestedCounts, { windowLabel: 1 });
  assert.deepEqual(result.chartCounts, { reasonData: 1 });
  assert.match(result.code, /data-name=\{windowLabel\}/);
  assert.match(result.code, /data=\{__koReasons\(reasonData\)\}/);
});
