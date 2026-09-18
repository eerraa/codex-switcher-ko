import path from 'node:path';
import catalog from './catalog.json' with { type: 'json' };
import policy from './policy.json' with { type: 'json' };
import { transformSource } from './transform.mjs';

export default function koreanLayer() {
  let root;
  return {
    name: 'codex-switcher-korean',
    enforce: 'pre',
    configResolved(config) { root = config.root; },
    transform(code, id) {
      const file = path.relative(root, id.split('?')[0]).replaceAll('\\', '/');
      if (!file.startsWith('src/') || !/\.tsx?$/.test(file)) return null;
      const result = transformSource(code, file, catalog, policy);
      return { code: result.code, map: null };
    },
  };
}
