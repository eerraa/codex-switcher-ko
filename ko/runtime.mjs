import { catalog } from './catalog.mjs';
import backend from './backend.json' with { type: 'json' };

// Copy only reviewed reason-chart labels; never alter model/account chart data.
export function reasons(rows) {
  const labels = backend['src-tauri/src/switch_log.rs'];
  return rows.map(row => ({ ...row, name: labels[row.name] ?? row.name }));
}


export function format(text, values) {
  return text.replace(/\{(\d+)\}/g, (placeholder, index) => index < values.length ? values[index] : placeholder);
}

export function text(source, values = []) {
  return format(catalog[source] ?? source, values);
}

const patterns = Object.entries(catalog)
  .filter(([source]) => /\{\d+\}/.test(source))
  .map(([source, translated]) => ({ source, translated, parts: source.split(/\{\d+\}/), slots: [...source.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])) }))
  .sort((a, b) => b.parts.join('').length - a.parts.join('').length);

export function matchParts(value, parts) {
  if (!value.startsWith(parts[0]) || !value.endsWith(parts.at(-1))) return null;
  let offset = parts[0].length;
  const values = [];
  for (let i = 1; i < parts.length; i++) {
    const tail = parts[i];
    const next = i === parts.length - 1 ? value.length - tail.length : value.indexOf(tail, offset);
    if (next < offset || (i < parts.length - 1 && !tail)) return null;
    values.push(value.slice(offset, next));
    offset = next + tail.length;
  }
  return offset === value.length ? values : null;
}

// Use only at reviewed presentation sinks; captured values remain opaque.
export function message(value) {
  if (typeof value !== 'string') return value;
  if (Object.hasOwn(catalog, value)) return catalog[value];
  if (value.length > 16384 || !/[\u3400-\u9fff]/.test(value)) return value;
  for (const entry of patterns) {
    const captures = matchParts(value, entry.parts);
    if (captures) {
      const values = [];
      entry.slots.forEach((slot, index) => { values[slot] = captures[index]; });
      return format(entry.translated, values);
    }
  }
  return value;
}
