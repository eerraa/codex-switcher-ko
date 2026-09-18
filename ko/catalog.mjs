import frontend from './catalog.json' with { type: 'json' };
import backend from './backend.json' with { type: 'json' };

export function rustSource(source) {
  let index = 0;
  return source.replace(/\{\}/g, () => `{${index++}}`);
}

export const catalog = { ...frontend };
for (const entries of Object.values(backend)) {
  for (const [source, translated] of Object.entries(entries)) {
    const key = rustSource(source);
    if (Object.hasOwn(catalog, key) && catalog[key] !== translated) throw new Error(`Conflicting translation: ${key}`);
    catalog[key] = translated;
  }
}
