import fs from 'node:fs';
import { parseSource } from './source.mjs';
import { checkCatalog } from './checks.mjs';
import { catalog as allCatalog, rustSource } from './catalog.mjs';
import { sourceHashes, reviewChanges } from './review.mjs';
import { transformSource } from './transform.mjs';

export function inventory(policy) {
  return fs.readdirSync('src', { recursive: true }).filter(file => /\.tsx?$/.test(file)).sort().flatMap(relative => {
    const file = 'src/' + relative.replaceAll('\\', '/');
    const code = fs.readFileSync(file, 'utf8');
    return parseSource(code, file, policy).records;
  });
}

const catalog = JSON.parse(fs.readFileSync('ko/catalog.json', 'utf8'));
const policy = JSON.parse(fs.readFileSync('ko/policy.json', 'utf8'));
const records = inventory(policy);
const active = new Set(records.filter(record => ['ui', 'runtime'].includes(record.role)).map(record => record.source));
const backend = JSON.parse(fs.readFileSync('ko/backend.json', 'utf8'));
const backendRecords = [];
const failures = [];
for (const [file, entries] of Object.entries(backend)) {
  const code = fs.readFileSync(file, 'utf8');
  for (const source of Object.keys(entries)) {
    if (!code.includes(JSON.stringify(source))) failures.push(`${file}: STALE_BACKEND ${JSON.stringify(source)}`);
    backendRecords.push({ file, line: 1, source: rustSource(source), role: 'runtime' });
  }
}
failures.push(...checkCatalog(allCatalog, [...records, ...backendRecords]));
if (fs.existsSync('ko/reviewed-source.json')) {
  failures.push(...reviewChanges(JSON.parse(fs.readFileSync('ko/reviewed-source.json', 'utf8')), sourceHashes()));
} else failures.push('SOURCE_REVIEW missing ko/reviewed-source.json');
for (const [file, sinks] of Object.entries(policy.display)) {
  const code = fs.readFileSync(file, 'utf8');
  const { displayCounts } = transformSource(code, file, catalog, policy);
  for (const [expression, expected] of Object.entries(sinks)) if (displayCounts[expression] !== expected) failures.push(`${file}: display sink drift ${JSON.stringify(expression)} expected=${expected} actual=${displayCounts[expression]}`);
}
for (const [rules, counts] of [['displayTemplates', 'nestedCounts'], ['reasonCharts', 'chartCounts']]) {
  for (const [file, entries] of Object.entries(policy[rules] ?? {})) {
    const result = transformSource(fs.readFileSync(file, 'utf8'), file, catalog, policy);
    for (const [source, expected] of Object.entries(entries)) if (result[counts][source] !== expected) failures.push(`${file}: ${rules} drift ${JSON.stringify(source)} expected=${expected} actual=${result[counts][source]}`);
  }
}
for (const [file, entries] of Object.entries(policy.ignore)) {
  for (const [source, reason] of Object.entries(entries)) if (!reason.trim() || !records.some(record => record.file === file && record.source === source)) failures.push(`${file}: stale or unexplained ignore ${JSON.stringify(source)}`);
}
if (process.argv.includes('--inventory')) {
  const unique = [...new Map(records.filter(record => ['ui', 'runtime'].includes(record.role)).map(record => [record.source, record])).values()];
  const start = Number(process.argv[process.argv.indexOf('--inventory') + 1]) || 0;
  const count = Number(process.argv[process.argv.indexOf('--inventory') + 2]) || 120;
  unique.slice(start, start + count).forEach((record, index) => console.log(JSON.stringify([start + index, record.source])));
  console.log(`Inventory ${start}..${Math.min(start + count, unique.length)} / ${unique.length}`);
} else {
  failures.forEach(failure => console.error(failure));
  console.log(`Korean audit: ${records.length} source occurrences; ${active.size} active strings; ${Object.keys(allCatalog).length} translations including ${backendRecords.length} backend entries; ${failures.length} failures.`);
  process.exitCode = failures.length ? 1 : 0;
}
