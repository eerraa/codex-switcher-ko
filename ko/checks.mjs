import { HAN } from './source.mjs';

export function placeholders(text) {
  return [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort().join(',');
}

export function checkCatalog(catalog, records, allowed = new Set()) {
  const failures = [];
  const active = new Set(records.filter(record => ['ui', 'runtime'].includes(record.role)).map(record => record.source));
  for (const record of records) {
    if (active.has(record.source) && (typeof catalog[record.source] !== 'string' || !catalog[record.source].trim())) failures.push(`${record.file}:${record.line} MISSING ${JSON.stringify(record.source)}`);
  }
  for (const [source, translated] of Object.entries(catalog)) {
    if (!active.has(source) && !allowed.has(source)) failures.push(`STALE ${JSON.stringify(source)}`);
    if (typeof translated !== 'string' || !translated.trim()) failures.push(`EMPTY ${JSON.stringify(source)}`);
    else {
      if (placeholders(source) !== placeholders(translated)) failures.push(`PLACEHOLDER ${JSON.stringify(source)}`);
      if (HAN.test(translated)) failures.push(`HAN_IN_KOREAN ${JSON.stringify(source)}`);
    }
  }
  return failures;
}
