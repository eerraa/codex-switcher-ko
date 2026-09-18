import ts from 'typescript';

export const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;
const MATCHERS = /\.(?:includes|indexOf|lastIndexOf|startsWith|endsWith|match|matchAll|replace|replaceAll|search|split|test)$/;
const COMPARISONS = new Set([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]);

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (entity[0] !== '#') return named[entity] ?? all;
    const value = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return value <= 0x10ffff ? String.fromCodePoint(value) : all;
  });
}

export function jsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let last = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) last = i;
  return decodeEntities(lines.map((line, i) => {
    let text = line.replace(/\t/g, ' ');
    if (i) text = text.replace(/^ +/, '');
    if (i !== lines.length - 1) text = text.replace(/ +$/, '');
    return text ? text + (i !== last ? ' ' : '') : '';
  }).join(''));
}

function sourceText(node) {
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('');
  if (ts.isJsxText(node)) return jsxText(node.text);
  if (ts.isStringLiteralLike(node)) return ts.isJsxAttribute(node.parent) ? decodeEntities(node.text) : node.text;
  return null;
}

export function isDisplayExpression(node) {
  if (!ts.isJsxExpression(node) || !node.expression) return false;
  if (ts.isJsxAttribute(node.parent)) return ['title', 'placeholder', 'aria-label', 'alt'].includes(node.parent.name.getText());
  return ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent);
}

function roleOf(node, file, sf, policy) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isTypeNode(parent)) return 'type';
    if (ts.isTaggedTemplateExpression(parent)) return 'tagged-template';
    if (ts.isCallExpression(parent)) {
      const callee = parent.expression.getText(sf);
      if (/^console\./.test(callee)) return 'log';
      if (MATCHERS.test(callee)) return 'matcher';
    }
    if (ts.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) return 'matcher';
    if (ts.isVariableDeclaration(parent) && policy.preserveVariables?.[file]?.includes(parent.name.getText(sf))) return 'runtime';
    if (ts.isJsxAttribute(parent) && policy.preserveAttributes?.[file]?.includes(parent.name.getText(sf))) return 'runtime';
    if (ts.isJsxAttribute(parent) && ['key', 'value', 'name', 'className', 'id'].includes(parent.name.getText(sf))) return 'runtime';
    if (ts.isFunctionDeclaration(parent) && policy.preserveFunctions?.[file]?.includes(parent.name?.text)) return 'runtime';
    if (ts.isPropertyAssignment(parent) && policy.preserveProperties?.[file]?.includes(parent.name.getText(sf))) return 'runtime';
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return 'module';
  }
  if ((ts.isPropertyAssignment(node.parent) && node.parent.name === node) || ts.isElementAccessExpression(node.parent)) return 'key';
  return 'ui';
}

export function parseSource(code, file, policy = {}) {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (sf.parseDiagnostics.length) throw new Error(`${file}: invalid TypeScript source`);
  const records = [];
  const byNode = new Map();
  function visit(node) {
    const source = sourceText(node);
    if (source !== null && HAN.test(source)) {
      const record = { file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, source, role: roleOf(node, file, sf, policy), kind: ts.SyntaxKind[node.kind] };
      if (policy.ignore?.[file]?.[source]) record.role = 'ignored';
      records.push(record);
      byNode.set(node, record);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return { sf, records, byNode };
}
