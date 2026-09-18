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
