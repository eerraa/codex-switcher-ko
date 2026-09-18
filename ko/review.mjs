import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function sourceHashes() {
  const entries = [];
  for (const root of ['src', 'src-tauri/src']) {
    for (const relative of fs.readdirSync(root, { recursive: true }).filter(file => /\.(tsx?|rs)$/.test(file)).sort()) {
      const file = root + '/' + relative.replaceAll('\\', '/');
      const code = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
      entries.push([file, createHash('sha256').update(code).digest('hex')]);
    }
  }
  return Object.fromEntries(entries);
}

export function reviewChanges(expected, actual) {
  return [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
    .filter(file => expected[file] !== actual[file])
    .map(file => `SOURCE_REVIEW ${file} (${!expected[file] ? 'new' : !actual[file] ? 'removed' : 'changed'})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const current = sourceHashes();
  if (process.argv.includes('--accept')) {
    fs.writeFileSync('ko/reviewed-source.json', JSON.stringify(current, null, 2) + '\n');
    console.log(`Recorded the current ${Object.keys(current).length} source hashes; previous review state replaced.`);
  } else {
    const reviewed = JSON.parse(fs.readFileSync('ko/reviewed-source.json', 'utf8'));
    const changes = reviewChanges(reviewed, current);
    changes.forEach(change => console.error(change));
    console.log(`Source review: ${changes.length} changed files. Review only the upstream diff before --accept.`);
    process.exitCode = changes.length ? 1 : 0;
  }
}
